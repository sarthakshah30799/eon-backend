import { ApiProperty } from "@nestjs/swagger";
import { PartyProfileCommissionType } from "../types/party-profile-commission-rule.types";

export class PartyProfileCommissionRuleResponseDto {
  @ApiProperty()
  currencyCode: string;

  @ApiProperty({ required: false })
  currencyName?: string | null;

  @ApiProperty()
  productCode: string;

  @ApiProperty({ required: false })
  productDescription?: string | null;

  @ApiProperty({ enum: ["PERCENTAGE", "PAISA"] })
  commissionType: PartyProfileCommissionType;

  @ApiProperty()
  commissionValue: string;

  static fromValue(value: {
    currencyCode: string;
    currencyName?: string | null;
    productCode: string;
    productDescription?: string | null;
    commissionType: PartyProfileCommissionType;
    commissionValue: string;
  }) {
    const dto = new PartyProfileCommissionRuleResponseDto();
    dto.currencyCode = value.currencyCode;
    dto.currencyName = value.currencyName ?? null;
    dto.productCode = value.productCode;
    dto.productDescription = value.productDescription ?? null;
    dto.commissionType = value.commissionType;
    dto.commissionValue = value.commissionValue;
    return dto;
  }
}

