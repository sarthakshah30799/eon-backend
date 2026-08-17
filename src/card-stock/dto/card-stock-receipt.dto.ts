import { Type } from 'class-transformer';
import { IsAlphanumeric, IsDateString, IsInt, IsNumberString, IsOptional, IsString, IsUUID, Length, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CardStockCardDto {
  @ApiProperty({ example: 'CC', description: '1–4 character alphanumeric series prefix. The system appends 0000 for the initial stock cycle.' }) @IsString() @IsAlphanumeric() @Length(1, 4) series: string;
  @ApiProperty() @IsString() kitNumber: string;
  @ApiProperty() @IsString() cardNumber: string;
  @ApiProperty() @IsNumberString() denomination: string;
  @ApiProperty() @IsNumberString() amount: string;
  @ApiProperty() @IsDateString() expirationDate: string;
}

export class CardStockReceiptItemDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) lineNo: number;
  @ApiProperty() @IsUUID() currencyId: string;
  @ApiProperty() @IsNumberString() per: string;
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty() @IsUUID() issuerPartyProfileId: string;
  @ApiProperty() @IsNumberString() feAmount: string;
  @ApiProperty({ type: [CardStockCardDto] }) @ValidateNested({ each: true }) @Type(() => CardStockCardDto) cards: CardStockCardDto[];
}

export class CreateCardStockReceiptDto {
  @ApiPropertyOptional() @IsOptional() @IsString() transactionNumber?: string;
  @ApiProperty() @IsDateString() receiptDate: string;
  @ApiProperty() @IsUUID() issuerPartyProfileId: string;
  @ApiProperty() @IsUUID() branchId: string;
  @ApiProperty() @IsNumberString() totalFeAmount: string;
  @ApiProperty({ type: [CardStockReceiptItemDto] }) @ValidateNested({ each: true }) @Type(() => CardStockReceiptItemDto) items: CardStockReceiptItemDto[];
}
