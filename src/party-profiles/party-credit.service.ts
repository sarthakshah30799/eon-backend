import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionType } from "../transactions/transactions.enums";
import { PartyProfile } from "./party-profile.entity";
import type {
  PartyCreditPreviewResponse,
  PartyCreditProfile,
  PartyCreditValidationInput,
} from "./party-credit.types";

const CREDIT_POLICY_CATEGORY = "TRANSACTION_CREDIT_POLICY";
const ALLOW_OUTSTANDING_ON_SALE = "ALLOW_OUTSTANDING_ON_SALE";
const ALLOW_OUTSTANDING_ON_PURCHASE = "ALLOW_OUTSTANDING_ON_PURCHASE";

const toMoney = (value: number) => value.toFixed(2);

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isConfiguredCreditNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
};

const parseDateOnly = (value: string | Date) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfUtcDay = (value: Date) =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );

@Injectable()
export class PartyCreditService {
  constructor(
    private readonly additionalSettingService: AdditionalSettingService,
    @InjectRepository(PartyProfile)
    private readonly partyProfileRepository: Repository<PartyProfile>,
    @InjectRepository(Transaction, "database2")
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  isPermanentCreditConfigured(party: PartyCreditProfile) {
    return (
      isConfiguredCreditNumber(party.permanentCreditLimit) &&
      isConfiguredCreditNumber(party.permanentCreditDays)
    );
  }

  isTemporaryCreditConfigured(party: PartyCreditProfile) {
    return (
      isConfiguredCreditNumber(party.temporaryCreditLimit) &&
      isConfiguredCreditNumber(party.temporaryCreditDays)
    );
  }

  isCreditConfigured(party: PartyCreditProfile) {
    return (
      this.isPermanentCreditConfigured(party) ||
      this.isTemporaryCreditConfigured(party)
    );
  }

  resolveApplicableCreditLimit(party: PartyCreditProfile) {
    let limit = 0;

    if (this.isPermanentCreditConfigured(party)) {
      limit += toNumber(party.permanentCreditLimit);
    }

    if (isConfiguredCreditNumber(party.temporaryCreditLimit)) {
      limit += toNumber(party.temporaryCreditLimit);
    }

    return limit;
  }

  resolveApplicableCreditDays(party: PartyCreditProfile) {
    let days = 0;
    let hasDays = false;

    if (this.isPermanentCreditConfigured(party)) {
      days += Math.trunc(toNumber(party.permanentCreditDays));
      hasDays = true;
    }

    if (isConfiguredCreditNumber(party.temporaryCreditLimit)) {
      if (isConfiguredCreditNumber(party.temporaryCreditDays)) {
        days += Math.trunc(toNumber(party.temporaryCreditDays));
        hasDays = true;
      }
    }

    return hasDays ? days : null;
  }

  sumPaymentAmounts(
    payments?: Array<{ amount?: string | number | null }> | null,
  ) {
    return Number(
      (payments ?? [])
        .reduce((sum, row) => sum + toNumber(row?.amount), 0)
        .toFixed(2),
    );
  }

  async getPartyOutstanding(
    partyProfileId: string,
    excludeTransactionId?: string | null,
  ) {
    const qb = this.transactionRepository
      .createQueryBuilder("transaction")
      .select(
        `COALESCE(SUM(
          GREATEST(
            COALESCE(transaction.finalAmount, 0)::numeric
            - COALESCE(transaction.byCash, 0)::numeric
            - COALESCE(transaction.byCheque, 0)::numeric,
            0
          )
        ), 0)`,
        "outstanding",
      )
      .where("transaction.partyProfileId = :partyProfileId", {
        partyProfileId,
      })
      .andWhere("transaction.deletedAt IS NULL")
      .andWhere("transaction.isLatest = true");

    if (excludeTransactionId) {
      qb.andWhere("transaction.id <> :excludeTransactionId", {
        excludeTransactionId,
      });
    }

    const row = await qb.getRawOne<{ outstanding?: string }>();
    return toNumber(row?.outstanding);
  }

  async getOldestOutstandingTransactionDate(
    partyProfileId: string,
    excludeTransactionId?: string | null,
  ) {
    const qb = this.transactionRepository
      .createQueryBuilder("transaction")
      .select("MIN(transaction.transactionDate)", "oldestDate")
      .where("transaction.partyProfileId = :partyProfileId", {
        partyProfileId,
      })
      .andWhere("transaction.deletedAt IS NULL")
      .andWhere("transaction.isLatest = true")
      .andWhere(
        `GREATEST(
          COALESCE(transaction.finalAmount, 0)::numeric
          - COALESCE(transaction.byCash, 0)::numeric
          - COALESCE(transaction.byCheque, 0)::numeric,
          0
        ) > 0`,
      );

    if (excludeTransactionId) {
      qb.andWhere("transaction.id <> :excludeTransactionId", {
        excludeTransactionId,
      });
    }

    const row = await qb.getRawOne<{ oldestDate?: string | Date | null }>();
    if (!row?.oldestDate) {
      return null;
    }

    return parseDateOnly(row.oldestDate);
  }

  private async isOutstandingAllowed(transactionType: TransactionType) {
    if (transactionType === TransactionType.SALE) {
      return this.additionalSettingService.getSettingBooleanValue(
        CREDIT_POLICY_CATEGORY,
        ALLOW_OUTSTANDING_ON_SALE,
        false,
      );
    }

    return this.additionalSettingService.getSettingBooleanValue(
      CREDIT_POLICY_CATEGORY,
      ALLOW_OUTSTANDING_ON_PURCHASE,
      false,
    );
  }

  async preview(
    input: PartyCreditValidationInput,
  ): Promise<PartyCreditPreviewResponse> {
    const payableAmount = Math.max(0, toNumber(input.payableAmount));
    const totalPaid = this.sumPaymentAmounts(input.payments);
    const currentOutstanding = Math.max(0, Number((payableAmount - totalPaid).toFixed(2)));

    if (currentOutstanding <= 0) {
      return {
        allowed: true,
        ruleType: "OK",
        blockingReason: null,
        blockingReasons: [],
        outstandingAllowed: await this.isOutstandingAllowed(
          input.transactionType,
        ),
        creditConfigured: false,
        applicableCreditLimit: "0.00",
        applicableCreditDays: null,
        existingOutstanding: "0.00",
        currentOutstanding: "0.00",
        totalExposure: "0.00",
        availableCredit: "0.00",
        payableAmount: toMoney(payableAmount),
        totalPaid: toMoney(totalPaid),
      };
    }

    const outstandingAllowed = await this.isOutstandingAllowed(
      input.transactionType,
    );

    if (!outstandingAllowed) {
      return {
        allowed: false,
        ruleType: "OUTSTANDING_NOT_ALLOWED",
        blockingReason:
          "Outstanding payment is not allowed for this transaction type. Full Rec/Pay is required.",
        blockingReasons: [
          "Outstanding payment is not allowed for this transaction type. Full Rec/Pay is required.",
        ],
        outstandingAllowed,
        creditConfigured: false,
        applicableCreditLimit: "0.00",
        applicableCreditDays: null,
        existingOutstanding: "0.00",
        currentOutstanding: toMoney(currentOutstanding),
        totalExposure: toMoney(currentOutstanding),
        availableCredit: "0.00",
        payableAmount: toMoney(payableAmount),
        totalPaid: toMoney(totalPaid),
      };
    }

    const party = await this.partyProfileRepository.findOne({
      where: { id: input.partyProfileId },
      select: {
        id: true,
        permanentCreditLimit: true,
        permanentCreditDays: true,
        temporaryCreditLimit: true,
        temporaryCreditDays: true,
      },
    });

    if (!party) {
      throw new BadRequestException("Party profile not found");
    }

    const creditConfigured = this.isCreditConfigured(party);

    if (!creditConfigured) {
      const existingOutstanding = await this.getPartyOutstanding(
        input.partyProfileId,
        input.excludeTransactionId,
      );

      return {
        allowed: true,
        ruleType: "CREDIT_NOT_CONFIGURED",
        blockingReason: null,
        blockingReasons: [],
        outstandingAllowed,
        creditConfigured: false,
        applicableCreditLimit: "0.00",
        applicableCreditDays: null,
        existingOutstanding: toMoney(existingOutstanding),
        currentOutstanding: toMoney(currentOutstanding),
        totalExposure: toMoney(existingOutstanding + currentOutstanding),
        availableCredit: "0.00",
        payableAmount: toMoney(payableAmount),
        totalPaid: toMoney(totalPaid),
      };
    }

    const applicableCreditLimit = this.resolveApplicableCreditLimit(party);
    const applicableCreditDays = this.resolveApplicableCreditDays(party);
    const existingOutstanding = await this.getPartyOutstanding(
      input.partyProfileId,
      input.excludeTransactionId,
    );
    const totalExposure = existingOutstanding + currentOutstanding;
    const availableCredit = Math.max(
      0,
      applicableCreditLimit - existingOutstanding,
    );

    if (totalExposure > applicableCreditLimit) {
      const blockingReason = `Credit limit exceeded. Applicable limit ${toMoney(
        applicableCreditLimit,
      )}, existing outstanding ${toMoney(
        existingOutstanding,
      )}, current outstanding ${toMoney(
        currentOutstanding,
      )}, available credit ${toMoney(availableCredit)}.`;
      return {
        allowed: false,
        ruleType: "CREDIT_LIMIT_EXCEEDED",
        blockingReason,
        blockingReasons: [blockingReason],
        outstandingAllowed,
        creditConfigured,
        applicableCreditLimit: toMoney(applicableCreditLimit),
        applicableCreditDays,
        existingOutstanding: toMoney(existingOutstanding),
        currentOutstanding: toMoney(currentOutstanding),
        totalExposure: toMoney(totalExposure),
        availableCredit: toMoney(availableCredit),
        payableAmount: toMoney(payableAmount),
        totalPaid: toMoney(totalPaid),
      };
    }

    if (applicableCreditDays !== null) {
      const transactionDate = parseDateOnly(input.transactionDate);
      const oldestOutstandingDate = await this.getOldestOutstandingTransactionDate(
        input.partyProfileId,
        input.excludeTransactionId,
      );

      if (transactionDate && oldestOutstandingDate) {
        const dueDate = startOfUtcDay(oldestOutstandingDate);
        dueDate.setUTCDate(dueDate.getUTCDate() + applicableCreditDays);
        const currentDate = startOfUtcDay(transactionDate);

        if (currentDate > dueDate) {
          const blockingReason = "Credit-days is over.";
          return {
            allowed: false,
            ruleType: "CREDIT_DAYS_OVER",
            blockingReason,
            blockingReasons: [blockingReason],
            outstandingAllowed,
            creditConfigured,
            applicableCreditLimit: toMoney(applicableCreditLimit),
            applicableCreditDays,
            existingOutstanding: toMoney(existingOutstanding),
            currentOutstanding: toMoney(currentOutstanding),
            totalExposure: toMoney(totalExposure),
            availableCredit: toMoney(availableCredit),
            payableAmount: toMoney(payableAmount),
            totalPaid: toMoney(totalPaid),
          };
        }
      }
    }

    return {
      allowed: true,
      ruleType: "OK",
      blockingReason: null,
      blockingReasons: [],
      outstandingAllowed,
      creditConfigured,
      applicableCreditLimit: toMoney(applicableCreditLimit),
      applicableCreditDays,
      existingOutstanding: toMoney(existingOutstanding),
      currentOutstanding: toMoney(currentOutstanding),
      totalExposure: toMoney(totalExposure),
      availableCredit: toMoney(availableCredit),
      payableAmount: toMoney(payableAmount),
      totalPaid: toMoney(totalPaid),
    };
  }

  async validate(input: PartyCreditValidationInput): Promise<void> {
    const result = await this.preview(input);
    if (!result.allowed) {
      throw new BadRequestException(
        result.blockingReason || "Credit validation failed",
      );
    }
  }
}
