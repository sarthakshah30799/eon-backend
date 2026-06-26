import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { User } from '../users/user.entity';
import { SessionService } from './session.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PasswordPolicyService } from '../password-policy/password-policy.service';
import { SessionPolicyService } from '../session-policy/session-policy.service';
import { MailService } from '../mail/mail.service';
import { SetWorkplaceDto } from './dto/set-workplace.dto';
import { ConfigService } from '../config/config.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly sessionPolicyService: SessionPolicyService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) { }

  async validateUser(loginUserDto: LoginUserDto): Promise<User | null> {
    return this.userService.validateUser(loginUserDto);
  }

  async validateOtpUser(verifyOtpDto: { countryCode: string, mobileNumber: string, otp: string }): Promise<User | null> {
    return this.userService.validateOtpUser(verifyOtpDto.countryCode, verifyOtpDto.mobileNumber, verifyOtpDto.otp);
  }

  async login(user: User, session: any): Promise<{ message: string; sessionsInvalidated: number }> {
    // Note: lastLoginAt is already updated in validateUser method
    return this.sessionPolicyService.applyLoginSessionPolicy(
      user,
      session,
      (userId: string, currentSessionId?: string) =>
        this.sessionService.invalidateUserSessions(userId, currentSessionId),
    );
  }

  async setWorkplace(
    session: any,
    dto: SetWorkplaceDto,
  ): Promise<{ message: string; activeBranchId: string; activeCounterId: string }> {
    if (!session?.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const user = await this.userService.findEntityById(session.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isHoStaff = user.userRoles?.some(userRole => userRole.role?.isHoStaff) === true;

    if (!user.isAdmin && !isHoStaff) {
      const hasAssignment = user.userRoles?.some(
        userRole =>
          userRole.branch?.id === dto.branchId &&
          userRole.counter?.id === dto.counterId,
      );

      if (!hasAssignment) {
        throw new BadRequestException('Selected branch and counter are not assigned to this user');
      }
    }

    session.activeBranchId = dto.branchId;
    session.activeCounterId = dto.counterId;

    return {
      message: 'Workplace set successfully',
      activeBranchId: dto.branchId,
      activeCounterId: dto.counterId,
    };
  }

  getWorkplace(session: any): { activeBranchId: string | null; activeCounterId: string | null } {
    return {
      activeBranchId: session?.activeBranchId ?? null,
      activeCounterId: session?.activeCounterId ?? null,
    };
  }

  clearWorkplace(session: any): { message: string } {
    if (session) {
      session.activeBranchId = null;
      session.activeCounterId = null;
    }

    return { message: 'Workplace cleared successfully' };
  }

  async completeInitialPasswordSetup(session: any, newPassword: string): Promise<{ message: string }> {
    const pendingUserId = session?.pendingPasswordSetupUserId;
    if (!pendingUserId) {
      throw new BadRequestException('No pending password setup session found');
    }

    const user = await this.userService.findEntityById(pendingUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.mustChangePassword) {
      throw new BadRequestException('Password setup is not required for this user');
    }

    const policy = await this.passwordPolicyService.getPasswordPolicy();
    this.passwordPolicyService.validatePassword(newPassword, {
      ...policy,
    });

    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    user.isLocked = false;
    user.failedPasswordAttempts = 0;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await this.userService.save(user);

    await this.sessionService.invalidateUserSessions(user.id);

    session.pendingPasswordSetupUserId = null;
    session.pendingPasswordSetupEmail = null;

    return { message: 'Password updated successfully' };
  }

  async logout(session: any): Promise<{ message: string }> {
    session.destroy();
    return { message: 'Logout successful' };
  }

  async getActiveSessions(userId: string): Promise<any[]> {
    return this.sessionService.getUserActiveSessions(userId);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour valid

    await this.userService.save(user);

    const feBaseUrl = this.configService.getOptional('FRONTEND_URL') || 'http://localhost:5173';
    const resetLink = `${feBaseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    try {
      await this.mailService.sendEmail({
        to: email,
        subject: 'Password Reset Request',
        text: `You requested a password reset. Please use the following link to reset your password: ${resetLink}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your account.</p>
            <p>Please click the button below to reset your password:</p>
            <div style="margin: 24px 0;">
              <a href="${resetLink}" style="background-color: #0b8db4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
            </div>
            <p>Or copy and paste the following link into your browser:</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p>This link will expire in 1 hour.</p>
          </div>
        `,
      });
    } catch (error) {
      // Print to console as fallback
      console.warn('Failed to send reset email via SMTP, printing to console as fallback:', error.message);
      console.log('\n============================================================');
      console.log('                   PASSWORD RESET REQUEST                   ');
      console.log('============================================================');
      console.log(`Email:      ${email}`);
      console.log(`Reset Link: ${resetLink}`);
      console.log('============================================================\n');
      throw new BadRequestException(`Failed to send password reset email: ${error.message}`);
    }

    return { message: 'Password reset email sent successfully.' };
  }

  async resetPassword(email: string, token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userService.findByResetToken(email, token);
    if (!user) {
      throw new BadRequestException('Invalid reset token or email');
    }

    if (!user.resetPasswordExpires || user.resetPasswordExpires.getTime() < Date.now()) {
      throw new BadRequestException('Reset token has expired');
    }

    const policy = await this.passwordPolicyService.getPasswordPolicy();
    this.passwordPolicyService.validatePassword(newPassword, { ...policy });

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.mustChangePassword = false;
    user.isLocked = false;
    user.failedPasswordAttempts = 0;

    // Clear reset token and expiration
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await this.userService.save(user);

    // Forcefully invalidate all active sessions for this user
    await this.sessionService.invalidateUserSessions(user.id);

    return { message: 'Password has been reset successfully' };
  }

}
