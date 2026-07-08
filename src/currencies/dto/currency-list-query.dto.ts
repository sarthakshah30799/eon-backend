import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CurrencyListQueryDto {
  @ApiPropertyOptional({
    description: 'Global search across currency code, currency name, and country name',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
