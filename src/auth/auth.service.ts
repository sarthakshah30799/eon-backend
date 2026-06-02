import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { User } from '../users/user.entity';
import { SessionService } from './session.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
  ) {}

  async validateUser(loginUserDto: LoginUserDto): Promise<User | null> {
    return this.userService.validateUser(loginUserDto);
  }

  async validateOtpUser(verifyOtpDto: { countryCode: string, mobileNumber: string, otp: string }): Promise<User | null> {
    return this.userService.validateOtpUser(verifyOtpDto.countryCode, verifyOtpDto.mobileNumber, verifyOtpDto.otp);
  }

  async login(user: User, session: any): Promise<{ message: string; sessionsInvalidated: number }> {
    // Invalidate all previous sessions for this user
    await this.sessionService.invalidateUserSessions(user.id, session.id);
    
    // Set current session
    session.userId = user.id;
    session.email = user.email;
    
    // Note: lastLoginAt is already updated in validateUser method
    
    return { 
      message: 'Login successful - previous sessions have been invalidated',
      sessionsInvalidated: 1 // We'll get actual count if needed
    };
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

    // Print link prominently to the console so that the user can copy it
    console.log('\n============================================================');
    console.log('                   PASSWORD RESET REQUEST                   ');
    console.log('============================================================');
    console.log(`Email:      ${email}`);
    console.log(`Reset Link: http://localhost:5173/reset-password?token=${token}&email=${encodeURIComponent(email)}`);
    console.log('============================================================\n');

    return { message: 'Reset link generated and logged to the console' };
  }

  async resetPassword(email: string, token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userService.findByResetToken(email, token);
    if (!user) {
      throw new BadRequestException('Invalid reset token or email');
    }

    if (!user.resetPasswordExpires || user.resetPasswordExpires.getTime() < Date.now()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    // Clear reset token and expiration
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await this.userService.save(user);

    // Forcefully invalidate all active sessions for this user
    await this.sessionService.invalidateUserSessions(user.id);

    return { message: 'Password has been reset successfully' };
  }
}
