import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCurrencyRateGroupDto {
  @ApiProperty({ example: 'MAJOR', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'Major' })
  @IsString()
  @MaxLength(250)
  name: string;

  @ApiPropertyOptional({ example: 'High volume traded currencies' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
