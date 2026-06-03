import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Session } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(AuthenticatedGuard, PermissionsGuard)
  @ApiCookieAuth('sessionId')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users', type: [UserResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Session() session: any): Promise<UserResponseDto[]> {
    return this.userService.findAll(session.userId);
  }

  @Get(':id')
  @UseGuards(AuthenticatedGuard, PermissionsGuard)
  @ApiCookieAuth('sessionId')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User details', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findById(@Param('id') id: string, @Session() session: any): Promise<UserResponseDto> {
    return this.userService.findById(id, session.userId);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered', type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'User with this email already exists' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiBody({ type: CreateUserDto })
  async register(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(createUserDto);
  }

  @Post()
  @UseGuards(AuthenticatedGuard, PermissionsGuard)
  @ApiCookieAuth('sessionId')
  @ApiOperation({ summary: 'Create a new user (admin)' })
  @ApiResponse({ status: 201, description: 'User created', type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'User with this email/code already exists' })
  @ApiBody({ type: CreateUserDto })
  async create(@Body() createUserDto: CreateUserDto, @Session() session: any): Promise<UserResponseDto> {
    return this.userService.create(createUserDto, session.userId);
  }

  @Put(':id')
  @UseGuards(AuthenticatedGuard, PermissionsGuard)
  @ApiCookieAuth('sessionId')
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User updated', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Session() session: any,
  ): Promise<UserResponseDto> {
    return this.userService.update(id, updateUserDto, session.userId);
  }

  @Delete(':id')
  @UseGuards(AuthenticatedGuard, PermissionsGuard)
  @ApiCookieAuth('sessionId')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async delete(@Param('id') id: string, @Session() session: any): Promise<{ message: string }> {
    return this.userService.delete(id, session.userId);
  }

  @Get('profile/me')
  @UseGuards(AuthenticatedGuard)
  @ApiCookieAuth('sessionId')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile data', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Session() session: any): Promise<UserResponseDto> {
    return this.userService.findById(session.userId, session.userId);
  }
}
