import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
  ValidateNested,
} from "class-validator";

export class CreateMonthlyLockWindowInputDto {
  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsDateString()
  fromDate: string;

  @ApiProperty()
  @IsDateString()
  toDate: string;
}

export class CreateMonthlyLocksDto {
  @ApiProperty({ type: [CreateMonthlyLockWindowInputDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateMonthlyLockWindowInputDto)
  rules: CreateMonthlyLockWindowInputDto[];
}

export class MonthlyLockWindowResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  branchId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  fromDate: string;

  @ApiProperty()
  toDate: string;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  revokedAt?: Date | null;

  @ApiPropertyOptional()
  revokedBy?: string | null;
}
