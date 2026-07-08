import { ApiProperty } from '@nestjs/swagger';
import { CurrencyRateGroup } from '../currency-rate-group.entity';
import { CurrencyRateMarginType } from '../currency-rates.enums';

export class CurrencyRateGroupResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;

  @ApiProperty({ enum: CurrencyRateMarginType, required: false, nullable: true })
  buyMarginType: CurrencyRateMarginType | null;

  @ApiProperty({ required: false, nullable: true })
  buyMarginValue: string | null;

  @ApiProperty({ enum: CurrencyRateMarginType, required: false, nullable: true })
  saleMarginType: CurrencyRateMarginType | null;

  @ApiProperty({ required: false, nullable: true })
  saleMarginValue: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: CurrencyRateGroup): CurrencyRateGroupResponseDto {
    const dto = new CurrencyRateGroupResponseDto();
    dto.id = entity.id;
    dto.code = entity.code;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.buyMarginType = entity.buyMarginType;
    dto.buyMarginValue = entity.buyMarginValue;
    dto.saleMarginType = entity.saleMarginType;
    dto.saleMarginValue = entity.saleMarginValue;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
