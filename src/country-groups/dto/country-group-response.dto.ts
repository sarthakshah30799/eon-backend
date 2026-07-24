import { ApiProperty } from "@nestjs/swagger";
import { CountryGroup } from "../country-group.entity";
import { CurrencyResponseDto } from "../../currencies/dto/currency-response.dto";

export class CountryGroupResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true, type: () => CurrencyResponseDto })
  sellLimitCurrency?: CurrencyResponseDto | null;

  @ApiProperty({ required: false, nullable: true })
  sellLimitCurrencyId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  sellLimitAmount?: string | null;

  @ApiProperty({ required: false, nullable: true })
  minTravelDays?: number | null;

  @ApiProperty({ required: false, nullable: true })
  maxTravelDays?: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: CountryGroup): CountryGroupResponseDto {
    const dto = new CountryGroupResponseDto();
    dto.id = entity.id;
    dto.code = entity.code;
    dto.name = entity.name;
    dto.sellLimitCurrencyId = entity.sellLimitCurrencyId;
    dto.sellLimitAmount = entity.sellLimitAmount;
    dto.minTravelDays = entity.minTravelDays;
    dto.maxTravelDays = entity.maxTravelDays;
    dto.sellLimitCurrency = entity.sellLimitCurrency
      ? CurrencyResponseDto.fromEntity(entity.sellLimitCurrency)
      : null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
