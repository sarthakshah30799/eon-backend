import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CardStockSettlementStatus } from '../card-stock.enums';

export class CardStockSettlementQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsEnum(CardStockSettlementStatus) status?: CardStockSettlementStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() issuerPartyProfileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() currencyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() saleDateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() saleDateTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() settlementDateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() settlementDateTo?: string;
}

class SettlementSelectionDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsUUID('4', { each: true }) settlementIds: string[];
}

export class SubmitBranchCardSettlementDto extends SettlementSelectionDto {
  @ApiProperty({ example: '2026-08-15' }) @IsDateString() settlementDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) remarks?: string;
}

export class AcceptBranchCardSettlementDto extends SettlementSelectionDto {}

export class RejectBranchCardSettlementDto extends SettlementSelectionDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason: string;
}

export class BulkSettleCardStockDto extends SettlementSelectionDto {
  @ApiProperty({ example: '2026-08-15' }) @IsDateString() issuerSettlementDate: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(150) issuerReference: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) remarks?: string;
}

export class CancelCardStockSettlementDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason: string;
}
