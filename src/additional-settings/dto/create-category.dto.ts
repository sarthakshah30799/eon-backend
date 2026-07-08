import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsArray, ValidateNested, IsEnum } from "class-validator";
import { Type } from "class-transformer";
import { ValueType } from "../advanced-setting.entity";

export class CreateSubcategoryDto {
  @ApiProperty({ example: "Activate Direct Remittance" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: "ACTIVATE_DIRECT_REMITTANCE" })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: "NO" })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({ enum: ValueType, example: ValueType.Boolean })
  @IsEnum(ValueType)
  valueType: ValueType;
}

export class CreateCategoryDto {
  @ApiProperty({ example: "Remittance Settings" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: "REMITTANCE_SETTINGS" })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ type: [CreateSubcategoryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSubcategoryDto)
  subcategories: CreateSubcategoryDto[];
}
