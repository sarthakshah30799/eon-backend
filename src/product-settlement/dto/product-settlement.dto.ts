import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { StringArrayQuery } from "../../common/transformers/parse-boolean-query";
import {
  ProductSettlementDocumentKind,
  ProductSettlementDocumentStatus,
} from "../product-settlement.enums";

export class ProductSettlementDocumentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ProductSettlementDocumentStatus,
    isArray: true,
    description: "Filter by one or more settlement statuses",
  })
  @StringArrayQuery()
  @IsOptional()
  @IsArray()
  @IsIn(Object.values(ProductSettlementDocumentStatus), { each: true })
  status?: ProductSettlementDocumentStatus[];
  @ApiPropertyOptional({
    description:
      "Search transaction number, issuer, currency, branch, or reference",
  })
  @IsOptional()
  @IsString()
  search?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(ProductSettlementDocumentKind)
  kind?: ProductSettlementDocumentKind;
  @ApiPropertyOptional() @IsOptional() @IsUUID() issuerPartyProfileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() currencyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional({
    description: "Filter by product code on linked settlement items (e.g. CC, CM, TT)",
  })
  @IsOptional()
  @IsString()
  productCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateTo?: string;
}

export class ProductUnsettledQueryDto extends PaginationQueryDto {
  @ApiProperty()
  @IsEnum(ProductSettlementDocumentKind)
  kind: ProductSettlementDocumentKind;
  @ApiProperty() @IsUUID() issuerPartyProfileId: string;
  @ApiProperty() @IsUUID() currencyId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hoBranchId?: string;
}

export class CreateProductSettlementItemDto {
  @ApiProperty() @IsUUID() id: string;
  @ApiProperty({ example: "84.0000000" }) @IsNumberString() rate: string;
}

export class CreateProductSettlementDocumentDto {
  @ApiProperty({ enum: ProductSettlementDocumentKind })
  @IsEnum(ProductSettlementDocumentKind)
  kind: ProductSettlementDocumentKind;
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
  @ApiProperty({ type: [CreateProductSettlementItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductSettlementItemDto)
  items: CreateProductSettlementItemDto[];
}

export class RejectProductSettlementDocumentDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason: string;
}

export class CancelProductSettlementDocumentDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason: string;
}
