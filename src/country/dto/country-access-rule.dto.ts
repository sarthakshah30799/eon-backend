import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";

export class CountryAccessRuleInputDto {
  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty()
  @IsUUID()
  userId: string;
}

export class CreateCountryAccessRulesDto {
  @ApiProperty({ type: [CountryAccessRuleInputDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CountryAccessRuleInputDto)
  rules: CountryAccessRuleInputDto[];
}

export class CreateCountryBlockDto {
  @ApiProperty()
  @IsBoolean()
  isBlocked: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  blockedReason?: string | null;
}

export class CountryAccessRuleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  countryId: string;

  @ApiProperty()
  branchId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  revokedAt?: Date | null;

  @ApiPropertyOptional()
  revokedBy?: string | null;
}

export class CountryAccessRuleWithNamesResponseDto extends CountryAccessRuleResponseDto {
  @ApiPropertyOptional()
  branchName?: string | null;

  @ApiPropertyOptional()
  userName?: string | null;
}
