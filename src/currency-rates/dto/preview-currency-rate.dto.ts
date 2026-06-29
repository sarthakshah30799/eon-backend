import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { CurrencyRateProvider } from '../currency-rates.enums';

export class PreviewCurrencyRateDto {
  @ApiProperty()
  @IsUUID()
  currencyId: string;

  @ApiProperty({ enum: CurrencyRateProvider })
  @IsString()
  @IsIn(Object.values(CurrencyRateProvider))
  provider: CurrencyRateProvider;

  @ApiProperty()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'baseBuyRate must be a valid decimal number' })
  baseBuyRate: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'baseSaleRate must be a valid decimal number' })
  baseSaleRate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
