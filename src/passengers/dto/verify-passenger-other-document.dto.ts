import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PassengerOtherIdProofType } from '../passenger.entity';

export class VerifyPassengerOtherDocumentDto {
  @ApiProperty({ enum: PassengerOtherIdProofType })
  @IsEnum(PassengerOtherIdProofType)
  documentType: PassengerOtherIdProofType;

  @ApiPropertyOptional({ example: 'ID123456' })
  @IsOptional()
  documentNumber?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  validTill?: string;

  @ApiPropertyOptional({ example: 'Delhi' })
  @IsOptional()
  issueAt?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  issueDate?: string;

  @ApiPropertyOptional({ example: '2027-01-01' })
  @IsOptional()
  expiryDate?: string;
}
