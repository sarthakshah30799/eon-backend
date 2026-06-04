import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  CurrencyCalculationMethod,
  CurrencyGroup,
  CurrencyProductAllowed,
} from '../currency.entity';

export class CreateCurrencyDto {
  @ApiProperty({ description: 'Country ID (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  countryId: string;

  @ApiProperty({ description: 'Unique currency code', example: 'USD', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  currencyCode: string;

  @ApiProperty({ description: 'Currency name', example: 'US Dollar', maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  currencyName: string;

  @ApiProperty({ description: 'Priority', required: false, maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  priority: string;

  @ApiProperty({ description: 'Rate / Per', required: false, maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  ratePer: string;

  @ApiProperty({ description: 'Default Min Rate', required: false, maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  defaultMinRate: string;

  @ApiProperty({ description: 'Default Max Rate', required: false, maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  defaultMaxRate: string;

  @ApiProperty({ enum: CurrencyCalculationMethod, default: CurrencyCalculationMethod.MULTIPLICATION })
  @IsString()
  @IsNotEmpty()
  @IsIn(Object.values(CurrencyCalculationMethod))
  calculationMethod: CurrencyCalculationMethod;

  @ApiProperty({ description: 'Open Rate Premium', required: false, maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  openRatePremium: string;

  @ApiProperty({ description: 'Gulf Disc Factor', required: false, maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  gulfDiscFactor: string;

  @ApiProperty({ description: 'Amex Map Code', required: false, maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  amexMapCode: string;

  @ApiProperty({ enum: CurrencyGroup, default: CurrencyGroup.ASIA })
  @IsString()
  @IsNotEmpty()
  @IsIn(Object.values(CurrencyGroup))
  group: CurrencyGroup;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  onlyStocking?: boolean;

  @ApiProperty({ enum: CurrencyProductAllowed, required: false, default: '' })
  @IsString()
  @IsOptional()
  @IsIn([...Object.values(CurrencyProductAllowed), ''])
  productAllowed?: CurrencyProductAllowed | '';
}
