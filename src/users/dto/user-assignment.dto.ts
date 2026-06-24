import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UserAssignmentDto {
  @ApiProperty({ description: 'Role ID (UUID)' })
  @IsString()
  @MinLength(1)
  roleId: string;

  @ApiProperty({ description: 'Role name', required: false })
  @IsString()
  @IsOptional()
  roleName?: string;

  @ApiProperty({ description: 'Branch ID (UUID)' })
  @IsString()
  @MinLength(1)
  branchId: string;

  @ApiProperty({ description: 'Branch name', required: false })
  @IsString()
  @IsOptional()
  branchName?: string;

  @ApiProperty({ description: 'Counter ID (UUID)' })
  @IsString()
  @MinLength(1)
  counterId: string;

  @ApiProperty({ description: 'Counter name', required: false })
  @IsString()
  @IsOptional()
  counterName?: string;
}

export class UserAssignmentResponseDto extends UserAssignmentDto {
  @ApiProperty({ description: 'Role name', required: false })
  @IsString()
  @IsOptional()
  roleName?: string;

  @ApiProperty({ description: 'Branch name', required: false })
  @IsString()
  @IsOptional()
  branchName?: string;

  @ApiProperty({ description: 'Counter name', required: false })
  @IsString()
  @IsOptional()
  counterName?: string;
}
