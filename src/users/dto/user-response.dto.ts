import { User } from '../user.entity';
import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Unique user code', example: 'USR-001' })
  userCode: string;

  @ApiProperty({ description: 'First name', example: 'John' })
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  lastName: string;

  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: 'Country code', example: 'IN' })
  countryCode: string;

  @ApiProperty({ description: 'Phone number', example: '9876543210' })
  phoneNumber: string;

  @ApiProperty({ description: 'User status', example: 'active' })
  status: string;

  @ApiProperty({ description: 'Is head office user', example: false })
  isHo: boolean;

  @ApiProperty({ description: 'Last login timestamp', required: false })
  lastLoginAt: Date;

  @ApiProperty({ description: 'Account creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.userCode = user.userCode;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.email = user.email;
    dto.countryCode = user.countryCode;
    dto.phoneNumber = user.phoneNumber;
    dto.status = user.status;
    dto.isHo = user.isHo;
    dto.lastLoginAt = user.lastLoginAt;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
