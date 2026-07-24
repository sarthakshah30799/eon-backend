import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  PassengerEntityType,
  PassengerNationalityType,
} from '../passenger.entity';

export class VerifyPassengerPanDto {
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

  @ApiPropertyOptional({ example: 'Company', description: 'Dynamic category option value' })
  @IsOptional()
  @IsString()
  panHolderRelationType?: string;
}
