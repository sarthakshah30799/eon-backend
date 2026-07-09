export const PartyProfileCommissionTypeEnum = {
  PERCENTAGE: 'PERCENTAGE',
  PAISA: 'PAISA',
} as const;

export type PartyProfileCommissionType =
  (typeof PartyProfileCommissionTypeEnum)[keyof typeof PartyProfileCommissionTypeEnum];

export interface PartyProfileCommissionRuleValue {
  currencyCode: string;
  productCode: string;
  commissionType: PartyProfileCommissionType;
  commissionValue: string;
}
