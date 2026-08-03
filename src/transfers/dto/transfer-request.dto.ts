import { CurrencyTransferType } from '../transfers.enums';

export type TransferRequestItemPayload = {
  currencyId: string;
  productId: string;
  quantity: string | number;
  per: string | number;
  rate: string | number;
  rateEditable?: boolean | null;
  amount?: string | number | null;
  roundOff?: string | number | null;
  finalAmount?: string | number | null;
  remarks?: string | null;
};

export type CreateTransferRequestPayload = {
  transferType: CurrencyTransferType;
  transactionDate?: string | null;
  billReference: string;
  sourceBranchId?: string | null;
  sourceCounterId?: string | null;
  destinationBranchId?: string | null;
  destinationCounterId?: string | null;
  remarks?: string | null;
  items?: TransferRequestItemPayload[];
};
