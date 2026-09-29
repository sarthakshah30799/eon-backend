import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { Currency } from "../currencies/currency.entity";
import { CurrencyRatesService } from "../currency-rates/currency-rates.service";
import { CurrencyRateProvider } from "../currency-rates/currency-rates.enums";
import { CurrencyRate } from "../currency-rates/currency-rate.entity";
import { Product } from "../products/product.entity";
import {
  Passenger,
  PassengerEntityType,
  PassengerNationalityType,
} from "../passengers/passenger.entity";
import { Transaction } from "./entities/transaction.entity";
import {
  isChequeFamilyPaymentMethod,
  TransactionPaymentMethod,
  TransactionStatus,
  TransactionType,
} from "./transactions.enums";

type PurchaseRuleConfig = {
  referenceCurrencyCode: string;
  cdfThresholdAmount: number;
  indianCashLimitAmount: number;
  nriCashLimitAmount: number;
  windowDays: number;
};

type PurchaseRuleCandidate = {
  passenger: Passenger;
  matchTier: number;
};

type PurchaseRulePassengerInput = {
  id?: string | null;
  entityType?: string;
  nationalityType?: string;
  contactNo?: string;
  address1?: string;
  panNumber?: string;
  panHolderName?: string;
  panDob?: string;
  passportNumber?: string;
  passportPassengerName?: string;
  arrivalDate?: string;
};

type PurchaseRuleTransactionBlock = {
  id?: string | null;
  transactionType?: string | null;
  transactionDate?: string | null;
  slug?: string | null;
  passenger?: PurchaseRulePassengerInput | null;
  items?: PurchaseRuleRowInput[] | null;
  additionalCharges?: PurchaseRuleRowInput[] | null;
  payments?: PurchaseRulePaymentInput[] | null;
};

type PurchaseRuleTransactionInput = {
  id?: string | null;
  transactionType?: string | null;
  transactionDate?: string | null;
  slug?: string | null;
  transaction?: PurchaseRuleTransactionBlock | null;
  passenger?: PurchaseRulePassengerInput | null;
  items?: PurchaseRuleRowInput[] | null;
  additionalCharges?: PurchaseRuleRowInput[] | null;
  payments?: PurchaseRulePaymentInput[] | null;
};

type PurchaseRuleRowInput = {
  quantity?: string | number;
  rate?: string | number;
  per?: string | number;
  currencyId?: string | null;
  productId?: string | null;
  productCode?: string | null;
  amount?: string | number;
};

type PurchaseRulePaymentInput = {
  paymentMethod?: string;
  amount?: string | number;
};

export type PurchaseRulePreviewResponse = {
  allowed: boolean;
  ruleType:
    | "OK"
    | "CORPORATE_CHEQUE_ONLY"
    | "CDF_REQUIRED"
    | "CASH_LIMIT_EXCEEDED"
    | "CHEQUE_NOT_ALLOWED"
    | "HISTORY_LIMIT_EXCEEDED"
    | "MISSING_PASSENGER"
    | "MISSING_PAYMENT";
  blockingReason: string | null;
  blockingReasons: string[];
  requiresCdf: boolean;
  cdfThresholdAmount: string;
  referenceCurrencyCode: string;
  transactionAmount: string;
  transactionAmountInReferenceCurrency: string;
  cumulativeAmountInReferenceCurrency: string;
  cumulativeCashAmountInReferenceCurrency: string;
  cashLimitAmount: string;
  cashTotalAmount: string;
  chequeTotalAmount: string;
  passengerMatchTier: number | null;
  passengerId: string | null;
  isCorporate: boolean;
  nationalityType: string | null;
  paymentMethodsAllowed: Array<"CASH" | "CHEQUE">;
};

const normalize = (value?: string | null) => String(value ?? "").trim();
const normalizeUpper = (value?: string | null) =>
  normalize(value).toUpperCase();
const normalizeIdentity = (value?: string | null) => {
  const normalized = normalize(value).replace(/\s+/g, "").toUpperCase();
  return normalized || null;
};
const isTruthy = (value?: string | null) => Boolean(normalize(value));
const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const CN_PRODUCT_CODE = "CN";

type CalculateRowsOptions = {
  /** When set, only rows whose product code is in this list are converted. */
  productCodes?: string[] | null;
  includeCharges?: boolean;
  /** When true, only include past purchases that have at least one CASH payment. */
  requireCashPayment?: boolean;
};

@Injectable()
export class PurchaseRuleService {
  constructor(
    private readonly additionalSettingService: AdditionalSettingService,
    private readonly currencyRatesService: CurrencyRatesService,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Passenger)
    private readonly passengerRepository: Repository<Passenger>,
    @InjectRepository(Transaction, "database2")
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  private async getConfig(): Promise<PurchaseRuleConfig> {
    const [
      referenceCurrencyCode,
      cdfThresholdAmount,
      indianCashLimitAmount,
      nriCashLimitAmount,
      windowDays,
    ] = await Promise.all([
      this.additionalSettingService.getSettingTextValue(
        "PURCHASE_PASSENGER_RULE",
        "PURCHASE_PASSENGER_RULE_REFERENCE_CURRENCY_CODE",
      ),
      this.additionalSettingService.getSettingTextValue(
        "PURCHASE_PASSENGER_RULE",
        "PURCHASE_PASSENGER_RULE_CDF_THRESHOLD_AMOUNT",
      ),
      this.additionalSettingService.getSettingTextValue(
        "PURCHASE_PASSENGER_RULE",
        "PURCHASE_PASSENGER_RULE_INDIAN_CASH_LIMIT_AMOUNT",
      ),
      this.additionalSettingService.getSettingTextValue(
        "PURCHASE_PASSENGER_RULE",
        "PURCHASE_PASSENGER_RULE_NRI_CASH_LIMIT_AMOUNT",
      ),
      this.additionalSettingService.getSettingTextValue(
        "PURCHASE_PASSENGER_RULE",
        "PURCHASE_PASSENGER_RULE_WINDOW_DAYS",
      ),
    ]);

    return {
      referenceCurrencyCode: normalize(referenceCurrencyCode) || "USD",
      cdfThresholdAmount: toNumber(cdfThresholdAmount || 5000),
      indianCashLimitAmount: toNumber(indianCashLimitAmount || 1000),
      nriCashLimitAmount: toNumber(nriCashLimitAmount || 3000),
      windowDays: Math.max(1, Math.trunc(toNumber(windowDays || 30)) || 30),
    };
  }

  private getTransactionPassengerInput(body: PurchaseRuleTransactionInput) {
    return body.transaction?.passenger ?? body.passenger ?? null;
  }

  private getItems(body: PurchaseRuleTransactionInput): PurchaseRuleRowInput[] {
    if (Array.isArray(body.transaction?.items)) {
      return body.transaction.items;
    }

    return Array.isArray(body.items) ? body.items : [];
  }

  private getAdditionalCharges(
    body: PurchaseRuleTransactionInput,
  ): PurchaseRuleRowInput[] {
    if (Array.isArray(body.transaction?.additionalCharges)) {
      return body.transaction.additionalCharges;
    }

    return Array.isArray(body.additionalCharges) ? body.additionalCharges : [];
  }

  private getPayments(
    body: PurchaseRuleTransactionInput,
  ): PurchaseRulePaymentInput[] {
    if (Array.isArray(body.transaction?.payments)) {
      return body.transaction.payments;
    }

    return Array.isArray(body.payments) ? body.payments : [];
  }

  private resolveTransactionType(body: PurchaseRuleTransactionInput): string {
    return normalizeUpper(
      body.transaction?.transactionType ?? body.transactionType,
    );
  }

  private resolveExcludeTransactionId(
    body: PurchaseRuleTransactionInput,
  ): string | null {
    const excludeId = normalize(body.transaction?.id ?? body.id);
    return excludeId || null;
  }

  private resolveHistoryWindow(
    body: PurchaseRuleTransactionInput,
    windowDays: number,
  ): { windowStart: Date; windowEnd: Date } {
    const rawDate = normalize(
      body.transaction?.transactionDate ?? body.transactionDate,
    );
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    const windowEnd = Number.isNaN(parsedDate.getTime())
      ? new Date()
      : parsedDate;
    const startOfEndDay = new Date(
      Date.UTC(
        windowEnd.getUTCFullYear(),
        windowEnd.getUTCMonth(),
        windowEnd.getUTCDate(),
      ),
    );
    const exclusiveEnd = new Date(startOfEndDay);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    const windowStart = new Date(startOfEndDay);
    windowStart.setUTCDate(windowStart.getUTCDate() - Math.max(1, windowDays));

    return { windowStart, windowEnd: exclusiveEnd };
  }

  private calculateRowAmount(row: PurchaseRuleRowInput) {
    const quantity = toNumber(row.quantity);
    const rate = toNumber(row.rate);
    const per = Math.max(1, toNumber(row.per) || 1);
    return (quantity * rate) / per;
  }

  private async resolveCurrencyByCodeOrId(
    currencyValue?: string | null,
  ): Promise<Pick<Currency, "id" | "currencyCode" | "ratePer"> | null> {
    const normalizedValue = normalize(currencyValue);

    if (!normalizedValue) {
      return null;
    }

    const byCode = await this.currencyRepository.findOne({
      where: { currencyCode: normalizeUpper(normalizedValue) },
      select: { id: true, currencyCode: true, ratePer: true },
    });

    if (byCode) {
      return byCode;
    }

    return this.currencyRepository.findOne({
      where: { id: normalizedValue },
      select: { id: true, currencyCode: true, ratePer: true },
    });
  }

  private resolvePositiveDivisor(value: unknown, fallback = 1): number {
    const parsed = toNumber(value);
    return parsed > 0 ? parsed : fallback;
  }

  /**
   * Currency master Rate/Per unit divisor (e.g. per 1 / per 100).
   * If currency/code is missing or ratePer is empty/invalid, use 1 (same as before).
   * Kept separate from the FX board base rate.
   */
  private async resolveReferenceRatePer(
    referenceCurrencyValue: string,
  ): Promise<number> {
    const currency = await this.resolveCurrencyByCodeOrId(
      referenceCurrencyValue,
    );

    return Math.max(1, toNumber(currency?.ratePer || 1) || 1);
  }

  /**
   * Base FX rate shown under Currency Rates → Product Currency Overrides
   * ("Base Price"), from the latest currency_rates board entry.
   * Purchase side uses buy base for TICKER providers.
   */
  private pickReferenceBaseRate(rate: CurrencyRate | null | undefined): number {
    if (!rate) {
      return 1;
    }

    const raw =
      rate.provider === CurrencyRateProvider.TICKER
        ? rate.baseBuyRate || rate.baseRate || rate.baseSaleRate
        : rate.baseRate || rate.baseBuyRate || rate.baseSaleRate;
    return this.resolvePositiveDivisor(raw, 1);
  }

  private async resolveReferenceBaseRate(
    referenceCurrencyValue: string,
  ): Promise<number> {
    const currency = await this.resolveCurrencyByCodeOrId(
      referenceCurrencyValue,
    );

    if (!currency?.id) {
      return 1;
    }

    const [latestRate] = await this.currencyRatesService.findLatestRates(
      currency.id,
    );

    return this.pickReferenceBaseRate(latestRate ?? null);
  }

  private async resolveProductCodesByIds(
    productIds: string[],
  ): Promise<Map<string, string>> {
    const uniqueIds = Array.from(
      new Set(productIds.map((id) => normalize(id)).filter(Boolean)),
    );
    const codeById = new Map<string, string>();

    if (!uniqueIds.length) {
      return codeById;
    }

    const products = await this.productRepository.find({
      where: { id: In(uniqueIds) },
      select: { id: true, productCode: true },
    });

    for (const product of products) {
      codeById.set(product.id, normalizeUpper(product.productCode));
    }

    return codeById;
  }

  private async filterRowsByProductCodes(
    items: PurchaseRuleRowInput[],
    productCodes: string[],
  ): Promise<PurchaseRuleRowInput[]> {
    const allowed = new Set(productCodes.map((code) => normalizeUpper(code)));
    const missingProductIds = items
      .filter((item) => !normalizeUpper(item.productCode) && normalize(item.productId))
      .map((item) => normalize(item.productId));
    const codeById = await this.resolveProductCodesByIds(missingProductIds);

    return items.filter((item) => {
      const explicitCode = normalizeUpper(item.productCode);
      if (explicitCode) {
        return allowed.has(explicitCode);
      }

      const resolvedCode = codeById.get(normalize(item.productId)) ?? "";
      return allowed.has(resolvedCode);
    });
  }

  private async calculateRowsAmountInReferenceCurrency(
    items: PurchaseRuleRowInput[],
    charges: PurchaseRuleRowInput[],
    config: PurchaseRuleConfig,
    options: CalculateRowsOptions = {},
  ): Promise<{ transactionAmount: number; referenceAmount: number }> {
    const includeCharges = options.includeCharges !== false;
    const filteredItems = options.productCodes?.length
      ? await this.filterRowsByProductCodes(items, options.productCodes)
      : items;

    const referenceCurrency = await this.resolveCurrencyByCodeOrId(
      config.referenceCurrencyCode,
    );
    const referenceCurrencyCode = normalizeUpper(
      referenceCurrency?.currencyCode ?? config.referenceCurrencyCode,
    );
    const referenceRatePer = Math.max(
      1,
      toNumber(referenceCurrency?.ratePer || 1) || 1,
    );
    const referenceBaseRate = await this.resolveReferenceBaseRate(
      config.referenceCurrencyCode,
    );
    const currencyCache = new Map<
      string,
      Pick<Currency, "id" | "currencyCode" | "ratePer">
    >();

    const resolveRowCurrency = async (currencyId?: string | null) => {
      const normalizedCurrencyId = normalize(currencyId);
      if (!normalizedCurrencyId) {
        return null;
      }

      const cachedCurrency = currencyCache.get(normalizedCurrencyId);
      if (cachedCurrency) {
        return cachedCurrency;
      }

      const resolvedCurrency =
        await this.resolveCurrencyByCodeOrId(normalizedCurrencyId);
      if (resolvedCurrency) {
        currencyCache.set(normalizedCurrencyId, resolvedCurrency);
      }

      return resolvedCurrency;
    };

    let transactionAmount = 0;
    let referenceAmount = 0;

    for (const item of filteredItems) {
      const quantity = toNumber(item.quantity);
      const rate = toNumber(item.rate);
      const rowCurrency = await resolveRowCurrency(item.currencyId);
      // Line INR uses item.per when present, otherwise the currency master ratePer.
      // Missing/invalid values fall back to 1 (same as previous behavior).
      const per = Math.max(
        1,
        toNumber(item.per ?? rowCurrency?.ratePer ?? 1) || 1,
      );
      const baseAmount = (quantity * rate) / per;
      transactionAmount += baseAmount;

      const rowCurrencyCode = normalizeUpper(rowCurrency?.currencyCode);

      if (rowCurrencyCode && rowCurrencyCode === referenceCurrencyCode) {
        referenceAmount += quantity;
      } else {
        // Keep ratePer divisor, then apply board baseRate FX conversion.
        referenceAmount += this.convertAmountToReferenceCurrency(
          baseAmount,
          referenceRatePer,
          referenceBaseRate,
        );
      }
    }

    if (includeCharges) {
      for (const charge of charges) {
        const amount = toNumber(charge.amount);
        transactionAmount += amount;
        referenceAmount += this.convertAmountToReferenceCurrency(
          amount,
          referenceRatePer,
          referenceBaseRate,
        );
      }
    }

    return { transactionAmount, referenceAmount };
  }

  private async calculateTransactionAmountInReferenceCurrency(
    body: PurchaseRuleTransactionInput,
    config: PurchaseRuleConfig,
    options: CalculateRowsOptions = {},
  ): Promise<{ transactionAmount: number; referenceAmount: number }> {
    return this.calculateRowsAmountInReferenceCurrency(
      this.getItems(body),
      this.getAdditionalCharges(body),
      config,
      options,
    );
  }

  /**
   * INR → reference currency:
   * 1) divide by currency master ratePer (unit)
   * 2) divide by currency-rates board baseRate (FX)
   */
  private convertAmountToReferenceCurrency(
    amount: number,
    referenceRatePer: number,
    referenceBaseRate: number,
  ): number {
    const ratePer = Math.max(1, toNumber(referenceRatePer || 1) || 1);
    const baseRate = this.resolvePositiveDivisor(referenceBaseRate, 1);
    return amount / ratePer / baseRate;
  }

  private async findPassengerCandidate(
    body: PurchaseRuleTransactionInput,
  ): Promise<PurchaseRuleCandidate | null> {
    const passenger = this.getTransactionPassengerInput(body);
    if (!passenger) {
      return null;
    }

    // Prefer explicit passenger id from the form (set after AML / prior save).
    const passengerId = normalize(passenger.id);
    if (passengerId) {
      const byId = await this.passengerRepository.findOne({
        where: { id: passengerId },
      });
      if (byId) {
        return { passenger: byId, matchTier: 0 };
      }
    }

    const entityType = normalizeUpper(passenger.entityType);
    const nationalityType = normalizeUpper(passenger.nationalityType);
    const searchTiers: Array<{ tier: number; where: Record<string, unknown> }> =
      [];

    if (entityType === PassengerEntityType.CORPORATE) {
      const panNumber = normalizeIdentity(passenger.panNumber);
      if (panNumber) {
        searchTiers.push({ tier: 1, where: { panNumber } });
      }
      if (
        isTruthy(passenger.panHolderName) &&
        isTruthy(passenger.panDob) &&
        isTruthy(passenger.contactNo)
      ) {
        searchTiers.push({
          tier: 2,
          where: {
            panHolderName: normalize(passenger.panHolderName),
            panDob: normalize(passenger.panDob),
            contactNo: normalize(passenger.contactNo),
          },
        });
      }
      if (isTruthy(passenger.panHolderName) && isTruthy(passenger.contactNo)) {
        searchTiers.push({
          tier: 3,
          where: {
            panHolderName: normalize(passenger.panHolderName),
            contactNo: normalize(passenger.contactNo),
          },
        });
      }
      if (isTruthy(passenger.panHolderName) && isTruthy(passenger.panDob)) {
        searchTiers.push({
          tier: 4,
          where: {
            panHolderName: normalize(passenger.panHolderName),
            panDob: normalize(passenger.panDob),
          },
        });
      }
      if (isTruthy(passenger.address1) && isTruthy(passenger.panHolderName)) {
        searchTiers.push({
          tier: 5,
          where: {
            panHolderName: normalize(passenger.panHolderName),
            address1: normalize(String(passenger.address1)).slice(0, 15),
          },
        });
      }
    } else if (nationalityType === PassengerNationalityType.INDIAN) {
      const panNumber = normalizeIdentity(passenger.panNumber);
      if (panNumber) {
        searchTiers.push({ tier: 1, where: { panNumber } });
      }
      if (
        isTruthy(passenger.panHolderName) &&
        isTruthy(passenger.panDob) &&
        isTruthy(passenger.contactNo)
      ) {
        searchTiers.push({
          tier: 2,
          where: {
            panHolderName: normalize(passenger.panHolderName),
            panDob: normalize(passenger.panDob),
            contactNo: normalize(passenger.contactNo),
          },
        });
      }
      if (isTruthy(passenger.panHolderName) && isTruthy(passenger.contactNo)) {
        searchTiers.push({
          tier: 3,
          where: {
            panHolderName: normalize(passenger.panHolderName),
            contactNo: normalize(passenger.contactNo),
          },
        });
      }
      if (isTruthy(passenger.panHolderName) && isTruthy(passenger.panDob)) {
        searchTiers.push({
          tier: 4,
          where: {
            panHolderName: normalize(passenger.panHolderName),
            panDob: normalize(passenger.panDob),
          },
        });
      }
      if (isTruthy(passenger.panHolderName) && isTruthy(passenger.address1)) {
        searchTiers.push({
          tier: 5,
          where: {
            panHolderName: normalize(passenger.panHolderName),
            address1: normalize(String(passenger.address1)).slice(0, 15),
          },
        });
      }
    } else {
      const passportNumber = normalizeIdentity(passenger.passportNumber);
      const passportPassengerName = normalize(passenger.passportPassengerName);
      if (passportNumber) {
        searchTiers.push({ tier: 1, where: { passportNumber } });
      }
      if (passportNumber && isTruthy(passenger.contactNo)) {
        searchTiers.push({
          tier: 2,
          where: {
            passportNumber,
            contactNo: normalize(passenger.contactNo),
          },
        });
      }
      if (passportNumber && isTruthy(passportPassengerName)) {
        searchTiers.push({
          tier: 3,
          where: {
            passportNumber,
            passportPassengerName,
          },
        });
      }
      if (
        passportNumber &&
        isTruthy(passportPassengerName) &&
        isTruthy(passenger.contactNo)
      ) {
        searchTiers.push({
          tier: 4,
          where: {
            passportNumber,
            passportPassengerName,
            contactNo: normalize(passenger.contactNo),
          },
        });
      }
      if (isTruthy(passportPassengerName) && isTruthy(passenger.contactNo)) {
        searchTiers.push({
          tier: 5,
          where: {
            passportPassengerName,
            contactNo: normalize(passenger.contactNo),
          },
        });
      }
      if (isTruthy(passportPassengerName) && isTruthy(passenger.address1)) {
        searchTiers.push({
          tier: 6,
          where: {
            passportPassengerName,
            address1: normalize(String(passenger.address1)).slice(0, 15),
          },
        });
      }
    }

    for (const tier of searchTiers) {
      const candidate = await this.passengerRepository.findOne({
        where: tier.where as Record<string, unknown>,
        order: { updatedAt: "DESC", createdAt: "DESC" },
      });

      if (candidate) {
        return { passenger: candidate, matchTier: tier.tier };
      }
    }

    return null;
  }

  private async calculateHistoricalCumulativeAmount(
    candidatePassengerIds: string[],
    windowStart: Date,
    windowEnd: Date,
    config: PurchaseRuleConfig,
    options: CalculateRowsOptions = {},
    excludeTransactionId?: string | null,
  ): Promise<number> {
    if (!candidatePassengerIds.length) {
      return 0;
    }

    const requireCashPayment = options.requireCashPayment === true;

    const queryBuilder = this.transactionRepository
      .createQueryBuilder("transaction")
      .leftJoinAndSelect("transaction.items", "item")
      .leftJoinAndSelect("transaction.additionalCharges", "charge")
      .where("transaction.isLatest = true")
      .andWhere("transaction.status = :status", {
        status: TransactionStatus.APPROVED,
      })
      .andWhere("transaction.transactionType = :transactionType", {
        transactionType: TransactionType.PURCHASE,
      })
      .andWhere("transaction.passengerId = ANY(:passengerIds)", {
        passengerIds: candidatePassengerIds,
      })
      .andWhere("transaction.transactionDate >= :windowStart", { windowStart })
      .andWhere("transaction.transactionDate < :windowEnd", { windowEnd });

    if (requireCashPayment) {
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1
          FROM transaction_payments cash_payment
          WHERE cash_payment.transaction_id = transaction.id
            AND cash_payment.payment_method = :cashPaymentMethod
        )`,
        { cashPaymentMethod: TransactionPaymentMethod.CASH },
      );
    }

    const normalizedExcludeId = normalize(excludeTransactionId);
    if (normalizedExcludeId) {
      queryBuilder.andWhere("transaction.id != :excludeTransactionId", {
        excludeTransactionId: normalizedExcludeId,
      });
    }

    const transactions = await queryBuilder.getMany();

    if (!transactions.length) {
      return 0;
    }

    const { referenceAmount } =
      await this.calculateRowsAmountInReferenceCurrency(
        transactions.flatMap((transaction) =>
          (transaction.items ?? []).map((item) => {
            const snapshotCode = normalizeUpper(
              item.productSnapshot?.code ?? null,
            );
            const snapshotLabel = normalize(item.productSnapshot?.label);
            // Prefer real product code; avoid treating labels like "CN - ..." as code.
            const productCode =
              snapshotCode ||
              (normalizeUpper(snapshotLabel).startsWith(CN_PRODUCT_CODE)
                ? CN_PRODUCT_CODE
                : null);

            return {
              quantity: item.quantity,
              rate: item.rate,
              per: item.per,
              currencyId: item.currencyId,
              productId: item.productId,
              productCode,
            };
          }),
        ),
        options.includeCharges === false
          ? []
          : transactions.flatMap((transaction) =>
              (transaction.additionalCharges ?? []).map((charge) => ({
                amount: charge.amount,
              })),
            ),
        config,
        options,
      );

    return referenceAmount;
  }

  private async calculateHistoricalCashAmountInReferenceCurrency(
    candidatePassengerIds: string[],
    windowStart: Date,
    windowEnd: Date,
    referenceRatePer: number,
    referenceBaseRate: number,
    excludeTransactionId?: string | null,
  ): Promise<number> {
    if (!candidatePassengerIds.length) {
      return 0;
    }

    const queryBuilder = this.transactionRepository
      .createQueryBuilder("transaction")
      .leftJoinAndSelect("transaction.payments", "payment")
      .where("transaction.isLatest = true")
      .andWhere("transaction.status = :status", {
        status: TransactionStatus.APPROVED,
      })
      .andWhere("transaction.transactionType = :transactionType", {
        transactionType: TransactionType.PURCHASE,
      })
      .andWhere("transaction.passengerId = ANY(:passengerIds)", {
        passengerIds: candidatePassengerIds,
      })
      .andWhere("transaction.transactionDate >= :windowStart", { windowStart })
      .andWhere("transaction.transactionDate < :windowEnd", { windowEnd });

    const normalizedExcludeId = normalize(excludeTransactionId);
    if (normalizedExcludeId) {
      queryBuilder.andWhere("transaction.id != :excludeTransactionId", {
        excludeTransactionId: normalizedExcludeId,
      });
    }

    const transactions = await queryBuilder.getMany();

    if (!transactions.length) {
      return 0;
    }

    const cashInrTotal = transactions.reduce((sum, transaction) => {
      const cashPayments = (transaction.payments ?? []).filter(
        (payment) =>
          normalizeUpper(payment.paymentMethod) ===
          TransactionPaymentMethod.CASH,
      );
      return (
        sum +
        cashPayments.reduce(
          (paymentSum, payment) => paymentSum + toNumber(payment.amount),
          0,
        )
      );
    }, 0);

    return this.convertAmountToReferenceCurrency(
      cashInrTotal,
      referenceRatePer,
      referenceBaseRate,
    );
  }

  async preview(
    body: PurchaseRuleTransactionInput,
  ): Promise<PurchaseRulePreviewResponse> {
    const transactionType = this.resolveTransactionType(body);

    if (transactionType === TransactionType.SALE) {
      return {
        allowed: true,
        ruleType: "OK",
        blockingReason: null,
        blockingReasons: [],
        requiresCdf: false,
        cdfThresholdAmount: "0.00",
        referenceCurrencyCode: "USD",
        transactionAmount: "0.00",
        transactionAmountInReferenceCurrency: "0.00",
        cumulativeAmountInReferenceCurrency: "0.00",
        cumulativeCashAmountInReferenceCurrency: "0.00",
        cashLimitAmount: "0.00",
        cashTotalAmount: "0.00",
        chequeTotalAmount: "0.00",
        passengerMatchTier: null,
        passengerId: null,
        isCorporate: false,
        nationalityType: null,
        paymentMethodsAllowed: [],
      };
    }

    const config = await this.getConfig();
    const resolvedReferenceCurrency = await this.resolveCurrencyByCodeOrId(
      config.referenceCurrencyCode,
    );
    const referenceCurrencyCode =
      resolvedReferenceCurrency?.currencyCode ||
      normalizeUpper(config.referenceCurrencyCode) ||
      "USD";
    const passenger = this.getTransactionPassengerInput(body);
    const payments = this.getPayments(body);
    const referenceRatePer = await this.resolveReferenceRatePer(
      config.referenceCurrencyCode,
    );
    const referenceBaseRate = await this.resolveReferenceBaseRate(
      config.referenceCurrencyCode,
    );
    const entityType = normalizeUpper(passenger?.entityType);
    const nationalityType = normalizeUpper(passenger?.nationalityType);
    const isCorporate = entityType === PassengerEntityType.CORPORATE;
    const isIndian = nationalityType === PassengerNationalityType.INDIAN;
    const isNriOrForeigner =
      nationalityType === PassengerNationalityType.NRI ||
      nationalityType === PassengerNationalityType.FOREIGNER;

    // Passenger cash/CDF rules apply only when passenger details are present.
    // Corporate / individual pages must send them; FFMC and other party pages skip.
    if (!passenger) {
      const slug = normalizeUpper(body.transaction?.slug ?? body.slug);
      const requiresPassenger =
        slug === "PURCHASE_CORPORATE_INDIVIDUAL" ||
        slug === "SALE_CORPORATE_INDIVIDUAL";

      if (requiresPassenger) {
        return {
          allowed: false,
          ruleType: "MISSING_PASSENGER",
          blockingReason:
            "Passenger information is required before purchase validation",
          blockingReasons: [
            "Passenger information is required before purchase validation",
          ],
          requiresCdf: false,
          cdfThresholdAmount: config.cdfThresholdAmount.toFixed(2),
          referenceCurrencyCode,
          transactionAmount: "0.00",
          transactionAmountInReferenceCurrency: "0.00",
          cumulativeAmountInReferenceCurrency: "0.00",
          cumulativeCashAmountInReferenceCurrency: "0.00",
          cashLimitAmount: "0.00",
          cashTotalAmount: "0.00",
          chequeTotalAmount: "0.00",
          passengerMatchTier: null,
          passengerId: null,
          isCorporate: false,
          nationalityType: null,
          paymentMethodsAllowed: [],
        };
      }

      return {
        allowed: true,
        ruleType: "OK",
        blockingReason: null,
        blockingReasons: [],
        requiresCdf: false,
        cdfThresholdAmount: config.cdfThresholdAmount.toFixed(2),
        referenceCurrencyCode,
        transactionAmount: "0.00",
        transactionAmountInReferenceCurrency: "0.00",
        cumulativeAmountInReferenceCurrency: "0.00",
        cumulativeCashAmountInReferenceCurrency: "0.00",
        cashLimitAmount: "0.00",
        cashTotalAmount: "0.00",
        chequeTotalAmount: "0.00",
        passengerMatchTier: null,
        passengerId: null,
        isCorporate: false,
        nationalityType: null,
        paymentMethodsAllowed: [],
      };
    }

    const { transactionAmount, referenceAmount } =
      await this.calculateTransactionAmountInReferenceCurrency(body, {
        ...config,
        referenceCurrencyCode,
      });
    const { referenceAmount: cnCurrentReferenceAmount } =
      await this.calculateTransactionAmountInReferenceCurrency(
        body,
        {
          ...config,
          referenceCurrencyCode,
        },
        {
          productCodes: [CN_PRODUCT_CODE],
          includeCharges: false,
        },
      );
    const candidate = await this.findPassengerCandidate(body);
    const candidatePassengerIds = candidate ? [candidate.passenger.id] : [];
    const excludeTransactionId = this.resolveExcludeTransactionId(body);
    const { windowStart, windowEnd } = this.resolveHistoryWindow(
      body,
      config.windowDays,
    );
    const cumulativeAmountInReferenceCurrency =
      await this.calculateHistoricalCumulativeAmount(
        candidatePassengerIds,
        windowStart,
        windowEnd,
        {
          ...config,
          referenceCurrencyCode,
        },
      );
    const cnHistoricalReferenceAmount =
      await this.calculateHistoricalCumulativeAmount(
        candidatePassengerIds,
        windowStart,
        windowEnd,
        {
          ...config,
          referenceCurrencyCode,
        },
        {
          productCodes: [CN_PRODUCT_CODE],
          includeCharges: false,
          // Past CN counts toward cash total only when that purchase was cash-settled.
          requireCashPayment: true,
        },
        excludeTransactionId,
      );
    const cumulativeCashAmountInReferenceCurrency =
      await this.calculateHistoricalCashAmountInReferenceCurrency(
        candidatePassengerIds,
        windowStart,
        windowEnd,
        referenceRatePer,
        referenceBaseRate,
        excludeTransactionId,
      );
    const currentCashAmount = this.convertAmountToReferenceCurrency(
      payments
        .filter(
          (payment: PurchaseRulePaymentInput) =>
            normalizeUpper(payment.paymentMethod) ===
            TransactionPaymentMethod.CASH,
        )
        .reduce(
          (sum: number, payment: PurchaseRulePaymentInput) =>
            sum + toNumber(payment.amount),
          0,
        ),
      referenceRatePer,
      referenceBaseRate,
    );
    // Cash total = past CN (cash-settled purchases) + current cash payment.
    // Do not also add historical cash payment amounts (that double-counts past CN).
    const cashTotalAmount = cnHistoricalReferenceAmount + currentCashAmount;
    const chequeTotalAmount = this.convertAmountToReferenceCurrency(
      payments
        .filter((payment: PurchaseRulePaymentInput) =>
          isChequeFamilyPaymentMethod(payment.paymentMethod),
        )
        .reduce(
          (sum: number, payment: PurchaseRulePaymentInput) =>
            sum + toNumber(payment.amount),
          0,
        ),
      referenceRatePer,
      referenceBaseRate,
    );

    const paymentMethodsAllowed: Array<"CASH" | "CHEQUE"> = [];
    if (isCorporate) {
      paymentMethodsAllowed.push("CHEQUE");
    } else if (isIndian) {
      paymentMethodsAllowed.push("CASH", "CHEQUE");
    } else if (isNriOrForeigner) {
      paymentMethodsAllowed.push("CASH");
    }

    let allowed = true;
    let ruleType: PurchaseRulePreviewResponse["ruleType"] = "OK";
    const blockingReasons: string[] = [];
    let requiresCdf = false;

    const addBlockingReason = (
      nextRuleType: PurchaseRulePreviewResponse["ruleType"],
      reason: string,
    ) => {
      allowed = false;
      ruleType = nextRuleType;
      if (!blockingReasons.includes(reason)) {
        blockingReasons.push(reason);
      }
    };

    if (isCorporate) {
      if (currentCashAmount > 0) {
        addBlockingReason(
          "CORPORATE_CHEQUE_ONLY",
          "Corporate purchases can only be settled by cheque",
        );
      }
    } else if (isIndian) {
      if (
        referenceAmount + cumulativeAmountInReferenceCurrency >=
        config.cdfThresholdAmount
      ) {
        requiresCdf = true;
      }

      // Cash-limit (this branch) applies only when payment method is CASH.
      // Compare: current CN converted + (past CN converted + cash payments).
      if (currentCashAmount > 0) {
        const indianLimitComparableAmount =
          cnCurrentReferenceAmount + cashTotalAmount;
        if (!(indianLimitComparableAmount < config.indianCashLimitAmount)) {
          addBlockingReason(
            "CASH_LIMIT_EXCEEDED",
            `Current CN converted amount plus cash total (past cash-settled CN + current cash) must be less than the Indian limit of ${config.indianCashLimitAmount.toFixed(2)} ${referenceCurrencyCode}`,
          );
        }
      }
    } else if (isNriOrForeigner) {
      if (chequeTotalAmount > 0) {
        addBlockingReason(
          "CHEQUE_NOT_ALLOWED",
          "NRI / FOREIGNER purchases cannot be paid by cheque",
        );
      }

      // Cash-limit (this branch) applies only when payment method is CASH.
      if (currentCashAmount > 0) {
        const nriLimitComparableAmount =
          cnCurrentReferenceAmount + cashTotalAmount;
        if (!(nriLimitComparableAmount < config.nriCashLimitAmount)) {
          addBlockingReason(
            "CASH_LIMIT_EXCEEDED",
            `Current CN converted amount plus cash total (past cash-settled CN + current cash) must be less than the NRI / FOREIGNER limit of ${config.nriCashLimitAmount.toFixed(2)} ${referenceCurrencyCode}`,
          );
        }
      }
    }

    // First-time PAN/passport (no DB match) is allowed; passenger is created on
    // save and historical cumulative amount stays 0 via empty candidate ids.

    const blockingReason =
      blockingReasons.length > 0 ? blockingReasons.join(" ") : null;

    return {
      allowed,
      ruleType,
      blockingReason,
      blockingReasons,
      requiresCdf,
      cdfThresholdAmount: config.cdfThresholdAmount.toFixed(2),
      referenceCurrencyCode,
      transactionAmount: transactionAmount.toFixed(2),
      transactionAmountInReferenceCurrency:
        cnCurrentReferenceAmount.toFixed(2),
      cumulativeAmountInReferenceCurrency:
        cumulativeAmountInReferenceCurrency.toFixed(2),
      cumulativeCashAmountInReferenceCurrency:
        cumulativeCashAmountInReferenceCurrency.toFixed(2),
      cashLimitAmount: isCorporate
        ? "0.00"
        : isIndian
          ? config.indianCashLimitAmount.toFixed(2)
          : config.nriCashLimitAmount.toFixed(2),
      cashTotalAmount: cashTotalAmount.toFixed(2),
      chequeTotalAmount: chequeTotalAmount.toFixed(2),
      passengerMatchTier: candidate?.matchTier ?? null,
      passengerId: candidate?.passenger.id ?? null,
      isCorporate,
      nationalityType: nationalityType || null,
      paymentMethodsAllowed,
    };
  }

  async validate(body: PurchaseRuleTransactionInput): Promise<void> {
    if (this.resolveTransactionType(body) === TransactionType.SALE) {
      return;
    }

    const result = await this.preview(body);

    if (!result.allowed) {
      throw new BadRequestException(
        result.blockingReason || "Purchase rule validation failed",
      );
    }
  }
}
