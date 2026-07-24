export interface TransactionReferenceSnapshot {
  id: string;
  code?: string | null;
  name?: string | null;
  label?: string | null;
  [key: string]: unknown;
}

export type TransactionReferenceSnapshotValue =
  | TransactionReferenceSnapshot
  | null;

export interface TransactionItemSnapshot extends TransactionReferenceSnapshot {}

export interface TransactionPricingRuleSnapshot {
  id?: string;
  source?: string | null;
  buy?: Record<string, unknown> | null;
  sale?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export type TransactionPricingRuleSnapshotValue =
  | TransactionPricingRuleSnapshot
  | null;

export interface TransactionPassengerSnapshot extends TransactionReferenceSnapshot {
  entityType?: string | null;
  nationalityType?: string | null;
  residentStatus?: TransactionReferenceSnapshotValue;
  country?: TransactionReferenceSnapshotValue;
  state?: TransactionReferenceSnapshotValue;
  location?: TransactionReferenceSnapshotValue;
  city?: string | null;
  address1?: string | null;
  address2?: string | null;
  email?: string | null;
  contactNo?: string | null;
  panNumber?: string | null;
  panHolderName?: string | null;
  panDob?: string | null;
  panHolderRelationType?: string | null;
  paidByPanNumber?: string | null;
  paidByPanHolderName?: string | null;
  paidByPanDob?: string | null;
  gstNumber?: string | null;
  gstState?: TransactionReferenceSnapshotValue;
  passportNumber?: string | null;
  passportIssueAt?: string | null;
  passportIssueDate?: string | null;
  passportExpiryDate?: string | null;
  arrivalDate?: string | null;
  isPep?: boolean | null;
}

export type TransactionPassengerSnapshotValue =
  | TransactionPassengerSnapshot
  | null;

export interface TransactionPassengerTravelSnapshot extends TransactionReferenceSnapshot {
  airlineTt?: TransactionReferenceSnapshotValue;
  ticketNo?: string | null;
  route?: string | null;
  travellingCountry?: TransactionReferenceSnapshotValue;
  noOfDays?: number | null;
  noOfPax?: number | null;
  departureDate?: string | null;
  travelPnr?: string | null;
  visa?: boolean | null;
  isCisCountry?: boolean | null;
}

export type TransactionPassengerTravelSnapshotValue =
  | TransactionPassengerTravelSnapshot
  | null;
