import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, ObjectLiteral, Repository } from "typeorm";
import { MailService } from "../mail/mail.service";
import { TransactionLog } from "./entities/transaction-log.entity";
import { Transaction } from "./entities/transaction.entity";
import {
  TransactionLogAction,
  TransactionDocumentStatus,
  TransactionPaymentMethod,
  TransactionPaymentDirection,
  TransactionStatus,
  TransactionType,
} from "./transactions.enums";
import { RecordTransactionPrintDto } from "./dto/record-transaction-print.dto";
import { TransactionListQueryDto } from "./dto/transaction-list-query.dto";
import {
  applyPagination,
  buildPaginatedResponse,
  normalizePagination,
  type PaginatedResponseDto,
} from "../common/pagination";
import { TransactionItem } from "./entities/transaction-item.entity";
import { TransactionDocument } from "./entities/transaction-document.entity";
import { TransactionAdditionalCharge } from "./entities/transaction-additional-charge.entity";
import { TransactionPayment } from "./entities/transaction-payment.entity";
import { TransactionAd1 } from "./entities/transaction-ad1.entity";
import { TransactionPassengerOtherDocument } from "./entities/transaction-passenger-other-document.entity";
import { PassengerOtherIdProofType } from "../passengers/passenger.entity";
import { Currency } from "../currencies/currency.entity";
import { Product } from "../products/product.entity";
import { ProductCardIssuer } from "../products/entities/product-card-issuer.entity";
import { DocumentProfile } from "../document-profiles/document-profile.entity";
import { StorageService } from "../storage/storage.service";
import { Purpose } from "../purpose/purpose.entity";
import {
  PurposePartyProfileType,
  PurposeRateType,
} from "../purpose/purpose.enums";
import { PurposeResponseDto } from "../purpose/dto/purpose-response.dto";
import {
  TransactionPassengerSnapshotValue,
  TransactionPassengerTravelSnapshotValue,
  TransactionReferenceSnapshotValue,
} from "./types/transaction-snapshot.types";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { PartyProfile } from "../party-profiles/party-profile.entity";
import { Passenger } from "../passengers/passenger.entity";
import {
  PassengerEntityType,
  PassengerNationalityType,
} from "../passengers/passenger.entity";
import { SelectOption } from "../category-options/category-option.entity";
import { Country } from "../country/country.entity";
import { State } from "../state/state.entity";
import { CompanyService } from "../company/company.service";
import { Branch } from "../branches/branch.entity";
import { BranchCounter } from "../branches/entities/branch-counter.entity";
import { assertCounterBelongsToBranch } from "../branches/branch-counter.access";
import { Counter } from "../counters/counter.entity";
import { User } from "../users/user.entity";
import { ManualBookPageTracking } from "../manual-bill-books/entities/manual-book-page-tracking.entity";
import { ChequeBookPageTracking } from "../chequebooks/entities/cheque-book-page-tracking.entity";
import { loadEntitySnapshot } from "../common/snapshot/entity-snapshot.util";
import { requireCompanyForDate } from "../common/snapshot/company-snapshot.util";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { PurchaseRuleService } from "./purchase-rule.service";
import {
  resolveProductTransactionAccount,
  roundMoney,
} from "./transaction-accounting.util";
import {
  isCorporateIndividualTransactionContext,
  isCorporateIndividualTransactionSlug,
  normalizeTransactionSlug,
} from "./transaction-slug.util";
import { TransactionEvent } from "./entities/transaction-event.entity";
import {
  TransactionEventStatus,
  TransactionEventType,
} from "./transactions.enums";
import { DeepPartial } from "typeorm";
import { DayEndStartProcessService } from "../day-end-start-process/day-end-start-process.service";
import { CountryService } from "../country/country.service";
import { CardStockCard } from "../card-stock/entities/card-stock-card.entity";
import { CardStockSaleLifecycleService } from "../card-stock/card-stock-sale-lifecycle.service";
import {
  isCardProductCode,
  isMultiCurrencyCardProduct,
} from "../card-stock/card-product.util";
import { VoucherService } from "../vouchers/voucher.service";
import { AdvanceApplicationPayloadDto } from "../vouchers/dto/voucher.dto";
import { TransactionSettlementSource } from "../vouchers/voucher.enums";

type UploadedDraftFile = {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type TransactionPassengerOtherDocumentPayload = {
  documentType: string;
  documentNumber: string;
  validTill?: string | null;
  issueAt?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  documentFile?: string | null;
  remarks?: string | null;
};

type TransactionPassengerPayload = {
  entityType: string;
  nationalityType: string;
  residentStatus: string;
  countryId: string;
  stateId?: string | null;
  locationId?: string | null;
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
  gstStateId?: string | null;
  passportNumber?: string | null;
  passportIssueAt?: string | null;
  passportIssueDate?: string | null;
  passportExpiryDate?: string | null;
  arrivalDate?: string | null;
  isPep?: boolean | null;
  otherDocuments?: TransactionPassengerOtherDocumentPayload[];
};

type TransactionPassengerTravelPayload = {
  airlineTtId?: string | null;
  ticketNo?: string | null;
  route?: string | null;
  travellingCountryId?: string | null;
  noOfDays?: number | null;
  noOfPax?: number | null;
  departureDate?: string | null;
  travelPnr?: string | null;
  visa?: boolean | null;
  isCisCountry?: boolean | null;
};

const parseDateValue = (value?: string | null) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizePassengerIdentity = (value?: string | null) => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
  return normalized || null;
};

const hasPassengerIdentityText = (value?: string | null) =>
  Boolean(String(value ?? "").trim());

const hasCompletePassengerPan = (
  passenger?: TransactionPassengerPayload | null,
) =>
  Boolean(
    passenger &&
    hasPassengerIdentityText(passenger.panNumber) &&
    hasPassengerIdentityText(passenger.panHolderName) &&
    hasPassengerIdentityText(passenger.panDob),
  );

const hasCompletePassengerPassport = (
  passenger?: TransactionPassengerPayload | null,
) =>
  Boolean(
    passenger &&
    hasPassengerIdentityText(passenger.passportNumber) &&
    hasPassengerIdentityText(passenger.passportIssueAt) &&
    hasPassengerIdentityText(passenger.passportIssueDate) &&
    hasPassengerIdentityText(passenger.passportExpiryDate),
  );

const addMonthsUtc = (date: Date, months: number) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

type TransactionItemPayload = {
  currencyId: string;
  productId: string;
  currencyRateId?: string | null;
  productCurrencyRateId?: string | null;
  quantity: string | number;
  per: string | number;
  rate: string | number;
  commission?: string | null;
  commissionSnapshot?: Record<string, unknown> | null;
  currencyRateSnapshot?: Record<string, unknown> | null;
  productCurrencyRateSnapshot?: Record<string, unknown> | null;
  pricingRuleSnapshot?: Record<string, unknown> | null;
  remarks?: string | null;
  cardId?: string | null;
  issuerPartyProfileId?: string | null;
  issuerPartyProfileSnapshot?: Record<string, unknown> | null;
  cardSnapshot?: Record<string, unknown> | null;
  isReload?: boolean;
  passengerId?: string | null;
};

type TransactionDocumentPayload = {
  documentProfileId: string;
  status?: TransactionDocumentStatus | null;
  remarks?: string | null;
};

type TransactionAdditionalChargePayload = {
  accountId: string;
  amount: string | number;
  gstRate?: string | null;
  gstAmount?: string | null;
  applyTax?: boolean;
  remarks?: string | null;
};

type TransactionPaymentPayload = {
  accountId: string;
  paymentMethod: TransactionPaymentMethod;
  paymentDirection?: TransactionPaymentDirection;
  referenceNumber?: string | null;
  referenceDate?: string | null;
  branchName?: string | null;
  drawnOn?: string | null;
  chequePageId?: string | null;
  chequePageSnapshot?: Record<string, unknown> | null;
  amount: string | number;
  remarks?: string | null;
  settlementSource?: TransactionSettlementSource | null;
  advanceVoucherId?: string | null;
};

const normalizeNullableString = (value?: string | null) => {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
};

type TransactionDraftPayload = {
  rootTransactionId?: string | null;
  revisionNo?: number;
  number?: string | null;
  slug?: string | null;
  transactionDate?: string | null;
  branchId?: string | null;
  counterId?: string | null;
  branchSnapshot?: TransactionReferenceSnapshotValue;
  requiresApproval?: boolean;
  partyProfileId?: string | null;
  reasonId?: string | null;
  reasonSnapshot?: Record<string, unknown> | null;
  transactionPartyProfileType?: PurposePartyProfileType | null;
  purposeId?: string | null;
  agentProfileId?: string | null;
  passenger?: TransactionPassengerPayload | null;
  passengerId?: string | null;
  passengerTravel?: TransactionPassengerTravelPayload | null;
  manualBookPageId?: string | null;
  manualBookPageSnapshot?: Record<string, unknown> | null;
  transactionType: TransactionType;
  tradeMode: import("./transactions.enums").TradeMode;
  remarks?: string | null;
  preTcsFinalAmount?: string | number | null;
  tcsRatePercent?: string | number | null;
  tcsRateType?: PurposeRateType | null;
  tcsAmount?: string | number | null;
  loanAmount?: string | number | null;
  declaredAmount?: string | number | null;
  cdfNo?: string | null;
  cdfIssuingAuthority?: string | null;
  cdfApprovedUsd?: string | number | null;
  cdfArrivalDate?: string | null;
  itrFiled?: boolean | null;
  tcsDeclarationAccepted?: boolean | null;
  isProprietorship?: boolean | null;
  items?: TransactionItemPayload[];
  documents?: TransactionDocumentPayload[];
  additionalCharges?: TransactionAdditionalChargePayload[];
  payments?: TransactionPaymentPayload[];
};

type TransactionTcsPreviewRequestPayload = {
  transactionType: TransactionType;
  purposeId: string;
  slug?: string | null;
  preTcsFinalAmount?: string | number | null;
  itemBaseAmount?: string | number | null;
  itemTaxAmount?: string | number | null;
  additionalChargeBaseAmount?: string | number | null;
  additionalChargeTaxAmount?: string | number | null;
  loanAmount?: string | number | null;
  declaredAmount?: string | number | null;
  itrFiled?: boolean | null;
  tcsDeclarationAccepted?: boolean | null;
  isProprietorship?: boolean | null;
  maxTcsRatePercent?: string | number | null;
};

@Injectable()
export class TransactionsService {
  constructor(
    @InjectDataSource("database2") private readonly database2: DataSource,
    @InjectRepository(Transaction, "database2")
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionAd1, "database2")
    private readonly transactionAd1Repository: Repository<TransactionAd1>,
    @InjectRepository(TransactionItem, "database2")
    private readonly transactionItemRepository: Repository<TransactionItem>,
    @InjectRepository(CardStockCard, "database2")
    private readonly cardStockCardRepository: Repository<CardStockCard>,
    @InjectRepository(TransactionDocument, "database2")
    private readonly transactionDocumentRepository: Repository<TransactionDocument>,
    @InjectRepository(TransactionAdditionalCharge, "database2")
    private readonly transactionAdditionalChargeRepository: Repository<TransactionAdditionalCharge>,
    @InjectRepository(TransactionPayment, "database2")
    private readonly transactionPaymentRepository: Repository<TransactionPayment>,
    @InjectRepository(TransactionLog, "database2")
    private readonly transactionLogRepository: Repository<TransactionLog>,
    @InjectRepository(TransactionEvent, "database2")
    private readonly transactionEventRepository: Repository<TransactionEvent>,
    @InjectRepository(TransactionPassengerOtherDocument, "database2")
    private readonly transactionPassengerOtherDocumentRepository: Repository<TransactionPassengerOtherDocument>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductCardIssuer)
    private readonly productCardIssuerRepository: Repository<ProductCardIssuer>,
    @InjectRepository(DocumentProfile)
    private readonly documentProfileRepository: Repository<DocumentProfile>,
    @InjectRepository(AccountProfile)
    private readonly accountProfileRepository: Repository<AccountProfile>,
    @InjectRepository(PartyProfile)
    private readonly partyProfileRepository: Repository<PartyProfile>,
    @InjectRepository(Passenger)
    private readonly passengerRepository: Repository<Passenger>,
    @InjectRepository(SelectOption)
    private readonly selectOptionRepository: Repository<SelectOption>,
    @InjectRepository(Purpose)
    private readonly purposeRepository: Repository<Purpose>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    @InjectRepository(State)
    private readonly stateRepository: Repository<State>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    @InjectRepository(BranchCounter)
    private readonly branchCounterRepository: Repository<BranchCounter>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ManualBookPageTracking, "database2")
    private readonly manualBookPageTrackingRepository: Repository<ManualBookPageTracking>,
    @InjectRepository(ChequeBookPageTracking, "database2")
    private readonly chequeBookPageTrackingRepository: Repository<ChequeBookPageTracking>,
    private readonly companyService: CompanyService,
    private readonly additionalSettingService: AdditionalSettingService,
    private readonly dayEndStartProcessService: DayEndStartProcessService,
    private readonly countryService: CountryService,
    private readonly cardStockSaleLifecycleService: CardStockSaleLifecycleService,
    private readonly mailService: MailService,
    private readonly storageService: StorageService,
    private readonly purchaseRuleService: PurchaseRuleService,
    private readonly voucherService: VoucherService,
  ) {}

  async getAd1Agents(
    branchId: string | null | undefined,
    search?: string,
  ): Promise<PartyProfile[]> {
    const qb = this.partyProfileRepository
      .createQueryBuilder("pp")
      .leftJoinAndSelect("pp.commissionRules", "commissionRules")
      .where("pp.type = :type", { type: "AGENT" })
      .andWhere("pp.active = :active", { active: true });

    if (branchId) {
      qb.andWhere("pp.branchId = :branchId", { branchId });
    }

    if (search) {
      qb.andWhere("(pp.code ILIKE :search OR pp.name ILIKE :search)", {
        search: `%${search}%`,
      });
    }

    qb.orderBy("pp.createdAt", "DESC");

    return qb.getMany();
  }

  private parseJsonField<T>(value: unknown, fallback: T): T {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }

    if (typeof value === "string") {
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    }

    return value as T;
  }

  private toNumber(value: unknown): number {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  private resolveTransactionPartyProfileType(
    slug?: string | null,
  ): PurposePartyProfileType | null {
    const normalizedSlug = normalizeTransactionSlug(slug).toLowerCase();

    if (
      normalizedSlug === "corporate" ||
      isCorporateIndividualTransactionSlug(slug)
    ) {
      return PurposePartyProfileType.CORPORATE;
    }

    if (normalizedSlug === "individual") {
      return PurposePartyProfileType.INDIVIDUAL;
    }

    return null;
  }

  private purposeAppliesToContext(
    purpose: Pick<Purpose, "corporate" | "individual" | "sell" | "purchase">,
    transactionType: TransactionType,
    partyProfileType: PurposePartyProfileType | null,
  ): boolean {
    const matchesTransactionType =
      transactionType === TransactionType.SALE
        ? purpose.sell
        : purpose.purchase;

    if (!matchesTransactionType) {
      return false;
    }

    if (!partyProfileType) {
      return true;
    }

    return partyProfileType === PurposePartyProfileType.CORPORATE
      ? purpose.corporate
      : purpose.individual;
  }

  private async resolveGstRatePercent(): Promise<number> {
    const configuredRate =
      await this.additionalSettingService.getSettingTextValue(
        "TAX_CONFIGURATION",
        "GST_RATE",
      );

    if (!configuredRate) {
      throw new BadRequestException("Missing GST_RATE additional setting");
    }

    const parsedRate = Number(configuredRate);
    if (!Number.isFinite(parsedRate)) {
      throw new BadRequestException(
        "GST_RATE additional setting must be numeric",
      );
    }

    return parsedRate;
  }

  private async getAverageSellPrice(
    productId: string,
    currencyId: string,
  ): Promise<number> {
    const rows = await this.transactionRepository.query(
      `SELECT public.calculate_average_sell_price($1::uuid, $2::uuid) AS average_rate`,
      [productId, currencyId],
    );

    return Number(rows?.[0]?.average_rate ?? 0);
  }

  async getCounterHoldCost(
    branchId: string,
    counterId: string,
    currencyId: string,
  ): Promise<{
    branchId: string;
    counterId: string;
    currencyId: string;
    closingQuantity: string;
    closingInrAmount: string;
    holdCostRate: string | null;
  }> {
    const rows = await this.transactionRepository.query(
      `WITH latest AS (
        SELECT DISTINCT ON (profiletype)
          closing, closingrs
        FROM transaction_balance_currencies
        WHERE branch_id = $1::uuid
          AND counter_id = $2::uuid
          AND currency_id = $3::uuid
          AND date <= now()
        ORDER BY profiletype, date DESC, updated_at DESC
      )
      SELECT
        COALESCE(SUM(closing), 0) AS closing_quantity,
        COALESCE(SUM(closingrs), 0) AS closing_inr_amount
      FROM latest`,
      [branchId, counterId, currencyId],
    );
    const closingQuantity = Number(rows?.[0]?.closing_quantity ?? 0);
    const closingInrAmount = Number(rows?.[0]?.closing_inr_amount ?? 0);
    return {
      branchId,
      counterId,
      currencyId,
      closingQuantity: closingQuantity.toFixed(7),
      closingInrAmount: closingInrAmount.toFixed(2),
      holdCostRate:
        closingQuantity > 0 && closingInrAmount > 0
          ? (closingInrAmount / closingQuantity).toFixed(7)
          : null,
    };
  }

  async getAverageSellPricePreview(
    productId: string,
    currencyId: string,
  ): Promise<{
    productId: string;
    currencyId: string;
    averageSellRate: string;
  }> {
    if (!productId || !currencyId) {
      throw new BadRequestException("Product and currency are required");
    }
    return {
      productId,
      currencyId,
      averageSellRate: roundMoney(
        await this.getAverageSellPrice(productId, currencyId),
      ),
    };
  }

  private async runGstPreview(
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const transactionPayload = body.transaction ?? body;
    const previewRows = await this.transactionRepository.query(
      `SELECT public.calculate_transaction_gst_preview($1::jsonb) AS preview`,
      [JSON.stringify(transactionPayload)],
    );

    const preview =
      previewRows?.[0]?.preview ??
      previewRows?.[0]?.calculate_transaction_gst_preview ??
      null;
    return typeof preview === "string" ? JSON.parse(preview) : (preview ?? {});
  }

  async previewTransactionTax(
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.runGstPreview(body);
  }

  private async runTcsPreview(
    body: TransactionTcsPreviewRequestPayload,
  ): Promise<Record<string, unknown>> {
    const purposeId = String(body.purposeId ?? "").trim();
    if (!purposeId) {
      return {
        transactionType: body.transactionType,
        purposeId: null,
        preTcsFinalAmount: this.toNumber(body.preTcsFinalAmount),
        effectiveAmount: this.toNumber(body.preTcsFinalAmount),
        threshold: 0,
        effectiveThreshold: 0,
        loanAmount: this.toNumber(body.loanAmount),
        declaredAmount: this.toNumber(body.declaredAmount),
        taxableAmount: this.toNumber(body.preTcsFinalAmount),
        tcsRatePercent: 0,
        tcsRateType: null,
        tcsAmount: 0,
        finalAmount: this.toNumber(body.preTcsFinalAmount),
        tcsDeclarationAccepted: Boolean(body.tcsDeclarationAccepted),
        itrFiled: Boolean(body.itrFiled),
        isProprietorship: Boolean(body.isProprietorship),
        breakdowns: [],
      };
    }

    const purpose = await this.purposeRepository.findOne({
      where: { id: purposeId },
      relations: { slabs: true },
    });

    if (!purpose) {
      throw new NotFoundException(`Purpose with id ${purposeId} not found`);
    }

    const pagePartyProfileType = this.resolveTransactionPartyProfileType(
      body.slug,
    );
    if (
      !this.purposeAppliesToContext(
        purpose,
        body.transactionType,
        pagePartyProfileType,
      )
    ) {
      throw new BadRequestException(
        `Purpose ${purpose.code} is not valid for ${body.transactionType}`,
      );
    }

    const preTcsFinalAmount =
      body.preTcsFinalAmount !== undefined && body.preTcsFinalAmount !== null
        ? this.toNumber(body.preTcsFinalAmount)
        : this.toNumber(body.itemBaseAmount) +
          this.toNumber(body.itemTaxAmount) +
          this.toNumber(body.additionalChargeBaseAmount) +
          this.toNumber(body.additionalChargeTaxAmount);

    const payload = {
      transactionType: body.transactionType,
      purposeId: purpose.id,
      purposeSnapshot: PurposeResponseDto.fromEntity(purpose),
      preTcsFinalAmount,
      loanAmount: this.toNumber(body.loanAmount),
      declaredAmount: this.toNumber(body.declaredAmount),
      itrFiled: Boolean(body.itrFiled),
      tcsDeclarationAccepted: Boolean(body.tcsDeclarationAccepted),
      isProprietorship: Boolean(body.isProprietorship),
      maxTcsRatePercent: this.toNumber(body.maxTcsRatePercent ?? 20),
    };

    const previewRows = await this.transactionRepository.query(
      `SELECT public.calculate_transaction_tcs_preview($1::jsonb) AS preview`,
      [JSON.stringify(payload)],
    );

    const preview =
      previewRows?.[0]?.preview ??
      previewRows?.[0]?.calculate_transaction_tcs_preview ??
      null;
    return typeof preview === "string" ? JSON.parse(preview) : (preview ?? {});
  }

  async previewTransactionTcs(
    body: TransactionTcsPreviewRequestPayload,
  ): Promise<Record<string, unknown>> {
    return this.runTcsPreview(body);
  }

  private resolvePaymentMethod(value: unknown): TransactionPaymentMethod {
    const normalized = String(value ?? "")
      .trim()
      .toUpperCase();
    if (normalized === TransactionPaymentMethod.CASH) {
      return TransactionPaymentMethod.CASH;
    }

    if (normalized === TransactionPaymentMethod.CHEQUE) {
      return TransactionPaymentMethod.CHEQUE;
    }

    throw new BadRequestException("Payment mode must be CASH or CHEQUE");
  }

  private getFileIndex(fieldname: string) {
    const match = fieldname.match(/^files\[(\d+)\]$/);
    return match ? Number(match[1]) : -1;
  }

  private getSnapshotString(
    snapshot: Record<string, unknown> | null | undefined,
    key: string,
  ): string | null {
    const value = snapshot?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private async resolveDraftWorkplace(
    transactionPayload: Partial<TransactionDraftPayload>,
    performedById: string,
    activeBranchId: string | null,
    activeCounterId: string | null,
  ): Promise<{ resolvedBranchId: string; resolvedCounterId: string }> {
    const canSelectWorkplace =
      await this.isRequesterAdminOrHoStaff(performedById);
    const payloadBranchId = String(transactionPayload.branchId ?? "").trim();
    const payloadCounterId = String(transactionPayload.counterId ?? "").trim();

    if (canSelectWorkplace && payloadBranchId && payloadCounterId) {
      return {
        resolvedBranchId: payloadBranchId,
        resolvedCounterId: payloadCounterId,
      };
    }

    return {
      resolvedBranchId: activeBranchId || "",
      resolvedCounterId: activeCounterId || "",
    };
  }

  private async isRequesterAdminOrHoStaff(
    userId: string | null | undefined,
  ): Promise<boolean> {
    if (!userId) {
      return false;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["userRoles", "userRoles.role"],
      select: { id: true, isAdmin: true },
    });

    if (user?.isAdmin) {
      return true;
    }

    return user?.userRoles?.some((ur) => ur.role?.isHoStaff) === true;
  }

  private async canAccessTransaction(
    transaction: Transaction,
    userId: string | null | undefined,
    activeBranchId: string | null | undefined,
  ): Promise<boolean> {
    if (await this.isRequesterAdminOrHoStaff(userId)) {
      return true;
    }

    if (!activeBranchId) {
      return false;
    }

    return transaction.branchId === activeBranchId;
  }

  private async generateTransactionNumber(
    slug: string | null,
    branchSnapshot: Record<string, unknown> | null | undefined,
  ): Promise<string> {
    if (!slug) {
      throw new BadRequestException(
        "Transaction slug is required to generate transaction number",
      );
    }

    const branchCode =
      this.getSnapshotString(branchSnapshot, "code") ??
      this.getSnapshotString(branchSnapshot, "branchCode");

    if (!branchCode) {
      throw new BadRequestException(
        "Branch code is required to generate transaction number",
      );
    }

    return this.additionalSettingService.reserveTransactionNumber(
      slug,
      branchCode,
      new Date(),
    );
  }

  async getNextTransactionNumber(
    slug: string,
    branchId: string,
  ): Promise<{ nextNumber: string }> {
    if (!branchId) {
      throw new BadRequestException(
        "Branch is required to generate transaction number",
      );
    }

    if (!slug) {
      throw new BadRequestException(
        "Transaction slug is required to generate transaction number",
      );
    }

    const branchSnapshot = await loadEntitySnapshot(
      this.branchRepository,
      branchId,
    );
    if (!branchSnapshot) {
      throw new NotFoundException(`Branch with id ${branchId} not found`);
    }

    const branchCode =
      this.getSnapshotString(branchSnapshot, "code") ??
      this.getSnapshotString(branchSnapshot, "branchCode");

    if (!branchCode) {
      throw new BadRequestException(
        "Branch code is required to generate transaction number",
      );
    }

    return this.additionalSettingService.getTransactionNumberPreview(
      slug,
      branchCode,
      new Date(),
    );
  }

  private async hydratePartyProfileSnapshot(
    transaction: Transaction,
  ): Promise<Transaction> {
    if (!transaction.partyProfileId) {
      return transaction;
    }

    if (transaction.partyProfileSnapshot) {
      return transaction;
    }

    const partyProfileSnapshot = await loadEntitySnapshot(
      this.partyProfileRepository,
      transaction.partyProfileId,
    );

    if (!partyProfileSnapshot) {
      return transaction;
    }

    transaction.partyProfileSnapshot =
      partyProfileSnapshot as TransactionReferenceSnapshotValue;

    return transaction;
  }

  private async hydrateAgentProfileSnapshot(
    transaction: Transaction,
  ): Promise<Transaction> {
    if (!transaction.agentProfileId) {
      return transaction;
    }

    if (transaction.agentProfileSnapshot) {
      return transaction;
    }

    const agentProfileSnapshot = await loadEntitySnapshot(
      this.partyProfileRepository,
      transaction.agentProfileId,
    );

    if (!agentProfileSnapshot) {
      return transaction;
    }

    transaction.agentProfileSnapshot =
      agentProfileSnapshot as TransactionReferenceSnapshotValue;

    return transaction;
  }

  private async hydrateCounterSnapshot(
    transaction: Transaction,
  ): Promise<Transaction> {
    if (!transaction.counterId) {
      return transaction;
    }

    if (transaction.counterSnapshot) {
      return transaction;
    }

    const counterSnapshot = await loadEntitySnapshot(
      this.counterRepository,
      transaction.counterId,
    );

    if (!counterSnapshot) {
      return transaction;
    }

    transaction.counterSnapshot =
      counterSnapshot as TransactionReferenceSnapshotValue;

    return transaction;
  }

  private async resolveSelectOptionByIdOrValue(
    rawValue?: string | null,
  ): Promise<SelectOption | null> {
    const normalizedValue = String(rawValue ?? "").trim();

    if (!normalizedValue) {
      return null;
    }

    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        normalizedValue,
      )
    ) {
      const optionById = await this.selectOptionRepository.findOne({
        where: { id: normalizedValue },
      });

      if (optionById) {
        return optionById;
      }
    }

    return this.selectOptionRepository.findOne({
      where: { value: normalizedValue },
    });
  }

  async getTransactions(
    query?: TransactionListQueryDto,
    branchId?: string,
  ): Promise<PaginatedResponseDto<Transaction>> {
    const pagination = normalizePagination(query);
    const qb = this.transactionRepository
      .createQueryBuilder("transaction")
      .where("transaction.isLatest = true");

    if (query?.slug) {
      qb.andWhere("transaction.slug = :slug", { slug: query.slug });
    }

    if (branchId) {
      qb.andWhere("transaction.branchId = :branchId", { branchId });
    }

    if (query?.status) {
      qb.andWhere("transaction.status = :status", { status: query.status });
    }

    if (query?.partyProfileId) {
      qb.andWhere("transaction.partyProfileId = :partyProfileId", {
        partyProfileId: query.partyProfileId,
      });
    }

    if (query?.transactionType) {
      qb.andWhere("transaction.transactionType = :transactionType", {
        transactionType: query.transactionType,
      });
    }

    const trimmedSearch = query?.search?.trim();
    if (trimmedSearch) {
      qb.andWhere("transaction.number ILIKE :search", {
        search: `%${trimmedSearch}%`,
      });
    }

    qb.orderBy("transaction.createdAt", "DESC");
    applyPagination(qb, pagination);
    const [transactions, total] = await qb.getManyAndCount();
    const partyProfileIds = [
      ...new Set(
        transactions
          .filter((transaction) => !transaction.partyProfileSnapshot)
          .map((transaction) => transaction.partyProfileId),
      ),
    ];

    if (!partyProfileIds.length) {
      return buildPaginatedResponse(transactions, total, pagination);
    }

    const partyProfiles = await Promise.all(
      partyProfileIds.map(
        async (id) =>
          [
            id,
            await loadEntitySnapshot(this.partyProfileRepository, id),
          ] as const,
      ),
    );
    const partyProfileById = new Map(partyProfiles);

    return buildPaginatedResponse(
      transactions.map((transaction) => {
        if (transaction.partyProfileSnapshot) {
          return transaction;
        }

        const partyProfile = partyProfileById.get(transaction.partyProfileId);
        if (!partyProfile) {
          return transaction;
        }

        return {
          ...transaction,
          partyProfileSnapshot: partyProfile,
        } as Transaction;
      }) as Transaction[],
      total,
      pagination,
    );
  }

  async getQuantityAvailability(
    branchId: string,
    counterId: string,
    currencyId: string,
    productId: string,
    excludeTransactionId?: string,
  ): Promise<{
    branchId: string;
    counterId: string;
    currencyId: string;
    productId: string;
    purchasedQuantity: string;
    soldQuantity: string;
    availableQuantity: string;
  }> {
    if (!branchId) {
      throw new BadRequestException("Branch is required");
    }

    if (!counterId) {
      throw new BadRequestException("Counter is required");
    }

    if (!currencyId) {
      throw new BadRequestException("Currency is required");
    }

    if (!productId) {
      throw new BadRequestException("Product is required");
    }

    const qb = this.transactionItemRepository
      .createQueryBuilder("item")
      .innerJoin("item.transaction", "tx")
      .select(
        `COALESCE(SUM(CASE WHEN tx.transaction_type = :purchaseType THEN item.quantity ELSE 0 END), 0)`,
        "purchasedQuantity",
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN tx.transaction_type = :saleType THEN item.quantity ELSE 0 END), 0)`,
        "soldQuantity",
      )
      .where("tx.isLatest = true")
      .andWhere("tx.status = :approvedStatus", {
        approvedStatus: TransactionStatus.APPROVED,
      })
      .andWhere("tx.branchId = :branchId", { branchId })
      .andWhere("tx.counterId = :counterId", { counterId })
      .andWhere("item.currencyId = :currencyId", { currencyId })
      .andWhere("item.productId = :productId", { productId })
      .setParameters({
        purchaseType: TransactionType.PURCHASE,
        saleType: TransactionType.SALE,
      });

    if (excludeTransactionId) {
      qb.andWhere("tx.id <> :excludeTransactionId", { excludeTransactionId });
    }

    const raw = await qb.getRawOne<{
      purchasedQuantity?: string;
      soldQuantity?: string;
    }>();

    const purchasedQuantity = String(raw?.purchasedQuantity ?? "0");
    const soldQuantity = String(raw?.soldQuantity ?? "0");
    const availableQuantity = (
      Number(purchasedQuantity || 0) - Number(soldQuantity || 0)
    ).toString();

    return {
      branchId,
      counterId,
      currencyId,
      productId,
      purchasedQuantity,
      soldQuantity,
      availableQuantity,
    };
  }

  async requestAccountPostingRebuild(
    transactionId: string,
    performedById: string | null,
  ): Promise<{ message: string }> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      select: { id: true, createdBy: true, updatedBy: true },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with id ${transactionId} not found`,
      );
    }

    const actorId =
      performedById ?? transaction.updatedBy ?? transaction.createdBy;
    if (!actorId) {
      throw new BadRequestException(
        "Unable to determine the actor for rebuild request",
      );
    }

    await this.transactionEventRepository.manager.transaction(
      async (manager) => {
        await manager.getRepository(TransactionEvent).delete({
          transactionId,
          eventType: TransactionEventType.ACCOUNT_POSTINGS_REBUILD,
          status: In([
            TransactionEventStatus.PENDING,
            TransactionEventStatus.PROCESSING,
          ]),
        });

        await manager.getRepository(TransactionEvent).save(
          manager.getRepository(TransactionEvent).create({
            transactionId,
            eventType: TransactionEventType.ACCOUNT_POSTINGS_REBUILD,
            payload: {
              transactionId,
              source: "manual",
            },
            status: TransactionEventStatus.PENDING,
            attemptCount: 0,
            availableAt: new Date(),
            processedAt: null,
            errorMessage: null,
            lockedAt: null,
            lockedById: null,
            createdBy: actorId,
            updatedBy: actorId,
          }),
        );
      },
    );

    return { message: "Account posting rebuild queued successfully" };
  }

  async createDraft(
    body: Record<string, unknown>,
    files: UploadedDraftFile[],
    performedById: string | null,
    activeBranchId: string | null = null,
    activeCounterId: string | null = null,
  ): Promise<Transaction> {
    if (!performedById) {
      throw new BadRequestException("User session not found");
    }

    const transactionPayload = this.parseJsonField<
      Partial<TransactionDraftPayload>
    >(body.transaction, {});
    const attachments = this.parseJsonField<
      Array<{ documentProfileId: string; fileName?: string }>
    >(body.attachments, []);

    const { resolvedBranchId, resolvedCounterId } =
      await this.resolveDraftWorkplace(
        transactionPayload,
        performedById,
        activeBranchId,
        activeCounterId,
      );

    console.log("[workplace-debug] createDraft workplace", {
      performedById,
      sessionBranchId: activeBranchId,
      sessionCounterId: activeCounterId,
      payloadBranchId: transactionPayload.branchId ?? null,
      payloadCounterId: transactionPayload.counterId ?? null,
      payloadBranchSnapshotId:
        transactionPayload.branchSnapshot &&
        typeof transactionPayload.branchSnapshot === "object" &&
        "id" in transactionPayload.branchSnapshot
          ? ((transactionPayload.branchSnapshot as { id?: string }).id ?? null)
          : null,
      resolvedBranchId,
      resolvedCounterId,
    });

    const isFakeCurrency =
      String(transactionPayload.slug ?? "")
        .trim()
        .toUpperCase() === "FAKE_CURRENCY";

    if (
      !resolvedBranchId ||
      !resolvedCounterId ||
      (!isFakeCurrency && !transactionPayload.partyProfileId)
    ) {
      throw new BadRequestException(
        "Branch, counter, and party profile are required",
      );
    }

    if (isFakeCurrency) {
      const reasonId = String(transactionPayload.reasonId ?? "").trim();
      if (!reasonId) {
        throw new BadRequestException("Fake currency reason is required");
      }
      const reason = await this.selectOptionRepository
        .createQueryBuilder("selectOption")
        .where("selectOption.id = :reasonId", { reasonId })
        .andWhere("REPLACE(UPPER(selectOption.code), '_', '') = :reasonCode", {
          reasonCode: "FAKECURRENCYREASON",
        })
        .andWhere("selectOption.isActive = true")
        .getOne();
      if (!reason) {
        throw new BadRequestException(
          "Selected fake currency reason is invalid",
        );
      }
      transactionPayload.reasonSnapshot = (await loadEntitySnapshot(
        this.selectOptionRepository,
        reason.id,
      )) as Record<string, unknown>;

      const fakeItems = Array.isArray(transactionPayload.items)
        ? transactionPayload.items
        : [];
      if (fakeItems.length === 0) {
        throw new BadRequestException(
          "At least one fake currency item is required",
        );
      }
      const rateEditable =
        String(
          (await this.additionalSettingService.getSettingTextValue(
            "FAKE_CURRENCY_SETTINGS",
            "FAKE_CURRENCY_RATE_EDITABLE",
          )) ?? "",
        ).toLowerCase() === "yes" ||
        String(
          (await this.additionalSettingService.getSettingTextValue(
            "FAKE_CURRENCY_SETTINGS",
            "FAKE_CURRENCY_RATE_EDITABLE",
          )) ?? "",
        ).toLowerCase() === "true";

      for (const item of fakeItems) {
        const quantity = Number(item.quantity);
        const productId = String(item.productId ?? "").trim();
        const currencyId = String(item.currencyId ?? "").trim();
        if (
          !productId ||
          !currencyId ||
          !Number.isFinite(quantity) ||
          quantity <= 0
        ) {
          throw new BadRequestException(
            "Fake currency item currency, product, and positive quantity are required",
          );
        }
        const availability = await this.getQuantityAvailability(
          resolvedBranchId,
          resolvedCounterId,
          currencyId,
          productId,
        );
        if (quantity > Number(availability.availableQuantity)) {
          throw new BadRequestException(
            `Fake currency quantity exceeds available quantity for product ${productId}`,
          );
        }
        if (!rateEditable) {
          const averageSellRate = await this.getAverageSellPrice(
            productId,
            currencyId,
          );
          const submittedRate = Number(item.rate);
          const roundedAverageSellRate = Number(roundMoney(averageSellRate));
          const roundedSubmittedRate = Number(roundMoney(submittedRate));
          if (
            averageSellRate > 0 &&
            (!Number.isFinite(submittedRate) ||
              roundedSubmittedRate !== roundedAverageSellRate)
          ) {
            throw new BadRequestException(
              `Rate must match the average sell rate of ${roundedAverageSellRate.toFixed(2)}`,
            );
          }
        }
      }
    }

    const filesByIndex = new Map<number, UploadedDraftFile>();
    for (const file of files ?? []) {
      const index = this.getFileIndex(file.fieldname);
      if (index >= 0) {
        filesByIndex.set(index, file);
      }
    }

    const shouldRequireApproval = Boolean(transactionPayload.requiresApproval);
    const requestedItemRows = Array.isArray(transactionPayload.items)
      ? transactionPayload.items
      : [];
    const hasRequestedCardItems = requestedItemRows.some((item) =>
      Boolean(item.cardId),
    );
    const transactionStatus = isFakeCurrency
      ? TransactionStatus.APPROVED
      : shouldRequireApproval
        ? TransactionStatus.DRAFT
        : TransactionStatus.APPROVED;
    const shouldAutoFinalizeCardSale =
      transactionStatus === TransactionStatus.APPROVED && hasRequestedCardItems;
    const persistedTransactionStatus = shouldAutoFinalizeCardSale
      ? TransactionStatus.DRAFT
      : transactionStatus;
    const now = new Date();
    const policyContext = await this.dayEndStartProcessService.getPolicyContext(
      {
        userId: performedById,
        activeBranchId: resolvedBranchId,
        activeCounterId: resolvedCounterId,
      },
    );
    const requestedTransactionDate = transactionPayload.transactionDate?.trim()
      ? transactionPayload.transactionDate.trim()
      : policyContext.transactionDate?.trim() || undefined;
    const datePolicy =
      await this.dayEndStartProcessService.assertTransactionDateAllowed(
        resolvedBranchId,
        performedById,
        requestedTransactionDate,
        resolvedCounterId,
      );
    const resolvedTransactionDate = (
      requestedTransactionDate || datePolicy.allowedDate
    ).slice(0, 10);
    if (!resolvedTransactionDate) {
      throw new BadRequestException("Transaction date is required");
    }

    const { company: currentCompany, snapshot: currentCompanySnapshot } =
      await requireCompanyForDate(this.companyService, resolvedTransactionDate);

    const gstRatePercent = await this.resolveGstRatePercent();

    const selectedCounter = await this.counterRepository.findOne({
      where: { id: resolvedCounterId },
    });

    if (!selectedCounter) {
      throw new NotFoundException(
        `Counter with id ${resolvedCounterId} not found`,
      );
    }

    console.log("[workplace-debug] createDraft counter check", {
      resolvedBranchId,
      resolvedCounterId,
      counterName: selectedCounter.name,
    });

    await assertCounterBelongsToBranch(
      this.branchCounterRepository,
      String(resolvedBranchId),
      resolvedCounterId,
    );

    const branchSnapshot = await loadEntitySnapshot(
      this.branchRepository,
      String(resolvedBranchId),
    );
    if (!branchSnapshot) {
      throw new NotFoundException(
        `Branch with id ${resolvedBranchId} not found`,
      );
    }

    const generatedNumber = shouldRequireApproval
      ? null
      : await this.generateTransactionNumber(
          String(transactionPayload.slug ?? ""),
          branchSnapshot,
        );

    const partyProfileSnapshot = isFakeCurrency
      ? null
      : await loadEntitySnapshot(
          this.partyProfileRepository,
          String(transactionPayload.partyProfileId),
        );
    if (!isFakeCurrency && !partyProfileSnapshot) {
      throw new NotFoundException(
        `Party profile with id ${transactionPayload.partyProfileId} not found`,
      );
    }

    const agentProfileSnapshot = transactionPayload.agentProfileId
      ? await loadEntitySnapshot(
          this.partyProfileRepository,
          String(transactionPayload.agentProfileId),
        )
      : null;
    if (transactionPayload.agentProfileId && !agentProfileSnapshot) {
      throw new NotFoundException(
        `Agent profile with id ${transactionPayload.agentProfileId} not found`,
      );
    }

    const manualBookPageSnapshot = transactionPayload.manualBookPageId
      ? await loadEntitySnapshot(
          this.manualBookPageTrackingRepository,
          String(transactionPayload.manualBookPageId),
        )
      : null;
    if (transactionPayload.manualBookPageId && !manualBookPageSnapshot) {
      throw new NotFoundException(
        `Manual book page with id ${transactionPayload.manualBookPageId} not found`,
      );
    }

    if (!resolvedCounterId) {
      throw new BadRequestException("Counter is required");
    }

    const counterSnapshot = await loadEntitySnapshot(
      this.counterRepository,
      String(resolvedCounterId),
    );
    if (!counterSnapshot) {
      throw new NotFoundException(
        `Counter with id ${resolvedCounterId} not found`,
      );
    }

    const purposeId = String(transactionPayload.purposeId ?? "").trim() || null;
    const purpose = purposeId
      ? await this.purposeRepository.findOne({ where: { id: purposeId } })
      : null;
    if (purposeId && !purpose) {
      throw new NotFoundException(`Purpose with id ${purposeId} not found`);
    }
    const transactionPartyProfileType = this.resolveTransactionPartyProfileType(
      transactionPayload.slug,
    );
    if (
      purpose &&
      !this.purposeAppliesToContext(
        purpose,
        transactionPayload.transactionType,
        transactionPartyProfileType,
      )
    ) {
      throw new BadRequestException(
        `Purpose ${purpose.code} is not valid for ${transactionPayload.transactionType}`,
      );
    }
    const purposeSnapshot = purpose
      ? ((await loadEntitySnapshot(
          this.purposeRepository,
          purpose.id,
        )) as TransactionReferenceSnapshotValue)
      : null;

    if (!isFakeCurrency) {
      await this.purchaseRuleService.validate(transactionPayload);
    }

    const passengerPayload = transactionPayload.passenger ?? null;
    const passengerTravelPayload =
      transactionPayload.transactionType === TransactionType.SALE
        ? (transactionPayload.passengerTravel ?? null)
        : null;
    let passengerId: string | null = null;
    let matchedExistingPassenger = false;
    let passengerSnapshot: TransactionPassengerSnapshotValue = null;
    let passengerTravelSnapshot: TransactionPassengerTravelSnapshotValue = null;
    const passengerTransactionDate =
      parseDateValue(resolvedTransactionDate) ?? now;

    if (passengerPayload) {
      if (passengerPayload.countryId) {
        await this.countryService.assertCountryAllowed(
          String(passengerPayload.countryId),
          resolvedBranchId,
          performedById,
        );
      }

      const passengerPassportExpiryDate = parseDateValue(
        passengerPayload.passportExpiryDate,
      );
      if (
        passengerPassportExpiryDate &&
        passengerPassportExpiryDate <= addMonthsUtc(passengerTransactionDate, 3)
      ) {
        throw new BadRequestException(
          "Passport expiry date must be more than 3 months after the transaction date",
        );
      }

      const passengerArrivalDate = parseDateValue(passengerPayload.arrivalDate);
      const isForeignPassenger =
        passengerPayload.nationalityType === PassengerNationalityType.NRI ||
        passengerPayload.nationalityType === PassengerNationalityType.FOREIGNER;

      if (
        isForeignPassenger &&
        !hasCompletePassengerPassport(passengerPayload)
      ) {
        throw new BadRequestException(
          "Passport details are required for NRI and foreign passengers",
        );
      }

      if (isForeignPassenger && !passengerArrivalDate) {
        throw new BadRequestException(
          "Arrival date is required for NRI and foreign passengers",
        );
      }

      if (
        passengerArrivalDate &&
        passengerArrivalDate > passengerTransactionDate
      ) {
        throw new BadRequestException(
          "Arrival date cannot be after the transaction date",
        );
      }

      const normalizedPanNumber = normalizePassengerIdentity(
        passengerPayload.panNumber,
      );
      const normalizedPassportNumber = normalizePassengerIdentity(
        passengerPayload.passportNumber,
      );
      const [passengerByPan, passengerByPassport] = await Promise.all([
        normalizedPanNumber
          ? this.passengerRepository.findOne({
              where: { panNumber: normalizedPanNumber },
            })
          : null,
        normalizedPassportNumber
          ? this.passengerRepository.findOne({
              where: { passportNumber: normalizedPassportNumber },
            })
          : null,
      ]);
      if (
        passengerByPan &&
        passengerByPassport &&
        passengerByPan.id !== passengerByPassport.id
      ) {
        throw new BadRequestException(
          "PAN and passport belong to different passenger records",
        );
      }
      const existingPassenger = passengerByPan ?? passengerByPassport ?? null;
      matchedExistingPassenger = Boolean(existingPassenger);

      const residentStatusOption = passengerPayload.residentStatus
        ? await this.selectOptionRepository.findOne({
            where: {
              code: "RESIDENTSTATUS",
              value: String(passengerPayload.residentStatus).trim(),
            },
          })
        : null;

      const passengerToSave: DeepPartial<Passenger> = {
        id: existingPassenger?.id ?? undefined,
        partyProfileId: String(transactionPayload.partyProfileId),
        entityType: passengerPayload.entityType as PassengerEntityType,
        nationalityType:
          passengerPayload.nationalityType as PassengerNationalityType,
        countryId: String(passengerPayload.countryId),
        residentStatusId: residentStatusOption?.id ?? null,
        locationId: passengerPayload.locationId ?? null,
        email: passengerPayload.email ?? null,
        contactNo: passengerPayload.contactNo ?? null,
        panNumber: normalizedPanNumber,
        panHolderName: passengerPayload.panHolderName ?? null,
        panDob: passengerPayload.panDob ?? null,
        panHolderRelationType: passengerPayload.panHolderRelationType ?? null,
        paidByPanNumber: passengerPayload.paidByPanNumber ?? null,
        paidByPanHolderName: passengerPayload.paidByPanHolderName ?? null,
        paidByPanDob: passengerPayload.paidByPanDob ?? null,
        gstStateId: passengerPayload.gstStateId ?? null,
        gstNumber: passengerPayload.gstNumber ?? null,
        address1: passengerPayload.address1 ?? null,
        address2: passengerPayload.address2 ?? null,
        city: passengerPayload.city ?? null,
        stateId: passengerPayload.stateId ?? null,
        passportNumber: normalizedPassportNumber,
        passportIssueAt: passengerPayload.passportIssueAt ?? null,
        passportIssueDate: passengerPayload.passportIssueDate ?? null,
        passportExpiryDate: passengerPayload.passportExpiryDate ?? null,
        arrivalDate: passengerPayload.arrivalDate ?? null,
        isPep: Boolean(passengerPayload.isPep),
        remarks: null,
        createdBy: performedById,
        updatedBy: performedById,
      };

      const savedPassenger = await this.passengerRepository.save(
        this.passengerRepository.create(passengerToSave),
      );

      passengerId = savedPassenger.id;
      passengerSnapshot = (await loadEntitySnapshot(
        this.passengerRepository,
        savedPassenger.id,
      )) as TransactionPassengerSnapshotValue;
    }

    if (passengerTravelPayload) {
      const hasTravelDetails =
        Boolean(String(passengerTravelPayload.airlineTtId ?? "").trim()) ||
        Boolean(String(passengerTravelPayload.ticketNo ?? "").trim()) ||
        Boolean(String(passengerTravelPayload.route ?? "").trim()) ||
        Boolean(
          String(passengerTravelPayload.travellingCountryId ?? "").trim(),
        ) ||
        (passengerTravelPayload.noOfDays !== undefined &&
          passengerTravelPayload.noOfDays !== null) ||
        (passengerTravelPayload.noOfPax !== undefined &&
          passengerTravelPayload.noOfPax !== null) ||
        Boolean(String(passengerTravelPayload.departureDate ?? "").trim()) ||
        Boolean(String(passengerTravelPayload.travelPnr ?? "").trim()) ||
        Boolean(passengerTravelPayload.visa) ||
        Boolean(passengerTravelPayload.isCisCountry);

      if (hasTravelDetails) {
        const airlineOption = passengerTravelPayload.airlineTtId
          ? await this.resolveSelectOptionByIdOrValue(
              String(passengerTravelPayload.airlineTtId),
            )
          : null;
        const airlineSnapshot = airlineOption
          ? ((await loadEntitySnapshot(
              this.selectOptionRepository,
              airlineOption.id,
            )) as TransactionReferenceSnapshotValue)
          : null;
        if (passengerTravelPayload.airlineTtId && !airlineSnapshot) {
          throw new NotFoundException(
            `Airline option with id ${passengerTravelPayload.airlineTtId} not found`,
          );
        }

        const travelCountrySnapshot = passengerTravelPayload.travellingCountryId
          ? ((await loadEntitySnapshot(
              this.countryRepository,
              String(passengerTravelPayload.travellingCountryId),
            )) as TransactionReferenceSnapshotValue)
          : null;
        if (
          passengerTravelPayload.travellingCountryId &&
          !travelCountrySnapshot
        ) {
          throw new NotFoundException(
            `Travel country with id ${passengerTravelPayload.travellingCountryId} not found`,
          );
        }

        if (passengerTravelPayload.travellingCountryId) {
          await this.countryService.assertTravelCountryAllowed(
            String(passengerTravelPayload.travellingCountryId),
            resolvedBranchId,
            performedById,
          );
        }

        if (passengerTravelPayload.departureDate) {
          const departureDate = parseDateValue(
            passengerTravelPayload.departureDate,
          );
          if (departureDate && departureDate < passengerTransactionDate) {
            throw new BadRequestException(
              "Departure date cannot be before the transaction date",
            );
          }
        }

        passengerTravelSnapshot = {
          id: String(
            passengerTravelPayload.airlineTtId ??
              passengerTravelPayload.travellingCountryId ??
              "travel",
          ),
          airlineTt: airlineSnapshot,
          ticketNo: passengerTravelPayload.ticketNo ?? null,
          route: passengerTravelPayload.route ?? null,
          travellingCountry: travelCountrySnapshot,
          noOfDays: passengerTravelPayload.noOfDays ?? null,
          noOfPax: passengerTravelPayload.noOfPax ?? null,
          departureDate: passengerTravelPayload.departureDate ?? null,
          travelPnr: passengerTravelPayload.travelPnr ?? null,
          visa: passengerTravelPayload.visa ?? false,
          isCisCountry: passengerTravelPayload.isCisCountry ?? false,
        };
      }
    }

    const hasReloadCardItem = requestedItemRows.some((item) =>
      Boolean(item.cardId && item.isReload),
    );
    if (hasReloadCardItem) {
      if (!passengerId || !matchedExistingPassenger) {
        throw new BadRequestException(
          "CARD reload requires an existing matched passenger",
        );
      }
      if (!String(passengerTravelPayload?.travellingCountryId ?? "").trim()) {
        throw new BadRequestException(
          "Travel country is required for CARD reload",
        );
      }
    }

    const transactionToSave: DeepPartial<Transaction> = {
      rootTransactionId: transactionPayload.rootTransactionId ?? null,
      revisionNo: Number(transactionPayload.revisionNo ?? 1) || 1,
      number: generatedNumber,
      slug: transactionPayload.slug ?? null,
      branchId: String(resolvedBranchId),
      branchSnapshot,
      counterId: String(resolvedCounterId),
      counterSnapshot,
      companyId: currentCompany.id,
      companySnapshot: currentCompanySnapshot,
      partyProfileId: isFakeCurrency
        ? null
        : String(transactionPayload.partyProfileId),
      transactionPartyProfileType:
        transactionPayload.transactionPartyProfileType ?? null,
      partyProfileSnapshot,
      reasonId: isFakeCurrency
        ? normalizeNullableString(transactionPayload.reasonId)
        : null,
      reasonSnapshot: isFakeCurrency
        ? (transactionPayload.reasonSnapshot ?? null)
        : null,
      purposeId,
      purposeSnapshot,
      passengerId,
      passengerSnapshot,
      passengerTravelId: null,
      passengerTravelSnapshot,
      agentProfileId: transactionPayload.agentProfileId ?? null,
      agentProfileSnapshot,
      manualBookPageId: transactionPayload.manualBookPageId ?? null,
      manualBookPageSnapshot,
      transactionDate: new Date(`${resolvedTransactionDate}T00:00:00.000Z`),
      transactionType: transactionPayload.transactionType,
      tradeMode: transactionPayload.tradeMode,
      status: persistedTransactionStatus,
      remarks: transactionPayload.remarks ?? null,
      submittedAt: shouldRequireApproval ? now : now,
      approvedAt:
        persistedTransactionStatus === TransactionStatus.APPROVED ? now : null,
      rejectedAt: null,
      approvedById:
        persistedTransactionStatus === TransactionStatus.APPROVED
          ? performedById
          : null,
      rejectedById: null,
      approvalRemarks: null,
      rejectionReason: null,
      isLatest: true,
      taxRatePercent: roundMoney(gstRatePercent),
      preTcsFinalAmount:
        transactionPayload.preTcsFinalAmount !== undefined &&
        transactionPayload.preTcsFinalAmount !== null
          ? roundMoney(this.toNumber(transactionPayload.preTcsFinalAmount))
          : roundMoney(0),
      tcsRatePercent:
        transactionPayload.tcsRatePercent !== undefined &&
        transactionPayload.tcsRatePercent !== null
          ? roundMoney(this.toNumber(transactionPayload.tcsRatePercent))
          : roundMoney(0),
      tcsRateType: transactionPayload.tcsRateType ?? null,
      tcsAmount:
        transactionPayload.tcsAmount !== undefined &&
        transactionPayload.tcsAmount !== null
          ? roundMoney(this.toNumber(transactionPayload.tcsAmount))
          : roundMoney(0),
      cdfNo: normalizeNullableString(transactionPayload.cdfNo),
      cdfIssuingAuthority: normalizeNullableString(
        transactionPayload.cdfIssuingAuthority,
      ),
      cdfApprovedUsd:
        transactionPayload.cdfApprovedUsd !== undefined &&
        transactionPayload.cdfApprovedUsd !== null
          ? roundMoney(this.toNumber(transactionPayload.cdfApprovedUsd))
          : null,
      cdfArrivalDate: normalizeNullableString(
        transactionPayload.cdfArrivalDate,
      ),
      loanAmount:
        transactionPayload.loanAmount !== undefined &&
        transactionPayload.loanAmount !== null
          ? roundMoney(this.toNumber(transactionPayload.loanAmount))
          : null,
      declaredAmount:
        transactionPayload.declaredAmount !== undefined &&
        transactionPayload.declaredAmount !== null
          ? roundMoney(this.toNumber(transactionPayload.declaredAmount))
          : null,
      itrFiled: Boolean(transactionPayload.itrFiled),
      tcsDeclarationAccepted: Boolean(
        transactionPayload.tcsDeclarationAccepted,
      ),
      isProprietorship: Boolean(transactionPayload.isProprietorship),
      createdBy: performedById,
      updatedBy: performedById,
    };

    const transaction = await this.transactionRepository.save(
      this.transactionRepository.create(transactionToSave),
    );

    const passengerOtherDocumentRows = Array.isArray(
      passengerPayload?.otherDocuments,
    )
      ? passengerPayload.otherDocuments.filter(
          (row) =>
            Boolean(String(row.documentType ?? "").trim()) ||
            Boolean(String(row.documentNumber ?? "").trim()) ||
            Boolean(String(row.validTill ?? "").trim()) ||
            Boolean(String(row.documentFile ?? "").trim()),
        )
      : [];

    if (
      passengerPayload?.nationalityType === PassengerNationalityType.INDIAN &&
      passengerOtherDocumentRows.length === 0 &&
      !hasCompletePassengerPan(passengerPayload) &&
      !hasCompletePassengerPassport(passengerPayload)
    ) {
      throw new BadRequestException(
        "PAN, passport, or at least one other document is required for Indian passengers",
      );
    }

    for (let index = 0; index < passengerOtherDocumentRows.length; index += 1) {
      const row = passengerOtherDocumentRows[index];
      const rawFile = String(row.documentFile ?? "").trim();
      const hasDataUrlPrefix = rawFile.startsWith("data:");
      const fileContent = rawFile
        ? Buffer.from(
            hasDataUrlPrefix ? (rawFile.split(",")[1] ?? "") : rawFile,
            "base64",
          )
        : null;
      const mimeType = hasDataUrlPrefix
        ? rawFile.slice(5, rawFile.indexOf(";"))
        : null;

      const passengerOtherDocumentToSave: DeepPartial<TransactionPassengerOtherDocument> =
        {
          transactionId: transaction.id,
          transaction,
          lineNo: index + 1,
          documentType: row.documentType as PassengerOtherIdProofType,
          documentNumber: String(row.documentNumber),
          validTill: row.validTill ?? null,
          issueAt: row.issueAt ?? null,
          issueDate: row.issueDate ?? null,
          expiryDate: row.expiryDate ?? null,
          fileName: rawFile
            ? `${row.documentType || "document"}-${index + 1}`
            : null,
          originalFileName: rawFile
            ? `${row.documentType || "document"}-${index + 1}`
            : null,
          mimeType,
          fileSize: fileContent ? String(fileContent.length) : null,
          storageKey: null,
          storagePath: null,
          storageUrl: null,
          content: fileContent,
          remarks: row.remarks ?? null,
          createdBy: performedById,
          updatedBy: performedById,
        };

      await this.transactionPassengerOtherDocumentRepository.save(
        this.transactionPassengerOtherDocumentRepository.create(
          passengerOtherDocumentToSave,
        ),
      );
    }

    const currencySnapshots = new Map<string, Record<string, unknown>>();
    const productSnapshots = new Map<string, Record<string, unknown>>();
    const accountSnapshots = new Map<string, Record<string, unknown>>();
    const documentProfileSnapshots = new Map<string, Record<string, unknown>>();
    const resolveSnapshot = async <T extends ObjectLiteral>(
      cache: Map<string, Record<string, unknown>>,
      repository: Repository<T>,
      id: string,
      label: string,
    ) => {
      if (!cache.has(id)) {
        const snapshot = await loadEntitySnapshot(repository, id);
        if (!snapshot) {
          throw new NotFoundException(`${label} with id ${id} not found`);
        }
        cache.set(id, snapshot);
      }
      return cache.get(id)!;
    };

    const resolveCurrency = async (currencyId: string) => {
      return resolveSnapshot(
        currencySnapshots,
        this.currencyRepository,
        currencyId,
        "Currency",
      );
    };

    const resolveProduct = async (productId: string) => {
      return resolveSnapshot(
        productSnapshots,
        this.productRepository,
        productId,
        "Product",
      );
    };

    const resolveProductEntity = async (productId: string) => {
      const product = await this.productRepository.findOne({
        where: { id: productId },
        relations: [
          "bulkPurAc",
          "purchaseAc",
          "bulkSaleAc",
          "saleAc",
          "bulkProficAc",
          "profitAc",
          "fakeAccount",
        ],
      });

      if (!product) {
        throw new NotFoundException(`Product with id ${productId} not found`);
      }

      return product;
    };

    const resolveAccount = async (accountId: string) => {
      return resolveSnapshot(
        accountSnapshots,
        this.accountProfileRepository,
        accountId,
        "Account",
      );
    };

    const resolveDocumentProfile = async (documentProfileId: string) => {
      return resolveSnapshot(
        documentProfileSnapshots,
        this.documentProfileRepository,
        documentProfileId,
        "Document profile",
      );
    };

    const itemRows = requestedItemRows;
    const cardSaleItems: TransactionItem[] = [];
    const selectedCardCurrencyKeys = new Set<string>();
    for (let index = 0; index < itemRows.length; index += 1) {
      const row = itemRows[index];
      const currency = await resolveCurrency(String(row.currencyId));
      const product = await resolveProduct(String(row.productId));
      const productEntity = await resolveProductEntity(String(row.productId));
      const isCardItem = isCardProductCode(productEntity.productCode);
      const isMultiCurrencyCard = isMultiCurrencyCardProduct(
        productEntity.productCode,
      );
      if (isCardItem) {
        if (transactionPayload.transactionType !== TransactionType.SALE) {
          throw new BadRequestException(
            "CARD products can only be sold through the CARD sale flow",
          );
        }
        if (!row.cardId || !row.issuerPartyProfileId) {
          throw new BadRequestException(
            `CARD item ${index + 1} requires issuer and card selection`,
          );
        }
        const cardFeAmount = Number(row.quantity);
        if (!Number.isFinite(cardFeAmount) || cardFeAmount <= 0) {
          throw new BadRequestException(
            `CARD item ${index + 1} FE amount must be greater than 0`,
          );
        }
        if (Boolean(currency.onlyStocking)) {
          throw new BadRequestException(
            `CARD item ${index + 1} cannot use an only-stocking currency on sale`,
          );
        }
        const cardCurrencyKey = `${row.cardId}:${row.currencyId}`;
        if (selectedCardCurrencyKeys.has(cardCurrencyKey)) {
          throw new BadRequestException(
            `CARD ${row.cardId} cannot be selected more than once for the same currency in one transaction`,
          );
        }
        if (!isMultiCurrencyCard) {
          const sameCardOtherCurrency = [...selectedCardCurrencyKeys].some(
            (key) => key.startsWith(`${row.cardId}:`),
          );
          if (sameCardOtherCurrency) {
            throw new BadRequestException(
              `CARD ${row.cardId} cannot be selected more than once in one transaction`,
            );
          }
        }
        selectedCardCurrencyKeys.add(cardCurrencyKey);
        const selectedCard = await this.cardStockCardRepository.findOne({
          where: { id: row.cardId },
          relations: ["receiptItem"],
        });
        if (
          !selectedCard ||
          selectedCard.currentBranchId !== resolvedBranchId
        ) {
          throw new BadRequestException(
            `CARD item ${index + 1} is not available at the current branch`,
          );
        }
        if (
          !row.isReload &&
          (selectedCard.status !== "AVAILABLE" ||
            selectedCard.reservedByTransferId ||
            selectedCard.reservedAt)
        ) {
          throw new BadRequestException(
            `CARD item ${index + 1} is not available for sale`,
          );
        }
        if (
          row.isReload &&
          (selectedCard.status !== "SOLD" || selectedCard.reservedByTransferId)
        ) {
          throw new BadRequestException(
            `CARD item ${index + 1} is not eligible for reload`,
          );
        }
        if (row.isReload) {
          if (!passengerId || !matchedExistingPassenger) {
            throw new BadRequestException(
              "CARD reload requires an existing matched passenger",
            );
          }
          const priorPassengerSale = await this.transactionItemRepository
            .createQueryBuilder("item")
            .innerJoin("item.transaction", "priorTransaction")
            .where("item.card_id = :cardId", { cardId: String(row.cardId) })
            .andWhere("priorTransaction.passenger_id = :passengerId", {
              passengerId,
            })
            .andWhere("priorTransaction.transaction_type = :transactionType", {
              transactionType: TransactionType.SALE,
            })
            .andWhere("priorTransaction.status = :status", {
              status: TransactionStatus.APPROVED,
            })
            .andWhere("priorTransaction.id <> :currentTransactionId", {
              currentTransactionId: transaction.id,
            })
            .getOne();
          if (!priorPassengerSale) {
            throw new BadRequestException(
              `CARD item ${index + 1} was not previously sold to this passenger`,
            );
          }
        }
        if (
          selectedCard.receiptItem?.issuerPartyProfileId !==
          row.issuerPartyProfileId
        ) {
          throw new BadRequestException(
            `CARD item ${index + 1} issuer does not match the selected CARD`,
          );
        }
        if (
          selectedCard.receiptItem?.productId &&
          selectedCard.receiptItem.productId !== String(product.id)
        ) {
          throw new BadRequestException(
            `CARD item ${index + 1} product does not match the selected CARD`,
          );
        }
        if (
          !isMultiCurrencyCard &&
          selectedCard.receiptItem?.currencyId !== String(currency.id)
        ) {
          throw new BadRequestException(
            `CARD item ${index + 1} currency does not match the selected CARD`,
          );
        }
        const issuerLink = await this.productCardIssuerRepository.findOne({
          where: {
            productId: String(product.id),
            partyProfileId: String(row.issuerPartyProfileId),
          },
        });
        if (!issuerLink)
          throw new BadRequestException(
            `Issuer is not linked to CARD product for item ${index + 1}`,
          );
      }
      const cardSellAccountId = isCardItem
        ? await this.additionalSettingService.getSettingTextValue(
            "TRANSACTION_ACCOUNTING",
            "CARD_SELL_CONTROL_ACCOUNT",
          )
        : null;
      const itemAccount = isCardItem
        ? cardSellAccountId
          ? await this.accountProfileRepository.findOne({
              where: { id: cardSellAccountId, active: true },
            })
          : null
        : isFakeCurrency
          ? productEntity.fakeAccount
          : resolveProductTransactionAccount(
              productEntity,
              transactionPayload.transactionType,
              transactionPayload.tradeMode,
              transactionPayload.transactionType === TransactionType.SALE
                ? "sale"
                : "purchase",
            );

      if (!itemAccount) {
        throw new NotFoundException(
          `${isCardItem ? "CARD sell control account" : isFakeCurrency ? "Fake account" : "Product account"} is not configured for product ${row.productId}`,
        );
      }

      const accountSnapshot = await loadEntitySnapshot(
        this.accountProfileRepository,
        itemAccount.id,
      );

      const transactionItemToSave: DeepPartial<TransactionItem> = {
        transactionId: transaction.id,
        transaction,
        lineNo: index + 1,
        currencyId: String(currency.id),
        productId: String(product.id),
        accountId: itemAccount.id,
        accountSnapshot,
        currencyRateId: row.currencyRateId ?? null,
        productCurrencyRateId: row.productCurrencyRateId ?? null,
        quantity: String(row.quantity),
        per: row.per === null || row.per === undefined ? null : String(row.per),
        rate: String(row.rate),
        commission: row.commission ?? null,
        currencySnapshot: currency as TransactionReferenceSnapshotValue,
        productSnapshot: product as TransactionReferenceSnapshotValue,
        currencyRateSnapshot: row.currencyRateSnapshot ?? null,
        productCurrencyRateSnapshot: row.productCurrencyRateSnapshot ?? null,
        pricingRuleSnapshot: row.pricingRuleSnapshot ?? null,
        commissionSnapshot: row.commissionSnapshot ?? null,
        cardId: row.cardId ?? null,
        issuerPartyProfileId: row.issuerPartyProfileId ?? null,
        issuerPartyProfileSnapshot: row.issuerPartyProfileSnapshot ?? null,
        cardSnapshot: row.cardSnapshot ?? null,
        isReload: Boolean(row.isReload),
        remarks: row.remarks ?? null,
        createdBy: performedById,
        updatedBy: performedById,
      };

      const savedItem = await this.transactionItemRepository.save(
        this.transactionItemRepository.create(transactionItemToSave),
      );
      if (
        savedItem.cardId &&
        transaction.transactionType === TransactionType.SALE
      ) {
        cardSaleItems.push(savedItem);
      }
    }

    const documentRows = Array.isArray(transactionPayload.documents)
      ? transactionPayload.documents
      : [];
    for (let index = 0; index < documentRows.length; index += 1) {
      const row = documentRows[index];
      const attachment = attachments[index];
      const upload = filesByIndex.get(index);
      const documentProfile = await resolveDocumentProfile(
        String(row.documentProfileId),
      );

      let storageKey: string | null = null;
      let storageUrl: string | null = null;
      let content: Buffer | null = null;
      let fileName: string | null =
        attachment?.fileName ?? upload?.originalname ?? null;
      let originalFileName: string | null = upload?.originalname ?? null;
      let mimeType: string | null = upload?.mimetype ?? null;
      let fileSize: string | null =
        upload?.size != null ? String(upload.size) : null;

      if (upload?.buffer) {
        const safeName = upload.originalname.replace(/[^\w.\-]+/g, "_");
        storageKey = `transactions/${transaction.id}/documents/${index + 1}-${documentProfile.id}-${safeName}`;
        try {
          storageUrl = await this.storageService.store(
            storageKey,
            upload.buffer,
          );
        } catch (error) {
          console.warn(
            "[TransactionsService] Falling back to database storage for transaction document upload",
            {
              transactionId: transaction.id,
              documentProfileId: documentProfile.id,
              storageKey,
              reason: error instanceof Error ? error.message : error,
            },
          );
          content = upload.buffer;
          storageKey = null;
          storageUrl = null;
        }
      }

      const transactionDocumentToSave: DeepPartial<TransactionDocument> = {
        transactionId: transaction.id,
        transaction,
        lineNo: index + 1,
        documentProfileId: String(documentProfile.id),
        documentProfileSnapshot:
          documentProfile as TransactionReferenceSnapshotValue,
        status: row.status ?? TransactionDocumentStatus.ATTACHED,
        fileName,
        originalFileName,
        mimeType,
        fileSize,
        storageKey,
        storagePath: storageKey,
        storageUrl,
        content,
        remarks: row.remarks ?? null,
        createdBy: performedById,
        updatedBy: performedById,
      };

      await this.transactionDocumentRepository.save(
        this.transactionDocumentRepository.create(transactionDocumentToSave),
      );
    }

    const additionalChargeRows = Array.isArray(
      transactionPayload.additionalCharges,
    )
      ? transactionPayload.additionalCharges
      : [];
    for (let index = 0; index < additionalChargeRows.length; index += 1) {
      const row = additionalChargeRows[index];
      const account = await resolveAccount(String(row.accountId));
      await this.transactionAdditionalChargeRepository.save(
        this.transactionAdditionalChargeRepository.create({
          transactionId: transaction.id,
          transaction,
          lineNo: index + 1,
          accountId: String(account.id),
          accountSnapshot: account as TransactionReferenceSnapshotValue,
          amount: roundMoney(this.toNumber(row.amount)),
          remarks: row.remarks ?? null,
          createdBy: performedById,
          updatedBy: performedById,
        }),
      );
    }

    const refreshedTransaction = await this.transactionRepository.findOne({
      where: { id: transaction.id },
    });
    if (!refreshedTransaction) {
      throw new BadRequestException("Failed to calculate transaction tax");
    }

    const paymentRows = isFakeCurrency
      ? []
      : Array.isArray(transactionPayload.payments)
        ? transactionPayload.payments
        : [];
    const payableTotal = String(refreshedTransaction.finalAmount ?? "0");
    const payableTotalAmount = Number(payableTotal || 0);
    const requiresPaymentRows = isCorporateIndividualTransactionContext(
      transactionPayload.slug,
      transactionPayload.transactionPartyProfileType ??
        transactionPartyProfileType,
      passengerPayload?.entityType,
    );
    if (
      !isFakeCurrency &&
      requiresPaymentRows &&
      payableTotalAmount > 0 &&
      paymentRows.length === 0
    ) {
      throw new BadRequestException("At least one payment row is required");
    }

    const paymentMethods = isFakeCurrency
      ? []
      : paymentRows.map((row) => this.resolvePaymentMethod(row.paymentMethod));
    if (new Set(paymentMethods).size > 1) {
      throw new BadRequestException(
        "All payment rows must use the same payment method",
      );
    }

    const paymentDirection =
      transactionPayload.transactionType === TransactionType.SALE
        ? TransactionPaymentDirection.RECEIPT
        : TransactionPaymentDirection.PAYMENT;
    let cashTotal = 0;
    let chequeTotal = 0;
    const savedPaymentRows: TransactionPayment[] = [];
    const advanceRequests: Array<AdvanceApplicationPayloadDto | null> = [];
    for (let index = 0; index < paymentRows.length; index += 1) {
      const row = paymentRows[index];
      const paymentMethod = this.resolvePaymentMethod(row.paymentMethod);
      const advanceVoucherId = normalizeNullableString(row.advanceVoucherId);
      const isAdvance = Boolean(
        advanceVoucherId ||
        row.settlementSource === TransactionSettlementSource.ADVANCE,
      );
      if (isAdvance && !advanceVoucherId)
        throw new BadRequestException(
          "Advance voucher is required for an advance settlement row",
        );
      const preparedAdvance = advanceVoucherId
        ? await this.voucherService.prepareAdvancePayment({
            voucherId: advanceVoucherId,
            amount: row.amount,
            transactionType: transactionPayload.transactionType,
            paymentMethod,
            partyProfileId: String(transactionPayload.partyProfileId),
            branchId: String(resolvedBranchId),
            transactionDate: resolvedTransactionDate,
          })
        : null;
      const accountId = preparedAdvance
        ? String(preparedAdvance.voucher.advanceControlAccountId)
        : String(row.accountId);
      const account = preparedAdvance
        ? preparedAdvance.voucher.advanceControlAccountSnapshot
        : await resolveAccount(accountId);
      const chequePageId = normalizeNullableString(row.chequePageId);
      const amount = this.toNumber(row.amount);
      if (amount <= 0) {
        throw new BadRequestException(
          "Payment amount must be greater than zero",
        );
      }

      if (paymentMethod === TransactionPaymentMethod.CASH) {
        if (!isAdvance) {
          const cashAccount = await this.accountProfileRepository.findOne({
            where: { id: accountId, active: true },
            relations: ["accountType", "currency"],
          });
          const cashAccountTypes = [
            cashAccount?.accountType?.value,
            cashAccount?.accountType?.label,
          ].map((value) =>
            String(value ?? "")
              .trim()
              .replace(/[\s-]+/g, "_")
              .toUpperCase(),
          );
          if (!cashAccount || !cashAccountTypes.includes("CASH_LEDGER")) {
            throw new BadRequestException(
              "Cash payments require an active CASH LEDGER account",
            );
          }
          if (
            String(cashAccount.currency?.currencyCode ?? "").toUpperCase() !==
            "INR"
          ) {
            throw new BadRequestException(
              "Cash payment accounts must use INR currency",
            );
          }
        }
        cashTotal += amount;
      } else {
        chequeTotal += amount;
      }

      if (
        paymentMethod === TransactionPaymentMethod.CHEQUE &&
        !String(
          preparedAdvance?.voucher.chequeNumber ?? row.referenceNumber ?? "",
        ).trim()
      ) {
        throw new BadRequestException("Cheque reference number is required");
      }

      if (
        paymentMethod === TransactionPaymentMethod.CHEQUE &&
        !String(
          preparedAdvance?.voucher.chequeDate ?? row.referenceDate ?? "",
        ).trim()
      ) {
        throw new BadRequestException("Cheque date is required");
      }

      if (
        paymentMethod === TransactionPaymentMethod.CHEQUE &&
        transactionPayload.transactionType === TransactionType.SALE &&
        chequePageId
      ) {
        throw new BadRequestException(
          "Cheque page lookup is not allowed for sale cheque payments",
        );
      }

      if (
        paymentMethod === TransactionPaymentMethod.CHEQUE &&
        transactionPayload.transactionType === TransactionType.PURCHASE &&
        !chequePageId &&
        !isAdvance
      ) {
        throw new BadRequestException(
          "Cheque page is required for purchase payments",
        );
      }

      const chequePageSnapshot = chequePageId
        ? ((await loadEntitySnapshot(
            this.chequeBookPageTrackingRepository,
            String(chequePageId),
          )) as TransactionReferenceSnapshotValue)
        : null;

      if (chequePageId && !chequePageSnapshot) {
        throw new NotFoundException(
          `Cheque page with id ${chequePageId} not found`,
        );
      }

      const savedPayment = await this.transactionPaymentRepository.save(
        this.transactionPaymentRepository.create({
          transactionId: transaction.id,
          transaction,
          lineNo: index + 1,
          accountId,
          accountSnapshot: account as TransactionReferenceSnapshotValue,
          settlementSource: isAdvance
            ? TransactionSettlementSource.ADVANCE
            : TransactionSettlementSource.NORMAL,
          advanceVoucherId,
          chequePageId,
          chequePageSnapshot,
          paymentMethod,
          paymentDirection,
          referenceNumber: normalizeNullableString(
            preparedAdvance?.voucher.chequeNumber ?? row.referenceNumber,
          ),
          referenceDate: normalizeNullableString(
            preparedAdvance?.voucher.chequeDate ?? row.referenceDate,
          ),
          branchName: normalizeNullableString(
            preparedAdvance?.voucher.chequeBranch ?? row.branchName,
          ),
          drawnOn: normalizeNullableString(
            preparedAdvance?.voucher.drawnOn ?? row.drawnOn,
          ),
          amount: String(row.amount),
          remarks: normalizeNullableString(row.remarks),
          createdBy: performedById,
          updatedBy: performedById,
        }),
      );
      savedPaymentRows.push(savedPayment);
      advanceRequests.push(
        preparedAdvance
          ? {
              voucherId: preparedAdvance.voucher.id,
              amount: String(row.amount),
            }
          : null,
      );
    }

    const totalPaid = Number((cashTotal + chequeTotal).toFixed(2));
    const shouldMatchPaymentTotal =
      !isFakeCurrency &&
      (requiresPaymentRows || paymentRows.length > 0);
    if (
      shouldMatchPaymentTotal &&
      Number(payableTotal.toString()) !== totalPaid
    ) {
      throw new BadRequestException(
        `Payment total ${totalPaid.toFixed(2)} must match payable total ${payableTotal}`,
      );
    }

    transaction.byCash = cashTotal.toFixed(2);
    transaction.byCheque = chequeTotal.toFixed(2);
    transaction.updatedBy = performedById;
    await this.transactionRepository.save(transaction);

    if (advanceRequests.some(Boolean)) {
      try {
        await this.database2.transaction((manager) =>
          this.voucherService.reserveApplications(
            manager,
            transaction,
            savedPaymentRows,
            advanceRequests,
            performedById,
          ),
        );
      } catch (error) {
        await this.transactionRepository.delete(transaction.id);
        throw error;
      }
    }

    if (shouldAutoFinalizeCardSale && cardSaleItems.length) {
      const finalized = await this.database2.transaction(async (manager) => {
        const transactionRepo = manager.getRepository(Transaction);
        const locked = await transactionRepo
          .createQueryBuilder("transaction")
          .where("transaction.id = :id", { id: transaction.id })
          .setLock("pessimistic_write")
          .getOne();
        if (!locked || locked.status !== TransactionStatus.DRAFT) {
          throw new BadRequestException(
            "CARD sale is no longer available for automatic approval",
          );
        }
        locked.status = TransactionStatus.APPROVED;
        locked.approvedAt = now;
        locked.approvedById = performedById;
        locked.updatedBy = performedById;
        const approved = await transactionRepo.save(locked);
        await this.voucherService.applyReservations(
          manager,
          approved.id,
          performedById,
        );
        const approvedItems = await manager
          .getRepository(TransactionItem)
          .find({ where: { transactionId: approved.id } });
        await this.cardStockSaleLifecycleService.finalizeApprovedSale(
          manager,
          approved,
          approvedItems.filter((item) => Boolean(item.cardId)),
          performedById,
        );
        return approved;
      });
      Object.assign(transaction, finalized);
    }

    await this.transactionLogRepository.save(
      this.transactionLogRepository.create({
        transactionId: transaction.id,
        action: TransactionLogAction.CREATE,
        message: shouldRequireApproval
          ? "Transaction draft created"
          : "Transaction approved on creation",
        metadata: {
          status: transactionStatus,
          requiresApproval: shouldRequireApproval,
        },
        performedById,
        createdBy: performedById,
        updatedBy: performedById,
      }),
    );

    const partyProfileForEmail = await this.partyProfileRepository.findOne({
      where: { id: transaction.partyProfileId },
      select: {
        id: true,
        name: true,
        code: true,
        email: true,
      },
    });

    if (partyProfileForEmail?.email) {
      try {
        const transactionLabel = transaction.number || "Transaction";
        await this.mailService.sendEmail({
          to: partyProfileForEmail.email,
          subject: `${transactionLabel} - Transaction Created`,
          text: `Your transaction ${transactionLabel} has been created successfully. You can print the original copy from the transaction documents screen.`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <p>Your transaction <strong>${transactionLabel}</strong> has been created successfully.</p>
              <p>You can print the original copy from the transaction documents screen.</p>
            </div>
          `,
        });
      } catch (error) {
        console.warn(
          "[TransactionsService] Failed to send transaction created email",
          {
            transactionId: transaction.id,
            partyProfileId: partyProfileForEmail.id,
            email: partyProfileForEmail.email,
            reason: error instanceof Error ? error.message : error,
          },
        );
      }
    }

    const savedTransaction = (await this.transactionRepository.findOne({
      where: { id: transaction.id },
    })) as Transaction;

    await this.hydrateCounterSnapshot(savedTransaction);

    return savedTransaction;
  }

  async approveTransaction(
    transactionId: string,
    performedById: string | null,
    approvalRemarks: string | null = null,
    activeCounterId: string | null = null,
  ): Promise<Transaction> {
    if (!performedById) {
      throw new BadRequestException("User session not found");
    }

    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, isLatest: true },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with id ${transactionId} not found`,
      );
    }

    if (transaction.status !== TransactionStatus.DRAFT) {
      throw new BadRequestException("Only draft transactions can be approved");
    }

    if (!transaction.number) {
      transaction.number = await this.generateTransactionNumber(
        transaction.slug,
        transaction.branchSnapshot as
          | Record<string, unknown>
          | null
          | undefined,
      );
    }

    if (!transaction.counterId) {
      if (!activeCounterId) {
        throw new BadRequestException("Counter is required");
      }

      const counterSnapshot = await loadEntitySnapshot(
        this.counterRepository,
        activeCounterId,
      );

      if (!counterSnapshot) {
        throw new NotFoundException(
          `Counter with id ${activeCounterId} not found`,
        );
      }

      transaction.counterId = activeCounterId;
      transaction.counterSnapshot =
        counterSnapshot as TransactionReferenceSnapshotValue;
    }

    const saved = await this.database2.transaction(async (manager) => {
      const transactionRepo = manager.getRepository(Transaction);
      const itemRepo = manager.getRepository(TransactionItem);
      const logRepo = manager.getRepository(TransactionLog);
      const locked = await transactionRepo
        .createQueryBuilder("transaction")
        .where("transaction.id = :id", { id: transaction.id })
        .setLock("pessimistic_write")
        .getOne();
      if (!locked || locked.status !== TransactionStatus.DRAFT)
        throw new BadRequestException(
          "Only draft transactions can be approved",
        );
      locked.number = transaction.number;
      locked.counterId = transaction.counterId;
      locked.counterSnapshot = transaction.counterSnapshot;
      locked.status = TransactionStatus.APPROVED;
      locked.submittedAt = locked.submittedAt ?? new Date();
      locked.approvedAt = new Date();
      locked.approvedById = performedById;
      locked.approvalRemarks = approvalRemarks;
      locked.updatedBy = performedById;
      const approved = await transactionRepo.save(locked);
      await this.voucherService.applyReservations(
        manager,
        approved.id,
        performedById,
      );
      const approvedItems = await itemRepo.find({
        where: { transactionId: approved.id },
      });
      const cardItems = approvedItems.filter((item) => Boolean(item.cardId));
      if (cardItems.length)
        await this.cardStockSaleLifecycleService.finalizeApprovedSale(
          manager,
          approved,
          cardItems,
          performedById,
        );
      await logRepo.save(
        logRepo.create({
          transactionId: approved.id,
          action: TransactionLogAction.APPROVE,
          message: "Transaction approved",
          metadata: {
            status: TransactionStatus.APPROVED,
            approvalRemarks,
          },
          performedById,
          createdBy: performedById,
          updatedBy: performedById,
        }),
      );
      return approved;
    });

    const approvedTransaction = (await this.transactionRepository.findOne({
      where: { id: saved.id },
    })) as Transaction;

    await this.hydrateCounterSnapshot(approvedTransaction);

    return approvedTransaction;
  }

  async getTransactionById(
    id: string,
    userId?: string | null,
    activeBranchId?: string | null,
  ): Promise<Transaction | null> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: {
        items: true,
        documents: true,
        additionalCharges: true,
        payments: { advanceApplication: { voucher: true } },
        postings: true,
        logs: true,
      },
    });

    if (!transaction) {
      return null;
    }

    if (
      !(await this.canAccessTransaction(
        transaction,
        userId ?? null,
        activeBranchId ?? null,
      ))
    ) {
      throw new NotFoundException("Transaction not found");
    }

    await this.hydratePartyProfileSnapshot(transaction);
    await this.hydrateAgentProfileSnapshot(transaction);
    await this.hydrateCounterSnapshot(transaction);

    return transaction;
  }

  async downloadDocument(
    transactionId: string,
    documentId: string,
    userId?: string | null,
    activeBranchId?: string | null,
  ): Promise<
    | { redirectUrl: string; fileName: string; mimeType: string }
    | { file: StreamableFile; fileName: string; mimeType: string }
  > {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      select: { id: true, branchId: true },
    });

    if (
      !transaction ||
      !(await this.canAccessTransaction(
        transaction as Transaction,
        userId ?? null,
        activeBranchId ?? null,
      ))
    ) {
      throw new NotFoundException("Transaction not found");
    }

    const document = await this.transactionDocumentRepository.findOne({
      where: {
        id: documentId,
        transactionId,
      },
    });

    if (!document) {
      throw new NotFoundException("Transaction document not found");
    }

    const fileName =
      document.fileName || document.originalFileName || "transaction-document";
    const mimeType = document.mimeType || "application/octet-stream";

    if (document.storageUrl) {
      return {
        redirectUrl: document.storageUrl,
        fileName,
        mimeType,
      };
    }

    if (document.content) {
      return {
        file: new StreamableFile(document.content),
        fileName,
        mimeType,
      };
    }

    throw new NotFoundException("Transaction document file not available");
  }

  async recordPrint(
    transactionId: string,
    dto: RecordTransactionPrintDto,
    performedById: string | null,
    activeBranchId?: string | null,
  ): Promise<{ message: string; messageId?: string }> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      select: { id: true, branchId: true },
    });

    if (
      !transaction ||
      !(await this.canAccessTransaction(
        transaction as Transaction,
        performedById,
        activeBranchId ?? null,
      ))
    ) {
      throw new NotFoundException("Transaction not found");
    }

    const existingPrintCount = await this.transactionLogRepository.count({
      where: {
        transactionId,
        action: TransactionLogAction.PRINT,
      },
    });
    const copyType =
      existingPrintCount === 0 ? "CUSTOMER_COPY" : "DUPLICATE_COPY";
    const message =
      copyType === "DUPLICATE_COPY"
        ? "Duplicate copy printed"
        : "Original copy printed";
    let messageId: string | undefined;

    if (dto.sendEmail) {
      if (!dto.recipientEmail) {
        throw new BadRequestException(
          "Recipient email is required to send the customer copy",
        );
      }

      const sent = await this.mailService.sendEmail({
        to: dto.recipientEmail,
        subject: dto.subject || "Buy From Print Copy",
        text:
          dto.text ||
          "Please find the requested transaction copy attached in the email body.",
        html: dto.html,
      });
      messageId = sent.messageId;
    }

    await this.transactionLogRepository.save(
      this.transactionLogRepository.create({
        transactionId,
        action: TransactionLogAction.PRINT,
        message,
        metadata: {
          copyType,
          requestedCopyType: dto.copyType ?? null,
          sendEmail: Boolean(dto.sendEmail),
          recipientEmail: dto.recipientEmail || null,
          subject: dto.subject || null,
          emailMessageId: messageId || null,
        },
        performedById,
        createdBy: performedById,
        updatedBy: performedById,
      }),
    );

    return {
      message,
      messageId,
    };
  }
}
