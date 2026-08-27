import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CurrencyListQueryDto {
  @ApiPropertyOptional({
    description: 'Global search across currency code, currency name, and country name',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by country name (partial match, case-insensitive)', example: 'India' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Filter by country ID (UUID)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsOptional()
  countryId?: string;

  @ApiPropertyOptional({ description: 'Filter by currency group: ASIA | AFRICA | EUROPE | GULF', enum: ['ASIA', 'AFRICA', 'EUROPE', 'GULF'], example: 'ASIA' })
  @IsString()
  @IsOptional()
  group?: string;

  @ApiPropertyOptional({ description: 'Filter by pricing group ID (UUID)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsOptional()
  pricingGroupId?: string;

  @ApiPropertyOptional({ description: 'Filter by pricing group (alias for pricingGroupId)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsOptional()
  pricingGroup?: string;

  @ApiPropertyOptional({ description: 'Filter by status: active | inactive | all', enum: ['active', 'inactive', 'all'], example: 'active' })
  @IsString()
  @IsOptional()
  status?: string;

  // Deprecated: kept for backward compatibility, use `status` instead
  @ApiPropertyOptional({ description: 'Deprecated: use status instead', example: true })
  @IsString()
  @IsOptional()
  activeOnly?: string | boolean;
}
