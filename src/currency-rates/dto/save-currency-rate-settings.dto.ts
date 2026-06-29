import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import {
  CurrencyRateMarginType,
  CurrencyRateProvider,
} from '../currency-rates.enums';

export class SaveCurrencyRateSettingsDto {
  @ApiProperty({ enum: CurrencyRateProvider })
  @IsString()
  @IsIn(Object.values(CurrencyRateProvider))
  defaultProvider: CurrencyRateProvider;

  @ApiProperty({ enum: CurrencyRateMarginType })
  @IsString()
  @IsIn(Object.values(CurrencyRateMarginType))
  buyMarginType: CurrencyRateMarginType;

  @ApiProperty({ example: '0.50' })
  @IsString()
  buyMarginValue: string;

  @ApiProperty({ example: '0.00' })
  @IsString()
  buyMinRate: string;

  @ApiProperty({ example: '999999.00' })
  @IsString()
  buyMaxRate: string;

  @ApiProperty({ enum: CurrencyRateMarginType })
  @IsString()
  @IsIn(Object.values(CurrencyRateMarginType))
  saleMarginType: CurrencyRateMarginType;

  @ApiProperty({ example: '0.50' })
  @IsString()
  saleMarginValue: string;

  @ApiProperty({ example: '0.00' })
  @IsString()
  saleMinRate: string;

  @ApiProperty({ example: '999999.00' })
  @IsString()
  saleMaxRate: string;
}
