import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CreateFinancialSubProfileNestedDto {
  @ApiProperty({ description: "Financial Sub Code", example: "HDFCA" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  financialSubCode: string;

  @ApiProperty({ description: "Financial Sub Name", example: "HDFC CURRENT A/C" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  financialSubName: string;

  @ApiProperty({ description: "Priority/Sort order", example: 1, default: 0 })
  @IsInt()
  @Min(0)
  priority: number = 0;

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

export class CreateFinancialCodeDto {
  @ApiProperty({ description: "Financial type (from category options)", example: "PROFIT & LOSS" })
  @IsString()
  @IsNotEmpty()
  financialType: string;

  @ApiProperty({ description: "Unique financial code", example: "BANKBL" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  financialCode: string;

  @ApiProperty({ description: "Financial name", example: "BANK BALANCES" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  financialName: string;

  @ApiProperty({ description: "Default sign", example: "DEBIT" })
  @IsString()
  @IsNotEmpty()
  defaultSign: string;

  @ApiProperty({ description: "Priority/Sort order", example: 1, default: 0 })
  @IsInt()
  @Min(0)
  priority: number = 0;

  @ApiProperty({ type: [CreateFinancialSubProfileNestedDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateFinancialSubProfileNestedDto)
  subProfiles?: CreateFinancialSubProfileNestedDto[];

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
