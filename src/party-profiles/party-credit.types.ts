import { TransactionType } from "../transactions/transactions.enums";

export type PartyCreditPreviewResponse = {
  allowed: boolean;
  ruleType:
    | "OK"
    | "OUTSTANDING_NOT_ALLOWED"
    | "CREDIT_LIMIT_EXCEEDED"
    | "CREDIT_DAYS_OVER"
    | "CREDIT_NOT_CONFIGURED";
  blockingReason: string | null;
  blockingReasons: string[];
  outstandingAllowed: boolean;
  creditConfigured: boolean;
  applicableCreditLimit: string;
  applicableCreditDays: number | null;
  existingOutstanding: string;
  currentOutstanding: string;
  totalExposure: string;
  availableCredit: string;
  payableAmount: string;
  totalPaid: string;
};

export type PartyCreditValidationInput = {
  partyProfileId: string;
  transactionType: TransactionType;
  transactionDate: string | Date;
  payableAmount: number;
  payments?: Array<{ amount?: string | number | null }> | null;
  excludeTransactionId?: string | null;
  /**
   * Outstanding bills: selected party + passenger id (else PAN) + sale/purchase type.
   * Branch is not applied. PAN separates different individuals on the same party profile.
   */
  passengerId?: string | null;
  panNumber?: string | null;
};

export type PartyCreditProfile = {
  permanentCreditLimit?: number | string | null;
  permanentCreditDays?: number | string | null;
  temporaryCreditLimit?: number | string | null;
  temporaryCreditDays?: number | string | null;
};
