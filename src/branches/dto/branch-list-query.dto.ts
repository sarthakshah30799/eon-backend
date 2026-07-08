import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BranchListQueryDto {
  @ApiPropertyOptional({ description: 'Global search across branch code, name, city, state, and country' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Whether to return only active branches', default: true })
  @IsOptional()
  activeOnly?: boolean;
}
