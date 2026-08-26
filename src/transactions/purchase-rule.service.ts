import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdditionalSettingService } from '../additional-settings/additional-setting.service';
import { Currency } from '../currencies/currency.entity';
import { Passenger, PassengerEntityType, PassengerNationalityType } from '../passengers/passenger.entity';
import { Transaction } from './entities/transaction.entity';
import {
  TransactionPaymentMethod,
  TransactionStatus,
  TransactionType,
} from './transactions.enums';

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
  entityType?: string;
  nationalityType?: string;
  contactNo?: string;
  address1?: string;
  panNumber?: string;
  panHolderName?: string;
  panDob?: string;
  passportNumber?: string;
  arrivalDate?: string;
};

type PurchaseRuleTransactionBlock = {
  transactionType?: string | null;
  transactionDate?: string | null;
  slug?: string | null;
  passenger?: PurchaseRulePassengerInput | null;
  items?: PurchaseRuleRowInput[] | null;
  additionalCharges?: PurchaseRuleRowInput[] | null;
  payments?: PurchaseRulePaymentInput[] | null;
};

type PurchaseRuleTransactionInput = {
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
  amount?: string | number;
};

type PurchaseRulePaymentInput = {
  paymentMethod?: string;
  amount?: string | number;
};

export type PurchaseRulePreviewResponse = {
  allowed: boolean;
  ruleType: 'OK' | 'CORPORATE_CHEQUE_ONLY' | 'CDF_REQUIRED' | 'CASH_LIMIT_EXCEEDED' | 'CHEQUE_NOT_ALLOWED' | 'HISTORY_LIMIT_EXCEEDED' | 'MISSING_PASSENGER' | 'MISSING_PAYMENT';
  blockingReason: string | null;
  blockingReasons: string[];
  requiresCdf: boolean;
  cdfThresholdAmount: string;
  referenceCurrencyCode: string;
  transactionAmount: string;
  transactionAmountInReferenceCurrency: string;
  cumulativeAmountInReferenceCurrency: string;
  cashLimitAmount: string;
  cashTotalAmount: string;
  chequeTotalAmount: string;
  passengerMatchTier: number | null;
  passengerId: string | null;
  isCorporate: boolean;
  nationalityType: string | null;
  paymentMethodsAllowed: Array<'CASH' | 'CHEQUE'>;
};

const normalize = (value?: string | null) => String(value ?? '').trim();
const normalizeUpper = (value?: string | null) => normalize(value).toUpperCase();
const normalizeIdentity = (value?: string | null) => {
  const normalized = normalize(value).replace(/\s+/g, '').toUpperCase();
  return normalized || null;
};
const isTruthy = (value?: string | null) => Boolean(normalize(value));
const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
@Injectable()
export class PurchaseRuleService {
  constructor(
    private readonly additionalSettingService: AdditionalSettingService,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Passenger)
    private readonly passengerRepository: Repository<Passenger>,
    @InjectRepository(Transaction, 'database2')
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
        'PURCHASE_PASSENGER_RULE',
        'PURCHASE_PASSENGER_RULE_REFERENCE_CURRENCY_CODE',
      ),
      this.additionalSettingService.getSettingTextValue(
        'PURCHASE_PASSENGER_RULE',
        'PURCHASE_PASSENGER_RULE_CDF_THRESHOLD_AMOUNT',
      ),
      this.additionalSettingService.getSettingTextValue(
        'PURCHASE_PASSENGER_RULE',
        'PURCHASE_PASSENGER_RULE_INDIAN_CASH_LIMIT_AMOUNT',
      ),
      this.additionalSettingService.getSettingTextValue(
        'PURCHASE_PASSENGER_RULE',
        'PURCHASE_PASSENGER_RULE_NRI_CASH_LIMIT_AMOUNT',
      ),
      this.additionalSettingService.getSettingTextValue(
        'PURCHASE_PASSENGER_RULE',
        'PURCHASE_PASSENGER_RULE_WINDOW_DAYS',
      ),
    ]);

    return {
      referenceCurrencyCode: normalize(referenceCurrencyCode) || 'USD',
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

  private getAdditionalCharges(body: PurchaseRuleTransactionInput): PurchaseRuleRowInput[] {
    if (Array.isArray(body.transaction?.additionalCharges)) {
      return body.transaction.additionalCharges;
    }

    return Array.isArray(body.additionalCharges) ? body.additionalCharges : [];
  }

  private getPayments(body: PurchaseRuleTransactionInput): PurchaseRulePaymentInput[] {
    if (Array.isArray(body.transaction?.payments)) {
      return body.transaction.payments;
    }

    return Array.isArray(body.payments) ? body.payments : [];
  }

  private resolveTransactionType(body: PurchaseRuleTransactionInput): string {
    return normalizeUpper(body.transaction?.transactionType ?? body.transactionType);
  }

  private resolveHistoryWindow(
    body: PurchaseRuleTransactionInput,
    windowDays: number,
  ): { windowStart: Date; windowEnd: Date } {
    const rawDate = normalize(body.transaction?.transactionDate ?? body.transactionDate);
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    const windowEnd = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    const startOfEndDay = new Date(Date.UTC(
      windowEnd.getUTCFullYear(),
      windowEnd.getUTCMonth(),
      windowEnd.getUTCDate(),
    ));
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
    return quantity * rate / per;
  }

  private async resolveCurrencyRatePer(currencyId?: string | null): Promise<number> {
    if (!currencyId) {
      return 1;
    }

    const currency = await this.currencyRepository.findOne({
      where: { id: currencyId },
      select: { id: true, ratePer: true },
    });

    return Math.max(1, toNumber(currency?.ratePer || 1) || 1);
  }

  private async resolveCurrencyByCodeOrId(
    currencyValue?: string | null,
  ): Promise<Pick<Currency, 'id' | 'currencyCode' | 'ratePer'> | null> {
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

  private async resolveReferenceRatePer(referenceCurrencyValue: string): Promise<number> {
    const currency = await this.resolveCurrencyByCodeOrId(referenceCurrencyValue);

    return Math.max(1, toNumber(currency?.ratePer || 1) || 1);
  }

  private async calculateRowsAmountInReferenceCurrency(
    items: PurchaseRuleRowInput[],
    charges: PurchaseRuleRowInput[],
    config: PurchaseRuleConfig,
  ): Promise<{ transactionAmount: number; referenceAmount: number }> {
    const referenceCurrency = await this.resolveCurrencyByCodeOrId(config.referenceCurrencyCode);
    const referenceCurrencyCode = normalizeUpper(
      referenceCurrency?.currencyCode ?? config.referenceCurrencyCode,
    );
    const referenceRatePer = Math.max(1, toNumber(referenceCurrency?.ratePer || 1) || 1);
    const currencyCache = new Map<string, Pick<Currency, 'id' | 'currencyCode' | 'ratePer'>>();

    const resolveRowCurrency = async (currencyId?: string | null) => {
      const normalizedCurrencyId = normalize(currencyId);
      if (!normalizedCurrencyId) {
        return null;
      }

      const cachedCurrency = currencyCache.get(normalizedCurrencyId);
      if (cachedCurrency) {
        return cachedCurrency;
      }

      const resolvedCurrency = await this.resolveCurrencyByCodeOrId(normalizedCurrencyId);
      if (resolvedCurrency) {
        currencyCache.set(normalizedCurrencyId, resolvedCurrency);
      }

      return resolvedCurrency;
    };

    let transactionAmount = 0;
    let referenceAmount = 0;

    for (const item of items) {
      const quantity = toNumber(item.quantity);
      const rate = toNumber(item.rate);
      const per = Math.max(1, toNumber(item.per) || 1);
      const baseAmount = quantity * rate / per;
      transactionAmount += baseAmount;

      const rowCurrency = await resolveRowCurrency(item.currencyId);
      const rowCurrencyCode = normalizeUpper(rowCurrency?.currencyCode);

      if (rowCurrencyCode && rowCurrencyCode === referenceCurrencyCode) {
        referenceAmount += quantity;
      } else {
        referenceAmount += baseAmount / referenceRatePer;
      }
    }

    for (const charge of charges) {
      const amount = toNumber(charge.amount);
      transactionAmount += amount;
      referenceAmount += amount / referenceRatePer;
    }

    return { transactionAmount, referenceAmount };
  }

  private async calculateTransactionAmountInReferenceCurrency(
    body: PurchaseRuleTransactionInput,
    config: PurchaseRuleConfig,
  ): Promise<{ transactionAmount: number; referenceAmount: number }> {
    return this.calculateRowsAmountInReferenceCurrency(
      this.getItems(body),
      this.getAdditionalCharges(body),
      config,
    );
  }

  private convertAmountToReferenceCurrency(amount: number, referenceRatePer: number): number {
    return amount / Math.max(1, referenceRatePer || 1);
  }

  private async findPassengerCandidate(body: PurchaseRuleTransactionInput): Promise<PurchaseRuleCandidate | null> {
    const passenger = this.getTransactionPassengerInput(body);
    if (!passenger) {
      return null;
    }

    const entityType = normalizeUpper(passenger.entityType);
    const nationalityType = normalizeUpper(passenger.nationalityType);
    const searchTiers: Array<{ tier: number; where: Record<string, unknown> }> = [];

    if (entityType === PassengerEntityType.CORPORATE) {
      const panNumber = normalizeIdentity(passenger.panNumber);
      if (panNumber) {
        searchTiers.push({ tier: 1, where: { panNumber } });
      }
      if (isTruthy(passenger.panHolderName) && isTruthy(passenger.panDob) && isTruthy(passenger.contactNo)) {
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
      if (isTruthy(passenger.panHolderName) && isTruthy(passenger.panDob) && isTruthy(passenger.contactNo)) {
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
    }

    for (const tier of searchTiers) {
      const candidate = await this.passengerRepository.findOne({
        where: tier.where as Record<string, unknown>,
        order: { updatedAt: 'DESC', createdAt: 'DESC' },
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
  ): Promise<number> {
    if (!candidatePassengerIds.length) {
      return 0;
    }

    const transactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.items', 'item')
      .leftJoinAndSelect('transaction.additionalCharges', 'charge')
      .where('transaction.isLatest = true')
      .andWhere('transaction.status = :status', { status: TransactionStatus.APPROVED })
      .andWhere('transaction.transactionType = :transactionType', {
        transactionType: TransactionType.PURCHASE,
      })
      .andWhere('transaction.passengerId = ANY(:passengerIds)', {
        passengerIds: candidatePassengerIds,
      })
      .andWhere('transaction.transactionDate >= :windowStart', { windowStart })
      .andWhere('transaction.transactionDate < :windowEnd', { windowEnd })
      .getMany();

    if (!transactions.length) {
      return 0;
    }

    const { referenceAmount } = await this.calculateRowsAmountInReferenceCurrency(
      transactions.flatMap((transaction) =>
        (transaction.items ?? []).map((item) => ({
          quantity: item.quantity,
          rate: item.rate,
          per: item.per,
          currencyId: item.currencyId,
        })),
      ),
      transactions.flatMap((transaction) =>
        (transaction.additionalCharges ?? []).map((charge) => ({
          amount: charge.amount,
        })),
      ),
      config,
    );

    return referenceAmount;
  }

  async preview(body: PurchaseRuleTransactionInput): Promise<PurchaseRulePreviewResponse> {
    const transactionType = this.resolveTransactionType(body);

    if (transactionType === TransactionType.SALE) {
      return {
        allowed: true,
        ruleType: 'OK',
        blockingReason: null,
        blockingReasons: [],
        requiresCdf: false,
        cdfThresholdAmount: '0.00',
        referenceCurrencyCode: 'USD',
        transactionAmount: '0.00',
        transactionAmountInReferenceCurrency: '0.00',
        cumulativeAmountInReferenceCurrency: '0.00',
        cashLimitAmount: '0.00',
        cashTotalAmount: '0.00',
        chequeTotalAmount: '0.00',
        passengerMatchTier: null,
        passengerId: null,
        isCorporate: false,
        nationalityType: null,
        paymentMethodsAllowed: [],
      };
    }

    const config = await this.getConfig();
    const resolvedReferenceCurrency = await this.resolveCurrencyByCodeOrId(config.referenceCurrencyCode);
    const referenceCurrencyCode =
      resolvedReferenceCurrency?.currencyCode || normalizeUpper(config.referenceCurrencyCode) || 'USD';
    const passenger = this.getTransactionPassengerInput(body);
    const payments = this.getPayments(body);
    const referenceRatePer = await this.resolveReferenceRatePer(config.referenceCurrencyCode);
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
      const slug = normalizeUpper(
        body.transaction?.slug ?? body.slug,
      );
      const requiresPassenger =
        slug === 'PURCHASE_CORPORATE_INDIVIDUAL' ||
        slug === 'SALE_CORPORATE_INDIVIDUAL';

      if (requiresPassenger) {
        return {
          allowed: false,
          ruleType: 'MISSING_PASSENGER',
          blockingReason: 'Passenger information is required before purchase validation',
          blockingReasons: ['Passenger information is required before purchase validation'],
          requiresCdf: false,
          cdfThresholdAmount: config.cdfThresholdAmount.toFixed(2),
          referenceCurrencyCode,
          transactionAmount: '0.00',
          transactionAmountInReferenceCurrency: '0.00',
          cumulativeAmountInReferenceCurrency: '0.00',
          cashLimitAmount: '0.00',
          cashTotalAmount: '0.00',
          chequeTotalAmount: '0.00',
          passengerMatchTier: null,
          passengerId: null,
          isCorporate: false,
          nationalityType: null,
          paymentMethodsAllowed: [],
        };
      }

      return {
        allowed: true,
        ruleType: 'OK',
        blockingReason: null,
        blockingReasons: [],
        requiresCdf: false,
        cdfThresholdAmount: config.cdfThresholdAmount.toFixed(2),
        referenceCurrencyCode,
        transactionAmount: '0.00',
        transactionAmountInReferenceCurrency: '0.00',
        cumulativeAmountInReferenceCurrency: '0.00',
        cashLimitAmount: '0.00',
        cashTotalAmount: '0.00',
        chequeTotalAmount: '0.00',
        passengerMatchTier: null,
        passengerId: null,
        isCorporate: false,
        nationalityType: null,
        paymentMethodsAllowed: [],
      };
    }

    const { transactionAmount, referenceAmount } = await this.calculateTransactionAmountInReferenceCurrency(body, {
      ...config,
      referenceCurrencyCode,
    });
    const candidate = await this.findPassengerCandidate(body);
    const candidatePassengerIds = candidate ? [candidate.passenger.id] : [];
    const { windowStart, windowEnd } = this.resolveHistoryWindow(body, config.windowDays);
    const cumulativeAmountInReferenceCurrency = await this.calculateHistoricalCumulativeAmount(
      candidatePassengerIds,
      windowStart,
      windowEnd,
      {
        ...config,
        referenceCurrencyCode,
      },
    );
    const cashTotalAmount = this.convertAmountToReferenceCurrency(
      payments
        .filter((payment: PurchaseRulePaymentInput) => normalizeUpper(payment.paymentMethod) === TransactionPaymentMethod.CASH)
        .reduce((sum: number, payment: PurchaseRulePaymentInput) => sum + toNumber(payment.amount), 0),
      referenceRatePer,
    );
    const chequeTotalAmount = this.convertAmountToReferenceCurrency(
      payments
        .filter((payment: PurchaseRulePaymentInput) => normalizeUpper(payment.paymentMethod) === TransactionPaymentMethod.CHEQUE)
        .reduce((sum: number, payment: PurchaseRulePaymentInput) => sum + toNumber(payment.amount), 0),
      referenceRatePer,
    );

    const paymentMethodsAllowed: Array<'CASH' | 'CHEQUE'> = [];
    if (isCorporate) {
      paymentMethodsAllowed.push('CHEQUE');
    } else if (isIndian) {
      paymentMethodsAllowed.push('CASH', 'CHEQUE');
    } else if (isNriOrForeigner) {
      paymentMethodsAllowed.push('CASH');
    }

    let allowed = true;
    let ruleType: PurchaseRulePreviewResponse['ruleType'] = 'OK';
    const blockingReasons: string[] = [];
    let requiresCdf = false;

    const addBlockingReason = (
      nextRuleType: PurchaseRulePreviewResponse['ruleType'],
      reason: string,
    ) => {
      allowed = false;
      ruleType = nextRuleType;
      if (!blockingReasons.includes(reason)) {
        blockingReasons.push(reason);
      }
    };

    if (isCorporate) {
      if (cashTotalAmount > 0) {
        addBlockingReason(
          'CORPORATE_CHEQUE_ONLY',
          'Corporate purchases can only be settled by cheque',
        );
      }
    } else if (isIndian) {
      if (referenceAmount + cumulativeAmountInReferenceCurrency >= config.cdfThresholdAmount) {
        requiresCdf = true;
      }

      if (cashTotalAmount > config.indianCashLimitAmount) {
        addBlockingReason(
          'CASH_LIMIT_EXCEEDED',
          `Cash payment exceeds the Indian limit of ${config.indianCashLimitAmount.toFixed(2)} ${referenceCurrencyCode}`,
        );
      }
    } else if (isNriOrForeigner) {
      if (chequeTotalAmount > 0) {
        addBlockingReason(
          'CHEQUE_NOT_ALLOWED',
          'NRI / FOREIGNER purchases cannot be paid by cheque',
        );
      }

      if (cashTotalAmount > config.nriCashLimitAmount) {
        addBlockingReason(
          'CASH_LIMIT_EXCEEDED',
          `Cash payment exceeds the NRI / FOREIGNER limit of ${config.nriCashLimitAmount.toFixed(2)} ${referenceCurrencyCode}`,
        );
      }
    }

    // First-time PAN/passport (no DB match) is allowed; passenger is created on
    // save and historical cumulative amount stays 0 via empty candidate ids.

    const blockingReason = blockingReasons.length > 0 ? blockingReasons.join(' ') : null;

    return {
      allowed,
      ruleType,
      blockingReason,
      blockingReasons,
      requiresCdf,
      cdfThresholdAmount: config.cdfThresholdAmount.toFixed(2),
      referenceCurrencyCode,
      transactionAmount: transactionAmount.toFixed(2),
      transactionAmountInReferenceCurrency: referenceAmount.toFixed(2),
      cumulativeAmountInReferenceCurrency: cumulativeAmountInReferenceCurrency.toFixed(2),
      cashLimitAmount: isCorporate
        ? '0.00'
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
      throw new BadRequestException(result.blockingReason || 'Purchase rule validation failed');
    }
  }
}
