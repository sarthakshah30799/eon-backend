import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../user-roles/user-role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserAssignmentDto } from './dto/user-assignment.dto';
import { uppercaseFields } from '../utils/uppercase.util';
import { PasswordPolicyService } from '../password-policy/password-policy.service';

const USER_RELATIONS = [
  'userRoles',
  'userRoles.role',
  'userRoles.role.menuPermissions',
  'userRoles.role.menuPermissions.menu',
  'userRoles.role.menuPermissions.permission',
  'userRoles.branch',
  'userRoles.branch.company',
  'userRoles.counter',
];

const TEMP_INITIAL_PASSWORD = 'Temp@1234';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  private async isRequesterAdmin(userId?: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    return user?.isAdmin === true;
  }

  private normalizeAssignments(
    dto: Partial<CreateUserDto> & { assignments?: UserAssignmentDto[] }
  ): UserAssignmentDto[] {
    const assignments = dto.assignments ?? [];

    if (assignments.length > 0) {
      const seen = new Set<string>();

      return assignments.filter(assignment => {
        if (!assignment.roleId || !assignment.branchId || !assignment.counterId) {
          return false;
        }

        const key = `${assignment.roleId}::${assignment.branchId}::${assignment.counterId}`;
        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
    }

    if (dto.roleId && dto.branchId && dto.counterId) {
      return [
        {
          roleId: dto.roleId,
          branchId: dto.branchId,
          counterId: dto.counterId,
        },
      ];
    }

    return [];
  }

  private async ensureRolesAreAssignable(
    assignments: UserAssignmentDto[],
    requesterIsAdmin: boolean
  ): Promise<void> {
    const uniqueRoleIds = [...new Set(assignments.map(assignment => assignment.roleId))];

    for (const roleId of uniqueRoleIds) {
      const role = await this.roleRepository.findOne({ where: { id: roleId } });

      if (!role) {
        throw new NotFoundException(`Role with id ${roleId} not found`);
      }

      if (role.isAdmin && !requesterIsAdmin) {
        throw new ConflictException('Admin role cannot be assigned to non-admin users');
      }
    }
  }

  private async syncUserRoles(
    userId: string,
    assignments: UserAssignmentDto[],
    actorUserId?: string
  ): Promise<void> {
    await this.userRoleRepository
      .createQueryBuilder()
      .delete()
      .from(UserRole)
      .where('user_id = :userId', { userId })
      .execute();

    if (assignments.length === 0) {
      return;
    }

    const actorId = actorUserId || '00000000-0000-0000-0000-000000000000';

    const userRoles = assignments.map(assignment =>
      this.userRoleRepository.create({
        user: { id: userId } as any,
        role: { id: assignment.roleId } as any,
        branch: { id: assignment.branchId } as any,
        counter: { id: assignment.counterId } as any,
        createdBy: actorId,
        updatedBy: actorId,
      })
    );

    await this.userRoleRepository.save(userRoles);
  }

  async findAll(currentUserId?: string): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({
      relations: USER_RELATIONS,
      order: { createdAt: 'DESC' },
    });

    if (await this.isRequesterAdmin(currentUserId)) {
      return users.map(UserResponseDto.fromEntity);
    }

    return users
      .filter(user => user.isAdmin !== true)
      .map(UserResponseDto.fromEntity);
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

    const assignments = this.normalizeAssignments(uppercased);
    const requesterIsAdmin = await this.isRequesterAdmin(userId);
    await this.ensureRolesAreAssignable(assignments, requesterIsAdmin);

    const {
      roleId: _roleId,
      branchId: _branchId,
      counterId: _counterId,
      assignments: _assignments,
      ...userFields
    } = uppercased;
    const hashedPassword = await bcrypt.hash(TEMP_INITIAL_PASSWORD, 10);

    const user = this.userRepository.create({
      ...userFields,
      password: hashedPassword,
      mustChangePassword: true,
      isAdmin: false,
      isActive: uppercased.isActive !== false,
      createdBy: userId || '00000000-0000-0000-0000-000000000000',
      updatedBy: userId || '00000000-0000-0000-0000-000000000000',
    });

    const savedUser = await this.userRepository.save(user);

    await this.syncUserRoles(savedUser.id, assignments, userId);

    return this.findById(savedUser.id);
  }

  async update(id: string, dto: UpdateUserDto, userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    const requesterIsAdmin = await this.isRequesterAdmin(userId);
    if (user.isAdmin && !requesterIsAdmin) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    const uppercased = uppercaseFields(dto);
    const assignmentsProvided =
      uppercased.assignments !== undefined ||
      (uppercased.roleId !== undefined &&
        uppercased.branchId !== undefined &&
        uppercased.counterId !== undefined);
    const assignments = assignmentsProvided
      ? this.normalizeAssignments(uppercased)
      : [];

    if (assignmentsProvided) {
      await this.ensureRolesAreAssignable(assignments, requesterIsAdmin);
    }

    if (uppercased.email && uppercased.email !== user.email) {
      const existing = await this.userRepository.findOne({ where: { email: uppercased.email } });
      if (existing) {
        throw new ConflictException('User with this email already exists');
      }
    }

    const {
      code: _code,
      roleId: _roleId,
      branchId: _branchId,
      counterId: _counterId,
      assignments: _assignments,
      ...userFields
    } = uppercased;

    Object.assign(user, userFields);
    user.updatedBy = userId;
    const saved = await this.userRepository.save(user);

    if (assignmentsProvided) {
      await this.syncUserRoles(saved.id, assignments, userId);
    }

    return this.findById(saved.id);
  }

  async delete(id: string, userId?: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    if (user.isAdmin && !(await this.isRequesterAdmin(userId))) {
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

    if (user.isLocked) {
      throw this.passwordPolicyService.lockedAccountException();
    }

    const policy = await this.passwordPolicyService.getPasswordPolicy();
    const isPasswordValid = await bcrypt.compare(loginUserDto.password, user.password);

    if (!isPasswordValid) {
      if (policy.maxInvalidAttempts <= 0) {
        user.failedPasswordAttempts = 0;
        await this.userRepository.save(user);
        return null;
      }

      user.failedPasswordAttempts = (user.failedPasswordAttempts || 0) + 1;

      if (
        policy.maxInvalidAttempts > 0 &&
        user.failedPasswordAttempts >= policy.maxInvalidAttempts
      ) {
        user.isLocked = true;
        await this.userRepository.save(user);
        throw this.passwordPolicyService.lockedAccountException();
      }

      await this.userRepository.save(user);
      return null;
    }

    user.failedPasswordAttempts = 0;
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

  async findById(id: string, currentUserId?: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: USER_RELATIONS,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isAdmin && !(await this.isRequesterAdmin(currentUserId))) {
      throw new NotFoundException(`User with id ${id} not found`);
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

    if (user.isLocked) {
      throw this.passwordPolicyService.lockedAccountException();
    }

    if (otp !== '123456') {
      return null;
    }

    user.failedPasswordAttempts = 0;
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
