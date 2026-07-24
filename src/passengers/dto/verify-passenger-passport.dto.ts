import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PassengerNationalityType } from '../passenger.entity';

export class VerifyPassengerPassportDto {
  @ApiProperty({ enum: PassengerNationalityType })
  @IsEnum(PassengerNationalityType)
  nationalityType: PassengerNationalityType;

  @ApiPropertyOptional({ example: 'P1234567' })
  @IsOptional()
  passportNumber?: string;

  @ApiPropertyOptional({ example: 'Delhi' })
  @IsOptional()
  passportIssueAt?: string;

  @ApiPropertyOptional({ example: '2020-01-01' })
  @IsOptional()
  passportIssueDate?: string;

  @ApiPropertyOptional({ example: '2030-01-01' })
  @IsOptional()
  passportExpiryDate?: string;

  @ApiPropertyOptional({ example: '2026-07-21' })
  @IsOptional()
  arrivalDate?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isIndianNationality?: boolean;
}
