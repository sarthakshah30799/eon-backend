import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CounterListQueryDto {
  @ApiPropertyOptional({
    description: 'Global search across counter no, name, branch code, and branch name',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
