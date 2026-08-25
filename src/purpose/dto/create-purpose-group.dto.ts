import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PurposeGroupProfileType } from '../purpose.enums';

export class CreatePurposeGroupDto {
  @ApiProperty({ description: 'Purpose group name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Report line title shown in FLM 8 sell section' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: PurposeGroupProfileType })
  @IsEnum(PurposeGroupProfileType)
  profileType: PurposeGroupProfileType;

  @ApiProperty({
    description: 'Sort order used as the FLM 8 sell-section row order. Lower numbers appear first.',
    default: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiProperty({ type: [String], description: 'Sell purpose ids in this group' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  purposeIds: string[];
}
