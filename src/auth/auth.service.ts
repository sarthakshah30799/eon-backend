import { Injectable } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { User } from '../users/user.entity';
import { SessionService } from './session.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
  ) {}

  async validateUser(loginUserDto: LoginUserDto): Promise<User | null> {
    return this.userService.validateUser(loginUserDto);
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

  async getActiveSessions(userId: number): Promise<any[]> {
    return this.sessionService.getUserActiveSessions(userId);
  }
}
