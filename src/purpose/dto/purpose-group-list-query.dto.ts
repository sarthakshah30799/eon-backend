import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PurposeGroupProfileType } from '../purpose.enums';

export class PurposeGroupListQueryDto {
  @ApiPropertyOptional({ description: 'Search name or title' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: PurposeGroupProfileType })
  @IsEnum(PurposeGroupProfileType)
  @IsOptional()
  profileType?: PurposeGroupProfileType;
}
