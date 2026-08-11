import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsNumberString, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CardTransferItemDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lineNo: number;

  @ApiProperty()
  @IsUUID()
  currencyId: string;

  @ApiProperty({ example: '1' })
  @IsNumberString()
  per: string;

  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsUUID()
  issuerPartyProfileId: string;

  @ApiPropertyOptional({ description: 'Server recalculates this value.' })
  @IsOptional()
  @IsNumberString()
  feAmount?: string;

  @ApiProperty({ type: [String], description: 'CARD stock IDs selected for this item.' })
  @IsArray()
  @IsUUID('4', { each: true })
  cardIds: string[];
}

export class CreateCardTransferDto {
  @ApiProperty()
  @IsUUID()
  sourceBranchId: string;

  @ApiProperty()
  @IsUUID()
  destinationBranchId: string;

  @ApiProperty()
  @IsDateString()
  transactionDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({ type: [CardTransferItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CardTransferItemDto)
  items: CardTransferItemDto[];
}

export class CardTransferActionDto {
  @ApiProperty()
  @IsString()
  remarks: string;
}

export class CardTransferListQueryDto {
  @ApiPropertyOptional({ enum: ['HELD', 'ACCEPTED', 'REJECTED', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
