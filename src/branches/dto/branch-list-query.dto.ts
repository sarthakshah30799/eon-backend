import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BranchListQueryDto {
  @ApiPropertyOptional({ description: 'Global search across branch code, name, city, state, and country' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by city (partial match, case-insensitive)', example: 'Pune' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'Filter by state name (partial match, case-insensitive)', example: 'Maharashtra' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ description: 'Filter by status: active | inactive | all', enum: ['active', 'inactive', 'all'], example: 'active' })
  @IsString()
  @IsOptional()
  status?: string;
}
