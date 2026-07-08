import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { CurrencyRateMarginType } from '../currency-rates.enums';

export class CreateProductCurrencyRateDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsUUID()
  currencyId: string;

  @ApiProperty({ enum: CurrencyRateMarginType })
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsString()
  @IsIn(Object.values(CurrencyRateMarginType))
  buyMarginType?: CurrencyRateMarginType;

  @ApiProperty()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'buyMarginValue must be a valid decimal number' })
  buyMarginValue?: string;

  @ApiProperty()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'buyMinRate must be a valid decimal number' })
  buyMinRate?: string;

  @ApiProperty()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'buyMaxRate must be a valid decimal number' })
  buyMaxRate?: string;

  @ApiProperty({ enum: CurrencyRateMarginType })
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsString()
  @IsIn(Object.values(CurrencyRateMarginType))
  saleMarginType?: CurrencyRateMarginType;

  @ApiProperty()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'saleMarginValue must be a valid decimal number' })
  saleMarginValue?: string;

  @ApiProperty()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'saleMinRate must be a valid decimal number' })
  saleMinRate?: string;

  @ApiProperty()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'saleMaxRate must be a valid decimal number' })
  saleMaxRate?: string;

  @ApiProperty({ default: true, required: false })
  @IsBoolean()
  isActive?: boolean;
}
