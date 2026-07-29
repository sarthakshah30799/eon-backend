import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  passenger?: PurchaseRulePassengerInput | null;
  items?: PurchaseRuleRowInput[] | null;
  additionalCharges?: PurchaseRuleRowInput[] | null;
  payments?: PurchaseRulePaymentInput[] | null;
};

type PurchaseRuleTransactionInput = {
  transactionType?: string | null;
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
const isTruthy = (value?: string | null) => Boolean(normalize(value));
const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
@Injectable()
export class PurchaseRuleService {
  private readonly logger = new Logger(PurchaseRuleService.name);

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

  private async calculateTransactionAmountInReferenceCurrency(
    body: PurchaseRuleTransactionInput,
    config: PurchaseRuleConfig,
  ): Promise<{ transactionAmount: number; referenceAmount: number }> {
    const items = this.getItems(body);
    const charges = this.getAdditionalCharges(body);
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
      if (isTruthy(passenger.panNumber)) {
        searchTiers.push({ tier: 1, where: { panNumber: normalize(passenger.panNumber) } });
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
      if (isTruthy(passenger.panNumber)) {
        searchTiers.push({ tier: 1, where: { panNumber: normalize(passenger.panNumber) } });
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
      if (isTruthy(passenger.passportNumber)) {
        searchTiers.push({ tier: 1, where: { passportNumber: normalize(passenger.passportNumber) } });
      }
      if (isTruthy(passenger.passportNumber) && isTruthy(passenger.contactNo)) {
        searchTiers.push({
          tier: 2,
          where: {
            passportNumber: normalize(passenger.passportNumber),
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

    const referenceRatePer = await this.resolveReferenceRatePer(config.referenceCurrencyCode);
    const rawRows = await this.transactionRepository.query(
      `
        WITH tx_item_totals AS (
          SELECT
            ti.transaction_id AS transaction_id,
            COALESCE(SUM(COALESCE(ti.quantity, 0) * COALESCE(ti.rate, 0) / NULLIF(COALESCE(ti.per, 1), 0)), 0) AS item_amount,
            COALESCE(MIN(COALESCE(c.rate_per, 1)), 1) AS currency_rate_per
          FROM transaction_items ti
          LEFT JOIN currencies c ON c.id = ti.currency_id
          GROUP BY ti.transaction_id
        ),
        tx_charge_totals AS (
          SELECT
            tac.transaction_id AS transaction_id,
            COALESCE(SUM(COALESCE(tac.amount, 0)), 0) AS charge_amount
          FROM transaction_additional_charges tac
          GROUP BY tac.transaction_id
        )
        SELECT
          COALESCE(
            SUM(
              (
                (COALESCE(it.item_amount, 0) + COALESCE(ct.charge_amount, 0)) * $1
              ) / NULLIF(COALESCE(it.currency_rate_per, 1), 0)
            ),
            0
          ) AS amount
        FROM transactions tx
        LEFT JOIN tx_item_totals it ON it.transaction_id = tx.id
        LEFT JOIN tx_charge_totals ct ON ct.transaction_id = tx.id
        WHERE tx.is_latest = true
          AND tx.status = $2
          AND tx.passenger_id = ANY($3::uuid[])
          AND tx.created_at BETWEEN $4 AND $5
      `,
      [referenceRatePer, TransactionStatus.APPROVED, candidatePassengerIds, windowStart, windowEnd],
    );

    const amount = toNumber(rawRows?.[0]?.amount ?? 0);
    return amount;
  }

  async preview(body: PurchaseRuleTransactionInput): Promise<PurchaseRulePreviewResponse> {
    const transactionType = this.resolveTransactionType(body);
    this.logger.debug(
      `preview-start ${JSON.stringify({
        transactionType,
        hasTransactionBlock: Boolean(body.transaction),
        transactionBlockType: body.transaction?.transactionType ?? null,
        transactionTypeBody: body.transactionType ?? null,
      })}`,
    );

    if (transactionType === TransactionType.SALE) {
      return {
        allowed: true,
        ruleType: 'OK',
        blockingReason: null,
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

    if (!passenger) {
      return {
        allowed: false,
        ruleType: 'MISSING_PASSENGER',
        blockingReason: 'Passenger information is required before purchase validation',
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
        isCorporate,
        nationalityType: nationalityType || null,
        paymentMethodsAllowed: [],
      };
    }

    const { transactionAmount, referenceAmount } = await this.calculateTransactionAmountInReferenceCurrency(body, {
      ...config,
      referenceCurrencyCode,
    });
    this.logger.debug(
      `preview-amounts ${JSON.stringify({
        referenceCurrencyCode,
        referenceRatePer,
        transactionAmount,
        referenceAmount,
        itemCount: this.getItems(body).length,
        chargeCount: this.getAdditionalCharges(body).length,
        paymentCount: payments.length,
      })}`,
    );
    const candidate = await this.findPassengerCandidate(body);
    const candidatePassengerIds = candidate ? [candidate.passenger.id] : [];
    const now = new Date();
    const arrivalDateRaw = normalize(passenger.arrivalDate);
    const arrivalDate = arrivalDateRaw ? new Date(arrivalDateRaw) : now;
    const windowStart = arrivalDate;
    const windowEnd = now;
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
    this.logger.debug(
      `preview-payments ${JSON.stringify({
        cashTotalAmount,
        chequeTotalAmount,
        rawCashTotalAmount: payments
          .filter((payment: PurchaseRulePaymentInput) => normalizeUpper(payment.paymentMethod) === TransactionPaymentMethod.CASH)
          .reduce((sum: number, payment: PurchaseRulePaymentInput) => sum + toNumber(payment.amount), 0),
        rawChequeTotalAmount: payments
          .filter((payment: PurchaseRulePaymentInput) => normalizeUpper(payment.paymentMethod) === TransactionPaymentMethod.CHEQUE)
          .reduce((sum: number, payment: PurchaseRulePaymentInput) => sum + toNumber(payment.amount), 0),
      })}`,
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
    let blockingReason: string | null = null;
    let requiresCdf = false;

    if (isCorporate) {
      if (cashTotalAmount > 0) {
        allowed = false;
        ruleType = 'CORPORATE_CHEQUE_ONLY';
        blockingReason = 'Corporate purchases can only be settled by cheque';
      }
    } else if (isIndian) {
      if (referenceAmount >= config.cdfThresholdAmount || cumulativeAmountInReferenceCurrency >= config.cdfThresholdAmount) {
        requiresCdf = true;
      }

      if (referenceAmount > config.indianCashLimitAmount) {
        allowed = false;
        ruleType = 'CASH_LIMIT_EXCEEDED';
        blockingReason = `Cash payment exceeds the Indian limit of ${config.indianCashLimitAmount.toFixed(2)} ${referenceCurrencyCode}`;
      }
    } else if (isNriOrForeigner) {
      if (chequeTotalAmount > 0) {
        allowed = false;
        ruleType = 'CHEQUE_NOT_ALLOWED';
        blockingReason = 'NRI / FOREIGNER purchases cannot be paid by cheque';
      }

      if (referenceAmount > config.nriCashLimitAmount) {
        allowed = false;
        ruleType = 'CASH_LIMIT_EXCEEDED';
        blockingReason = `Cash payment exceeds the NRI / FOREIGNER limit of ${config.nriCashLimitAmount.toFixed(2)} ${referenceCurrencyCode}`;
      }
    }

    if (!candidate && (isIndian || isCorporate || isNriOrForeigner)) {
      if (entityType === PassengerEntityType.INDIVIDUAL && isIndian) {
        allowed = false;
        ruleType = 'MISSING_PASSENGER';
        blockingReason = 'No matching passenger record found for the entered PAN details';
      }
    }

    if (requiresCdf && !allowed) {
      blockingReason = blockingReason || 'CDF declaration is required before submission';
    }

    return {
      allowed,
      ruleType,
      blockingReason,
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
