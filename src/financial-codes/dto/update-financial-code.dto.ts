import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class UpdateFinancialSubProfileNestedDto {
  @ApiProperty({ description: "Financial Sub Profile UUID (if existing)", required: false })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({ description: "Financial Sub Code", example: "HDFCA", required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  financialSubCode?: string;

  @ApiProperty({ description: "Financial Sub Name", example: "HDFC CURRENT A/C", required: false })
  @IsString()
  @IsOptional()
  @MaxLength(250)
  financialSubName?: string;

  @ApiProperty({ description: "Priority/Sort order", example: 1, default: 0, required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  createdAt?: string | Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  updatedAt?: string | Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  createdBy?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  updatedBy?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  financialCodeId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  financialCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  financialType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  financialName?: string;
}

export class UpdateFinancialCodeDto {
  @ApiProperty({ description: "Financial type (from category options)", example: "PROFIT & LOSS", required: false })
  @IsUUID()
  @IsOptional()
  financialType?: string;

  @ApiProperty({ description: "Unique financial code", example: "BANKBL", required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  financialCode?: string;

  @ApiProperty({ description: "Financial name", example: "BANK BALANCES", required: false })
  @IsString()
  @IsOptional()
  @MaxLength(250)
  financialName?: string;

  @ApiProperty({ description: "Default sign", example: "DEBIT", required: false })
  @IsUUID()
  @IsOptional()
  defaultSign?: string;

  @ApiProperty({ description: "Priority/Sort order", example: 1, default: 0, required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ApiProperty({ type: [UpdateFinancialSubProfileNestedDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateFinancialSubProfileNestedDto)
  subProfiles?: UpdateFinancialSubProfileNestedDto[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  createdAt?: string | Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  updatedAt?: string | Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  createdBy?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  updatedBy?: string;
}
