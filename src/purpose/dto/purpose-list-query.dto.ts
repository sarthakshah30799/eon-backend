import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TransactionType } from '../../transactions/transactions.enums';

export class PurposeListQueryDto {
  @ApiPropertyOptional({ description: 'Search code or description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: TransactionType, description: 'Filter by transaction type' })
  @IsEnum(TransactionType)
  @IsOptional()
  transactionType?: TransactionType;
}
