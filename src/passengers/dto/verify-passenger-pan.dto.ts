import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  PassengerEntityType,
  PassengerNationalityType,
  PassengerPanHolderRelationType,
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

  @ApiPropertyOptional({ enum: PassengerPanHolderRelationType })
  @IsOptional()
  @IsEnum(PassengerPanHolderRelationType)
  panHolderRelationType?: PassengerPanHolderRelationType;
}
