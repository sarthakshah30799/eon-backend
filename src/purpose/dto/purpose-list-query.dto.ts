import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TransactionType } from '../../transactions/transactions.enums';
import { PurposePartyProfileType } from '../purpose.enums';

export class PurposeListQueryDto {
  @ApiPropertyOptional({ description: 'Search code or description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: TransactionType, description: 'Filter by transaction type' })
  @IsEnum(TransactionType)
  @IsOptional()
  transactionType?: TransactionType;

  @ApiPropertyOptional({ enum: PurposePartyProfileType, description: 'Filter by party profile type' })
  @IsEnum(PurposePartyProfileType)
  @IsOptional()
  partyProfileType?: PurposePartyProfileType;
}
