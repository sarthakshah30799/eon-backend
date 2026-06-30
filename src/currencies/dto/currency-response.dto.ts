import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../currency.entity';
import { Country } from '../../country/country.entity';
import { CurrencyRateGroupResponseDto } from '../../currency-rates/dto/currency-rate-group-response.dto';

export class CurrencyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  countryId: string | null;

  @ApiProperty({ required: false, type: () => Country })
  country?: Country | null;

  @ApiProperty()
  currencyCode: string;

  @ApiProperty()
  currencyName: string;

  @ApiProperty()
  priority: string;

  @ApiProperty()
  ratePer: string;

  @ApiProperty()
  defaultMinRate: string;

  @ApiProperty()
  defaultMaxRate: string;

  @ApiProperty()
  calculationMethod: string;

  @ApiProperty()
  openRatePremium: string;

  @ApiProperty()
  gulfDiscFactor: string;

  @ApiProperty()
  amexMapCode: string;

  @ApiProperty()
  group: string;

  @ApiProperty({ required: false, nullable: true, type: () => CurrencyRateGroupResponseDto })
  pricingGroup?: CurrencyRateGroupResponseDto | null;

  @ApiProperty({ required: false })
  pricingGroupId?: string | null;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  onlyStocking: boolean;

  @ApiProperty()
  productAllowed: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  createdBy?: string;

  @ApiProperty({ required: false })
  updatedBy?: string;

  static fromEntity(entity: Currency): CurrencyResponseDto {
    const dto = new CurrencyResponseDto();
    dto.id = entity.id;
    dto.countryId = entity.country?.id || null;
    dto.country = entity.country || null;
    dto.currencyCode = entity.currencyCode;
    dto.currencyName = entity.currencyName;
    dto.priority = entity.priority;
    dto.ratePer = entity.ratePer;
    dto.defaultMinRate = entity.defaultMinRate;
    dto.defaultMaxRate = entity.defaultMaxRate;
    dto.calculationMethod = entity.calculationMethod;
    dto.openRatePremium = entity.openRatePremium;
    dto.gulfDiscFactor = entity.gulfDiscFactor;
    dto.amexMapCode = entity.amexMapCode;
    dto.group = entity.group;
    dto.pricingGroupId = entity.pricingGroup?.id || null;
    dto.pricingGroup = entity.pricingGroup
      ? {
          id: entity.pricingGroup.id,
          code: entity.pricingGroup.code,
          name: entity.pricingGroup.name,
          description: entity.pricingGroup.description,
          buyMarginType: entity.pricingGroup.buyMarginType,
          buyMarginValue: entity.pricingGroup.buyMarginValue,
          saleMarginType: entity.pricingGroup.saleMarginType,
          saleMarginValue: entity.pricingGroup.saleMarginValue,
          isActive: entity.pricingGroup.isActive,
          createdAt: entity.pricingGroup.createdAt,
          updatedAt: entity.pricingGroup.updatedAt,
        }
      : null;
    dto.active = entity.active;
    dto.onlyStocking = entity.onlyStocking;
    dto.productAllowed = entity.productAllowed;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.createdBy = entity.createdBy;
    dto.updatedBy = entity.updatedBy;
    return dto;
  }
}
