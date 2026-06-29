import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import {
  CurrencyRateMarginDirection,
  CurrencyRateMarginType,
  CurrencyRateProvider,
} from '../currency-rates.enums';

export class SaveCurrencyRateMarginDto {
  @ApiProperty({ enum: CurrencyRateMarginType })
  @IsString()
  @IsIn(Object.values(CurrencyRateMarginType))
  marginType: CurrencyRateMarginType;

  @ApiProperty({ example: '0.50' })
  @IsString()
  marginValue: string;

  @ApiProperty({ enum: CurrencyRateMarginDirection })
  @IsString()
  @IsIn(Object.values(CurrencyRateMarginDirection))
  marginDirection: CurrencyRateMarginDirection;

  @ApiProperty({ example: '0.00' })
  @IsString()
  minRate: string;

  @ApiProperty({ example: '999999.00' })
  @IsString()
  maxRate: string;
}

export class SaveCurrencyRateRuleDto {
  @ApiProperty({ type: () => SaveCurrencyRateMarginDto })
  @IsObject()
  buy: SaveCurrencyRateMarginDto;

  @ApiProperty({ type: () => SaveCurrencyRateMarginDto })
  @IsObject()
  sale: SaveCurrencyRateMarginDto;
}

export class SaveCurrencyRateSettingsDto {
  @ApiProperty({ enum: CurrencyRateProvider })
  @IsString()
  @IsIn(Object.values(CurrencyRateProvider))
  defaultProvider: CurrencyRateProvider;

  @ApiProperty({ example: 2, default: 4 })
  @IsInt()
  @Min(0)
  roundingScale: number;

  @ApiProperty({ type: () => SaveCurrencyRateRuleDto })
  @IsObject()
  global: SaveCurrencyRateRuleDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  groups?: Record<string, SaveCurrencyRateRuleDto>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  currencyOverrides?: Record<string, SaveCurrencyRateRuleDto>;
}
