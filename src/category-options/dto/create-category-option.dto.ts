import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
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
  @Transform(({ value }) =>
    typeof value === "string"
      ? value.trim().replace(/[_\s-]/g, "").toUpperCase()
      : value
  )
  @IsEnum(CategoryOptionCodeEnum)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @ApiProperty({ description: "Stored option value", example: "BRANCH" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  value: string;

  @ApiProperty({ description: "Human readable option label", example: "BRANCH" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value
  )
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
