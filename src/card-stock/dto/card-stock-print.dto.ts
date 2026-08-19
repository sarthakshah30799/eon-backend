import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum CardStockPrintCopyType {
  CUSTOMER_COPY = 'CUSTOMER_COPY',
  DUPLICATE_COPY = 'DUPLICATE_COPY',
}

export enum CardStockPrintKind {
  STOCK_IN = 'STOCK_IN',
  STOCK_OUT = 'STOCK_OUT',
}

export class RecordCardStockPrintDto {
  @ApiProperty({ enum: CardStockPrintCopyType, required: false })
  @IsEnum(CardStockPrintCopyType)
  @IsOptional()
  copyType?: CardStockPrintCopyType;

  @ApiPropertyOptional({ description: 'Printable HTML is not persisted; the client uses it only for the print window.' })
  @IsString()
  @IsOptional()
  html?: string;
}

export class RecordCardTransferPrintDto extends RecordCardStockPrintDto {
  @ApiProperty({ enum: CardStockPrintKind })
  @IsEnum(CardStockPrintKind)
  kind: CardStockPrintKind;
}
