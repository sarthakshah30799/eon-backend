export const PartyProfileCommissionTypeEnum = {
  PERCENTAGE: 'PERCENTAGE',
  PAISA: 'PAISA',
} as const;

export type PartyProfileCommissionType =
  (typeof PartyProfileCommissionTypeEnum)[keyof typeof PartyProfileCommissionTypeEnum];

export interface PartyProfileCommissionRuleValue {
  currencyCode: string;
  currencyName?: string | null;
  productCode: string;
  productDescription?: string | null;
  commissionType: PartyProfileCommissionType;
  commissionValue: string;
}

