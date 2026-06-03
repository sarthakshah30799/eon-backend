import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  MaxLength,
} from "class-validator";
import { CategoryOptionCodeEnum } from "../category-option-code.enum";

export class CreateSelectOptionDto {
  @ApiProperty({
    description: "Lookup code grouping the options",
    enum: CategoryOptionCodeEnum,
    example: CategoryOptionCodeEnum.LocationType,
    maxLength: 100,
  })
  @IsEnum(CategoryOptionCodeEnum)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @ApiProperty({ description: "Stored option value", example: "branch" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  value: string;

  @ApiProperty({ description: "Human readable option label", example: "Branch" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  label: string;

  @ApiPropertyOptional({ description: "Sort order", default: 0 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: "Whether this option is active", default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
