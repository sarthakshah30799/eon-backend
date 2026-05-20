import { Controller, Post, Get, Body, Req, Res, UseGuards, Session, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { UserService } from '../users/user.service';
import { AuthenticatedGuard } from './guards/authenticated.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered', type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'User with this email already exists' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiBody({ type: CreateUserDto })
  async register(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(createUserDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user and create session' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiBody({ type: LoginUserDto })
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Session() session: any,
  ) {
    const user = await this.authService.validateUser(loginUserDto);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user, session);
  }

  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP to mobile number' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiBody({ type: SendOtpDto })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    // Check if user exists
    const user = await this.userService.findByMobileNumber(sendOtpDto.countryCode, sendOtpDto.mobileNumber);
    if (!user) {
      throw new NotFoundException('User not found. Please register first.');
    }

    // In a real app, integrate SMS provider here.
    return { message: 'OTP sent successfully' };
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Login user via OTP and create session' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid OTP or user not found' })
  @ApiBody({ type: VerifyOtpDto })
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
    @Session() session: any,
  ) {
    const user = await this.authService.validateOtpUser(verifyOtpDto);
    if (!user) {
      throw new UnauthorizedException('Invalid OTP or user not found');
    }
    return this.authService.login(user, session);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user and destroy session' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Session() session: any) {
    return this.authService.logout(session);
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  @ApiCookieAuth('sessionId')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user data', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@Req() req): Promise<UserResponseDto> {
    return this.userService.findById(req.session.userId);
  }

  @Get('check')
  @ApiOperation({ summary: 'Check authentication status' })
  @ApiResponse({ status: 200, description: 'Authentication status' })
  async checkAuth(@Session() session: any) {
    return {
      authenticated: !!session.userId,
      userId: session.userId || null,
      email: session.email || null,
    };
  }

  @Get('sessions')
  @UseGuards(AuthenticatedGuard)
  @ApiCookieAuth('sessionId')
  @ApiOperation({ summary: 'Get all active sessions for current user' })
  @ApiResponse({ status: 200, description: 'Active sessions list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getActiveSessions(@Session() session: any) {
    if (!session.userId) {
      throw new Error('Not authenticated');
    }
    return this.authService.getActiveSessions(session.userId);
  }
}
