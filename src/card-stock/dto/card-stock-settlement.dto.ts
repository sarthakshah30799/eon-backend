import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import {
  CardStockSettlementDocumentKind,
  CardStockSettlementDocumentStatus,
} from "../card-stock.enums";

export class CardStockSettlementDocumentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(CardStockSettlementDocumentStatus)
  status?: CardStockSettlementDocumentStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(CardStockSettlementDocumentKind)
  kind?: CardStockSettlementDocumentKind;
  @ApiPropertyOptional() @IsOptional() @IsUUID() issuerPartyProfileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() currencyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateTo?: string;
}

export class CardStockUnsettledQueryDto extends PaginationQueryDto {
  @ApiProperty()
  @IsEnum(CardStockSettlementDocumentKind)
  kind: CardStockSettlementDocumentKind;
  @ApiProperty() @IsUUID() issuerPartyProfileId: string;
  @ApiProperty() @IsUUID() currencyId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hoBranchId?: string;
}

export class CreateCardStockSettlementItemDto {
  @ApiProperty() @IsUUID() id: string;
  @ApiProperty({ example: "84.0000000" }) @IsNumberString() rate: string;
}

export class CreateCardStockSettlementDocumentDto {
  @ApiProperty({ enum: CardStockSettlementDocumentKind })
  @IsEnum(CardStockSettlementDocumentKind)
  kind: CardStockSettlementDocumentKind;
  @ApiProperty() @IsUUID() issuerPartyProfileId: string;
  @ApiProperty() @IsUUID() currencyId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hoBranchId?: string;
  @ApiProperty({ example: "2026-08-16" })
  @IsDateString()
  transactionDate: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  reference?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
  @ApiProperty({ type: [CreateCardStockSettlementItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCardStockSettlementItemDto)
  items: CreateCardStockSettlementItemDto[];
}

export class RejectCardStockSettlementDocumentDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason: string;
}

export class CancelCardStockSettlementDocumentDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason: string;
}
