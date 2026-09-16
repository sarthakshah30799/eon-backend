export type AccountPostingCombinedDocumentKind = "TRANSACTION" | "VOUCHER";

export type AccountPostingCombinedRow = {
  documentKind: AccountPostingCombinedDocumentKind;
  postingId: string;
  documentId: string;
  documentNumber: string | null;
  documentType: string;
  transactionDate: string;
  branchId: string;
  accountId: string;
  accountSnapshot: Record<string, unknown> | null;
  profileId: string | null;
  profileSnapshot: Record<string, unknown> | null;
  direction: "DEBIT" | "CREDIT";
  amount: string;
  remarks: string | null;
  lineNo: number;
  sourceType: string;
  sourceId: string | null;
  linkedTransactionId: string | null;
  createdAt: string;
  partySnapshot: Record<string, unknown> | null;
  narration: string | null;
  chequeNumber: string | null;
  chequeDate: string | null;
  tradeMode: string | null;
};

export type AccountPostingsCombinedQueryInput = {
  branchIds?: string[];
  accountIds?: string[];
  documentNumbers?: string[];
  startDate?: string;
  endDate?: string;
  beforeDate?: string;
};
