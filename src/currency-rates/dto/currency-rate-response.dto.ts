import { ApiProperty } from '@nestjs/swagger';
import { CurrencyRate } from '../currency-rate.entity';
import { CurrencyRateProvider } from '../currency-rates.enums';
import { CurrencyResponseDto } from '../../currencies/dto/currency-response.dto';

class UserSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;
}

export class CurrencyRateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  currencyId: string;

  @ApiProperty()
  provider: CurrencyRateProvider;

  @ApiProperty({ required: false, type: () => CurrencyResponseDto })
  currency?: CurrencyResponseDto | null;

  @ApiProperty()
  baseBuyRate: string;

  @ApiProperty()
  baseSaleRate: string;

  @ApiProperty({ required: false, nullable: true })
  baseRate: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false, nullable: true })
  notes: string | null;

  @ApiProperty({ required: false, nullable: true })
  enteredBy?: string | null;

  @ApiProperty({ required: false, type: () => UserSummaryResponseDto })
  enteredByUser?: UserSummaryResponseDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: CurrencyRate): CurrencyRateResponseDto {
    const dto = new CurrencyRateResponseDto();
    dto.id = entity.id;
    dto.currencyId = entity.currencyId;
    dto.provider = entity.provider;
    dto.currency = entity.currency ? CurrencyResponseDto.fromEntity(entity.currency) : null;
    dto.baseBuyRate = entity.baseBuyRate;
    dto.baseSaleRate = entity.baseSaleRate;
    dto.baseRate = entity.baseRate;
    dto.isActive = entity.isActive;
    dto.notes = entity.notes;
    dto.enteredBy = entity.enteredBy;
    dto.enteredByUser = entity.enteredByUser
      ? {
          id: entity.enteredByUser.id,
          code: entity.enteredByUser.code,
          name: entity.enteredByUser.name,
        }
      : null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
