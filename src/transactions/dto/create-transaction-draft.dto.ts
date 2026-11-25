import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  TransactionType,
  TradeMode,
  TransactionPaymentMethod,
  TransactionPaymentDirection,
  TransactionDocumentStatus,
} from "../transactions.enums";
import { TransactionSettlementSource } from "../../vouchers/voucher.enums";
import {
  PassengerEntityType,
  PassengerNationalityType,
  PassengerOtherIdProofType,
} from "../../passengers/passenger.entity";
import {
  PurposePartyProfileType,
  PurposeRateType,
} from "../../purpose/purpose.enums";

/** Transform helper to handle both multipart stringified JSON and raw JSON objects */
export const TransformJsonField = () =>
  Transform(({ value }) => {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  });

/** Matches otherDocuments schema in purchaseSchema.ts:374-415 */
export class TransactionPassengerOtherDocumentPayloadDto {
  @ApiProperty({ enum: PassengerOtherIdProofType })
  @IsEnum(PassengerOtherIdProofType)
  documentType: PassengerOtherIdProofType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  validTill?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  issueAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  issueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expiryDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string | null;
}

/** Matches passenger schema & conditional rules in purchaseSchema.ts:492-750 */
export class TransactionPassengerPayloadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string | null;

  @ApiProperty({ enum: PassengerEntityType })
  @IsEnum(PassengerEntityType)
  entityType: PassengerEntityType;

  @ApiProperty({ enum: PassengerNationalityType })
  @IsEnum(PassengerNationalityType)
  nationalityType: PassengerNationalityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residentStatus?: string | null;

  @ApiProperty()
  @IsUUID()
  countryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  stateId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  locationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address1?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address2?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactNo?: string | null;

  // Conditional PAN requirements (Indian / Corporate)
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, {
    message: "PAN must be a valid 10-character Indian PAN",
  })
  panNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  panHolderName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  panDob?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  panHolderRelationType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paidByPanNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paidByPanHolderName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paidByPanDob?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gstStateId?: string | null;

  // Conditional Passport requirements (NRI / Foreigner / Travel)
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{8}$/i, {
    message: "Passport number must be 8 alphanumeric characters",
  })
  passportNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passportPassengerName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passportIssueAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  passportIssueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  passportExpiryDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  arrivalDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPep?: boolean;

  @ApiPropertyOptional({
    type: () => [TransactionPassengerOtherDocumentPayloadDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionPassengerOtherDocumentPayloadDto)
  otherDocuments?: TransactionPassengerOtherDocumentPayloadDto[];
}

/** Matches passengerTravel schema in purchaseSchema.ts & purchaseUtils.ts:1022-1045 */
export class TransactionPassengerTravelPayloadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  airlineTtId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ticketNo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  route?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  travellingCountryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  noOfDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  noOfPax?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  departureDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  travelPnr?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  visa?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCisCountry?: boolean;
}

/** Matches tourPassengers schema in purchaseSchema.ts:933-955 & tour-passenger.helpers.ts */
export class TourPassengerItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  lineNo?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passportNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passportName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placeOfIssue?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfIssue?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfExpiry?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  panHolderRelationship?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  travellerPanNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  panName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  travellerDob?: string | null;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fcnCode: string;

  @ApiProperty()
  @IsNotEmpty()
  fcnAmount: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactNo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remark?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  otherAdExchangeDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  otherAdNameAddress?: string | null;
}

/** Matches transaction items schema in purchaseSchema.ts:89-281 */
export class TransactionItemPayloadDto {
  @ApiProperty()
  @IsUUID()
  currencyId: string;

  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsNotEmpty()
  quantity: string | number;

  @ApiProperty()
  @IsNotEmpty()
  per: string | number;

  @ApiProperty()
  @IsNotEmpty()
  rate: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  commission?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  commissionSnapshot?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  pricingRuleSnapshot?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string | null;

  // Card & Surrender product linkages
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cardId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  issuerPartyProfileId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  issuerPartyProfileSnapshot?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  cardSnapshot?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isReload?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSurrender?: boolean;

  // TT Outward Remittance deal cover linkages
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  dealCoverId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  dealCoverSnapshot?: Record<string, unknown> | null;
}

/** Matches payment detail schema in purchaseSchema.ts:292-367 */
export class TransactionPaymentPayloadDto {
  @ApiPropertyOptional({ enum: ["NORMAL", "ADVANCE"] })
  @IsOptional()
  @IsEnum(["NORMAL", "ADVANCE"])
  settlementSource?: TransactionSettlementSource | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  advanceVoucherId?: string | null;

  @ApiProperty({ enum: TransactionPaymentMethod })
  @IsEnum(TransactionPaymentMethod)
  paymentMethod: TransactionPaymentMethod;

  @ApiPropertyOptional({ enum: TransactionPaymentDirection })
  @IsOptional()
  @IsEnum(TransactionPaymentDirection)
  paymentDirection?: TransactionPaymentDirection;

  @ApiProperty()
  @IsUUID()
  accountId: string;

  @ApiProperty()
  @IsNotEmpty()
  amount: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  chequePageId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  chequePageSnapshot?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chequeNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  referenceDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  chequeDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  drawnOn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string | null;

  @ApiPropertyOptional({ description: "Bank clearance date YYYY-MM-DD" })
  @IsOptional()
  @IsDateString()
  bankDate?: string | null;

  @ApiPropertyOptional({ description: "Cheque return / dishonor" })
  @IsOptional()
  @IsBoolean()
  isDishonored?: boolean | null;

  @ApiPropertyOptional({ description: "Required when isDishonored is true" })
  @ValidateIf(
    (row: TransactionPaymentPayloadDto) => Boolean(row.isDishonored),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reversalNumber?: string | null;
}

/** Matches additional charges in purchaseSchema.ts:283-290 */
export class TransactionAdditionalChargePayloadDto {
  @ApiProperty()
  @IsUUID()
  accountId: string;

  @ApiProperty()
  @IsNotEmpty()
  amount: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  gstRate?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  gstAmount?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  applyTax?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string | null;
}

/** Matches TT Remittance payload in purchaseUtils.ts:1091-1120 */
export class TransactionTtRemittancePayloadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  remitterName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remitterAddress?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remitterCity?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  remitterCountryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remitterEntityType?: string | null;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  beneficiaryName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  beneficiaryAddress?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  beneficiaryCountryId?: string | null;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAddress?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iban?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  swiftCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bsbCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  educationDetails?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fbBearerOptionId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  intermediaryBankName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  intermediaryBankAddress?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  intermediaryBankCodes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relationship?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sponsorshipName?: string | null;
}

/** Matches attached documents schema */
export class TransactionDocumentPayloadDto {
  @ApiProperty()
  @IsUUID()
  documentProfileId: string;

  @ApiPropertyOptional({ enum: TransactionDocumentStatus })
  @IsOptional()
  @IsEnum(TransactionDocumentStatus)
  status?: TransactionDocumentStatus | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string | null;
}

/** Root Transaction draft payload produced by mapPurchaseFormValuesToSubmitPayload */
export class TransactionDraftDataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  counterId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  branchSnapshot?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  transactionDate?: string | null;

  @ApiProperty()
  @IsUUID()
  partyProfileId: string;

  @ApiPropertyOptional({ enum: PurposePartyProfileType })
  @IsOptional()
  @IsEnum(PurposePartyProfileType)
  transactionPartyProfileType?: PurposePartyProfileType | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  purposeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agentProfileId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  manualBookPageId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  manualBookPageSnapshot?: Record<string, unknown> | null;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @ApiProperty({ enum: TradeMode })
  @IsEnum(TradeMode)
  tradeMode: TradeMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string | null;

  // Regulatory TCS & CDF fields
  @ApiPropertyOptional()
  @IsOptional()
  loanAmount?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  declaredAmount?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  preTcsFinalAmount?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  tcsRatePercent?: string | number | null;

  @ApiPropertyOptional({ enum: PurposeRateType })
  @IsOptional()
  @IsEnum(PurposeRateType)
  tcsRateType?: PurposeRateType | null;

  @ApiPropertyOptional()
  @IsOptional()
  tcsAmount?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  itrFiled?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tcsDeclarationAccepted?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isProprietorship?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cdfNo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cdfIssuingAuthority?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  cdfApprovedUsd?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  cdfArrivalDate?: string | null;

  // Nested structures
  @ApiPropertyOptional({ type: () => TransactionPassengerPayloadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TransactionPassengerPayloadDto)
  passenger?: TransactionPassengerPayloadDto | null;

  @ApiPropertyOptional({ type: () => TransactionPassengerTravelPayloadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TransactionPassengerTravelPayloadDto)
  passengerTravel?: TransactionPassengerTravelPayloadDto | null;

  @ApiProperty({ type: () => [TransactionItemPayloadDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionItemPayloadDto)
  items: TransactionItemPayloadDto[];

  @ApiPropertyOptional({ type: () => [TourPassengerItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TourPassengerItemDto)
  tourPassengers?: TourPassengerItemDto[];

  @ApiPropertyOptional({ type: () => [TransactionDocumentPayloadDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionDocumentPayloadDto)
  documents?: TransactionDocumentPayloadDto[];

  @ApiPropertyOptional({ type: () => [TransactionAdditionalChargePayloadDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionAdditionalChargePayloadDto)
  additionalCharges?: TransactionAdditionalChargePayloadDto[];

  @ApiPropertyOptional({ type: () => [TransactionPaymentPayloadDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionPaymentPayloadDto)
  payments?: TransactionPaymentPayloadDto[];

  @ApiPropertyOptional({ type: () => TransactionTtRemittancePayloadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TransactionTtRemittancePayloadDto)
  ttRemittance?: TransactionTtRemittancePayloadDto | null;
}

/** Wrapper DTO for createDraft multipart request payload */
export class CreateTransactionDraftDto {
  @ApiPropertyOptional({ type: () => TransactionDraftDataDto })
  @TransformJsonField()
  @IsOptional()
  @ValidateNested()
  @Type(() => TransactionDraftDataDto)
  transaction?: TransactionDraftDataDto;

  @ApiPropertyOptional()
  @IsOptional()
  @TransformJsonField()
  @IsArray()
  attachments?: Array<{ documentProfileId: string; fileName?: string }>;

  [key: string]: any;
}
