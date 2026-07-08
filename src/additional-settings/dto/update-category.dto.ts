import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsArray, ValidateNested, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { CreateSubcategoryDto } from "./create-category.dto";

export class UpdateCategoryDto {
  @ApiProperty({ example: "Remittance Settings Updated" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: "PASSWORD_POLICY" })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ type: [CreateSubcategoryDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateSubcategoryDto)
  subcategories?: CreateSubcategoryDto[];
}
