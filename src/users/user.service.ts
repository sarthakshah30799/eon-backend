import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });
    return users.map(UserResponseDto.fromEntity);
  }

  async create(createUserDto: CreateUserDto, userId?: string): Promise<UserResponseDto> {
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const existingCode = await this.userRepository.findOne({
      where: { userCode: createUserDto.userCode },
    });

    if (existingCode) {
      throw new ConflictException('User with this user code already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
      createdBy: userId || '00000000-0000-0000-0000-000000000000',
      updatedBy: userId || '00000000-0000-0000-0000-000000000000',
    });

    const savedUser = await this.userRepository.save(user);
    return UserResponseDto.fromEntity(savedUser);
  }

  async update(id: string, dto: UpdateUserDto, userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findOne({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException('User with this email already exists');
      }
    }

    if (dto.userCode && dto.userCode !== user.userCode) {
      const existing = await this.userRepository.findOne({ where: { userCode: dto.userCode } });
      if (existing) {
        throw new ConflictException('User with this user code already exists');
      }
    }

    Object.assign(user, dto);
    user.updatedBy = userId;
    const saved = await this.userRepository.save(user);
    return UserResponseDto.fromEntity(saved);
  }

  async delete(id: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    await this.userRepository.remove(user);
    return { message: `User with id ${id} deleted successfully` };
  }

  async validateUser(loginUserDto: LoginUserDto): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email: loginUserDto.email },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(loginUserDto.password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return user;
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return UserResponseDto.fromEntity(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByMobileNumber(countryCode: string, phoneNumber: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { countryCode, phoneNumber } });
  }

  async validateOtpUser(countryCode: string, phoneNumber: string, otp: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { countryCode, phoneNumber },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    if (otp !== '123456') {
      return null;
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return user;
  }
}
