import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import {
  PassengerEntityType,
  PassengerNationalityType,
} from '../passenger.entity';

export class VerifyPassengerAmlDto {
  @ApiProperty({ enum: PassengerEntityType })
  @IsEnum(PassengerEntityType)
  entityType: PassengerEntityType;

  @ApiProperty({ enum: PassengerNationalityType })
  @IsEnum(PassengerNationalityType)
  nationalityType: PassengerNationalityType;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  panNumber?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  panHolderName?: string;

  @ApiPropertyOptional({ example: '1990-01-31' })
  @IsOptional()
  panDob?: string;

  @ApiPropertyOptional({ example: 'COMPANY' })
  @IsOptional()
  panHolderRelationType?: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  corporatePanNumber?: string;

  @ApiPropertyOptional({ example: 'Acme Pvt Ltd' })
  @IsOptional()
  corporatePanHolderName?: string;

  @ApiPropertyOptional({ example: '1990-01-31' })
  @IsOptional()
  corporatePanDob?: string;

  @ApiPropertyOptional({ example: 'COMPANY' })
  @IsOptional()
  corporatePanHolderRelationType?: string;

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
