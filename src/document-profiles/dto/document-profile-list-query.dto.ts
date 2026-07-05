import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsNumber, Min } from 'class-validator';

const parseBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class DocumentProfileListQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  page?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
