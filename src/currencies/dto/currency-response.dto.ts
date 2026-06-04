import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../currency.entity';

export class CurrencyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  countryId: string | null;

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
