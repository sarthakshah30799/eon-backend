import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCountryGroupDto {
  @ApiProperty({ description: "Country group name", example: "Europe", maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  name: string;

  @ApiPropertyOptional({ description: "Country group code", example: "EUROPE", maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  code?: string;
}
