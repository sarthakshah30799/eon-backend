import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TdsProfileListQueryDto {
  @ApiPropertyOptional({ description: 'Global search across code, name, value, and sort order' })
  @IsString()
  @IsOptional()
  search?: string;
}
