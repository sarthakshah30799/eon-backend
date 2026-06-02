import { ApiProperty } from "@nestjs/swagger";
import { Country, CountryRiskCategory } from "../country.entity";

export class CountryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  lrsCountryCode: string;

  @ApiProperty({ required: false })
  ctrCountryCode: string;

  @ApiProperty({ enum: CountryRiskCategory })
  riskCategory: CountryRiskCategory;

  @ApiProperty()
  restrictedCountry: boolean;

  @ApiProperty()
  greyListCountry: boolean;

  @ApiProperty()
  baseCountry: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: Country): CountryResponseDto {
    const dto = new CountryResponseDto();
    dto.id = entity.id;
    dto.code = entity.code;
    dto.name = entity.name;
    dto.lrsCountryCode = entity.lrsCountryCode;
    dto.ctrCountryCode = entity.ctrCountryCode;
    dto.riskCategory = entity.riskCategory;
    dto.restrictedCountry = entity.restrictedCountry;
    dto.greyListCountry = entity.greyListCountry;
    dto.baseCountry = entity.baseCountry;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
