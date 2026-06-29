import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  Matches,
  IsString,
  IsUUID,
  MaxLength,
  Length,
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

  @ApiProperty({ description: 'Unique currency code', example: 'USD', maxLength: 3 })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3, { message: 'Currency Code must be exactly 3 characters' })
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
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'Rate / Per must be a valid decimal number',
  })
  ratePer: string;

  @ApiProperty({ description: 'Default Min Rate', required: false, maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'Default Min Rate must be a valid decimal number',
  })
  defaultMinRate: string;

  @ApiProperty({ description: 'Default Max Rate', required: false, maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'Default Max Rate must be a valid decimal number',
  })
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
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'Open Rate Premium must be a valid decimal number',
  })
  openRatePremium: string;

  @ApiProperty({ description: 'Gulf Disc Factor', required: false, maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'Gulf Disc Factor must be a valid decimal number',
  })
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

  @ApiProperty({ required: false, description: 'Currency pricing group UUID' })
  @IsUUID()
  @IsOptional()
  pricingGroupId?: string;

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
