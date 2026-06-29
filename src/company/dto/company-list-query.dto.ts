import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CompanyListQueryDto {
  @ApiPropertyOptional({ description: 'Global search across company name, code, PAN, CIN, and email' })
  @IsString()
  @IsOptional()
  search?: string;
}
