import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

const toNullableNumber = ({ value }: { value: unknown }) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const nextValue = Number(value);
  return Number.isNaN(nextValue) ? value : nextValue;
};

export class CreateCountryGroupDto {
  @ApiProperty({
    description: "Country group name",
    example: "Europe",
    maxLength: 250,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  name: string;

  @ApiPropertyOptional({
    description: "Country group code",
    example: "EUROPE",
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional({ description: "Sell limit amount", example: 1000000 })
  @Transform(toNullableNumber)
  @IsNumber()
  @Min(0)
  @IsOptional()
  sellLimitAmount?: number | null;

  @ApiPropertyOptional({ description: "Sell limit currency UUID" })
  @IsUUID()
  @IsOptional()
  sellLimitCurrencyId?: string | null;

  @ApiPropertyOptional({ description: "Minimum travel days", example: 1 })
  @Transform(toNullableNumber)
  @IsInt()
  @Min(0)
  @IsOptional()
  minTravelDays?: number | null;

  @ApiPropertyOptional({ description: "Maximum travel days", example: 30 })
  @Transform(toNullableNumber)
  @IsInt()
  @Min(0)
  @IsOptional()
  maxTravelDays?: number | null;
}
