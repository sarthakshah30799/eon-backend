import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { UserRole } from '../user-roles/user-role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { uppercaseFields } from '../utils/uppercase.util';

const USER_RELATIONS = [
  'userRoles',
  'userRoles.role',
  'userRoles.role.menuPermissions',
  'userRoles.role.menuPermissions.menu',
  'userRoles.role.menuPermissions.permission',
  'userRoles.branch',
  'userRoles.counter',
];

const TEMP_INITIAL_PASSWORD = 'Temp@1234';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({
      relations: USER_RELATIONS,
      order: { createdAt: 'DESC' },
    });
    return users.map(UserResponseDto.fromEntity);
  }

  async create(createUserDto: CreateUserDto, userId?: string): Promise<UserResponseDto> {
    const uppercased = uppercaseFields(createUserDto);
    const existingUser = await this.userRepository.findOne({
      where: { email: uppercased.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const existingCode = await this.userRepository.findOne({
      where: { code: uppercased.code },
    });

    if (existingCode) {
      throw new ConflictException('User with this user code already exists');
    }

    const { roleId, branchId, counterId, ...userFields } = uppercased;
    const hashedPassword = await bcrypt.hash(TEMP_INITIAL_PASSWORD, 10);

    const user = this.userRepository.create({
      ...userFields,
      password: hashedPassword,
      mustChangePassword: true,
      isActive: uppercased.isActive !== false,
      createdBy: userId || '00000000-0000-0000-0000-000000000000',
      updatedBy: userId || '00000000-0000-0000-0000-000000000000',
    });

    const savedUser = await this.userRepository.save(user);

    if (roleId || branchId || counterId) {
      const userRole = this.userRoleRepository.create({
        user: { id: savedUser.id } as any,
        role: roleId ? ({ id: roleId } as any) : null,
        branch: branchId ? ({ id: branchId } as any) : null,
        counter: counterId ? ({ id: counterId } as any) : null,
      });
      await this.userRoleRepository.save(userRole);
    }

    return this.findById(savedUser.id);
  }

  async update(id: string, dto: UpdateUserDto, userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    const uppercased = uppercaseFields(dto);

    if (uppercased.email && uppercased.email !== user.email) {
      const existing = await this.userRepository.findOne({ where: { email: uppercased.email } });
      if (existing) {
        throw new ConflictException('User with this email already exists');
      }
    }

    if (uppercased.code && uppercased.code !== user.code) {
      const existing = await this.userRepository.findOne({ where: { code: uppercased.code } });
      if (existing) {
        throw new ConflictException('User with this user code already exists');
      }
    }

    const { roleId, branchId, counterId, ...userFields } = uppercased;

    Object.assign(user, userFields);
    user.updatedBy = userId;
    const saved = await this.userRepository.save(user);

    if (roleId !== undefined || branchId !== undefined || counterId !== undefined) {
      let userRole = await this.userRoleRepository.findOne({ where: { user: { id: saved.id } } });
      if (!userRole) {
        userRole = this.userRoleRepository.create({ user: { id: saved.id } as any });
      }
      if (roleId !== undefined) userRole.role = roleId ? ({ id: roleId } as any) : null;
      if (branchId !== undefined) userRole.branch = branchId ? ({ id: branchId } as any) : null;
      if (counterId !== undefined) userRole.counter = counterId ? ({ id: counterId } as any) : null;
      await this.userRoleRepository.save(userRole);
    }

    return this.findById(saved.id);
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

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(loginUserDto.password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    user.lastLoginDate = new Date();
    await this.userRepository.save(user);

    return user;
  }

  async findEntityById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: USER_RELATIONS,
    });
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: USER_RELATIONS,
    });
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return UserResponseDto.fromEntity(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: USER_RELATIONS,
    });
  }

  async findByMobileNumber(countryCode: string, phoneNumber: string): Promise<User | null> {
    // Standard ERP contactNo
    return this.userRepository.findOne({
      where: { contactNo: phoneNumber },
      relations: USER_RELATIONS,
    });
  }

  async validateOtpUser(countryCode: string, phoneNumber: string, otp: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { contactNo: phoneNumber },
    });

    if (!user || !user.isActive) {
      return null;
    }

    if (otp !== '123456') {
      return null;
    }

    user.lastLoginDate = new Date();
    await this.userRepository.save(user);

    return user;
  }

  async save(user: User): Promise<User> {
    return this.userRepository.save(user);
  }

  async findByResetToken(email: string, token: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email, resetPasswordToken: token },
    });
  }
}
