import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { CurrencyRateMarginType } from '../currency-rates.enums';

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

  @ApiPropertyOptional({ enum: CurrencyRateMarginType })
  @IsOptional()
  @IsString()
  @IsIn(Object.values(CurrencyRateMarginType))
  buyMarginType?: CurrencyRateMarginType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'buyMarginValue must be a valid decimal number' })
  buyMarginValue?: string;

  @ApiPropertyOptional({ enum: CurrencyRateMarginType })
  @IsOptional()
  @IsString()
  @IsIn(Object.values(CurrencyRateMarginType))
  saleMarginType?: CurrencyRateMarginType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'saleMarginValue must be a valid decimal number' })
  saleMarginValue?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
