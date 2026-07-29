import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { DataSource, Repository } from "typeorm";
import { Branch } from "../branches/branch.entity";
import { Counter } from "../counters/counter.entity";
import { Currency } from "../currencies/currency.entity";
import { loadEntitySnapshot } from "../common/snapshot/entity-snapshot.util";
import { PartyProfile } from "../party-profiles/party-profile.entity";
import { TransactionBalanceCurrency } from "./entities/transaction-balance-currency.entity";
import { Transaction } from "./entities/transaction.entity";
import { TransactionEvent } from "./entities/transaction-event.entity";
import {
  TransactionEventStatus,
  TransactionEventType,
  TransactionType,
} from "./transactions.enums";
import { roundMoney, roundToScale } from "./transaction-accounting.util";
import {
  normalizeBalanceProfileType,
} from "./transaction-balance-profile.util";
import { TransactionReferenceSnapshotValue } from "./types/transaction-snapshot.types";

const RETRY_DELAY_MS = 30_000;
const MAX_ATTEMPTS = 10;

type ClaimedTransactionEventRow = {
  id: string;
  transaction_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: TransactionEventStatus;
  attempt_count: number;
  available_at: Date;
  processed_at: Date | null;
  error_message: string | null;
  locked_at: Date | null;
  locked_by_id: string | null;
  created_by: string;
  updated_by: string;
  created_at: Date;
  updated_at: Date;
};

type BalanceEventPayload = {
  transactionId?: string | null;
  branchId?: string | null;
  counterId?: string | null;
  transactionCreatedAt?: string | Date | null;
  profileType?: string | null;
  currencyIds?: unknown;
  operation?: string | null;
  tableName?: string | null;
};

type RebuildContext = {
  transactionId: string;
  branchId: string;
  counterId: string;
  transactionCreatedAt: Date;
  profileType: string;
  currencyIds: string[];
  sourceTransactionExists: boolean;
};

type BalanceSourceRow = {
  transaction_id: string;
  transaction_created_at: Date;
  transaction_type: TransactionType;
  branch_id: string;
  counter_id: string;
  branch_snapshot: TransactionReferenceSnapshotValue;
  counter_snapshot: TransactionReferenceSnapshotValue;
  party_profile_snapshot: TransactionReferenceSnapshotValue;
  transaction_party_profile_type: string | null;
  currency_id: string;
  quantity: string;
  per: string | null;
  rate: string;
  hold_cost: string | null;
  line_no: number;
};

type AggregatedTransactionRow = {
  transactionId: string;
  transactionCreatedAt: Date;
  transactionType: TransactionType;
  branchId: string;
  counterId: string;
  branchSnapshot: TransactionReferenceSnapshotValue;
  counterSnapshot: TransactionReferenceSnapshotValue;
  profileType: string;
  currencyId: string;
  purchaseQty: number;
  purchaseRs: number;
  sellQty: number;
  sellRs: number;
  saleHoldCostAmount: number;
};

type BalanceRowSeed = {
  date: Date;
  branchId: string;
  branchSnapshot: TransactionReferenceSnapshotValue;
  counterId: string;
  counterSnapshot: TransactionReferenceSnapshotValue;
  currencyId: string;
  currencySnapshot: TransactionReferenceSnapshotValue;
  profileType: string;
  opening: number;
  openingRs: number;
  purchase: number;
  purchaseRs: number;
  sell: number;
  sellRs: number;
  adjustSellRs: number;
  closing: number;
  closingRs: number;
};

function parseDateValue(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCurrencyIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const single = String(value ?? "").trim();
    return single ? [single] : [];
  }

  return [...new Set(value.map((entry) => String(entry ?? "").trim()).filter(Boolean))];
}

@Injectable()
export class TransactionBalanceCurrencyWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TransactionBalanceCurrencyWorker.name);
  private readonly workerId = randomUUID();
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(Transaction, "database2")
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionEvent, "database2")
    private readonly transactionEventRepository: Repository<TransactionEvent>,
    @InjectRepository(TransactionBalanceCurrency, "database2")
    private readonly transactionBalanceCurrencyRepository: Repository<TransactionBalanceCurrency>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(PartyProfile)
    private readonly partyProfileRepository: Repository<PartyProfile>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
  ) {}

  onModuleInit() {
    void this.runLoop();
    this.interval = setInterval(() => {
      void this.runLoop();
    }, 15_000);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async runLoop() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      while (true) {
        const events = await this.claimPendingEvents(5);
        if (!events.length) {
          break;
        }

        for (const event of events) {
          await this.processEvent(event);
        }
      }
    } catch (error) {
      this.logger.error(
        "Transaction balance currency worker failed",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async claimPendingEvents(limit: number): Promise<TransactionEvent[]> {
    return this.database2.transaction(async (manager) => {
      const rows = (await manager.query(
        `
          SELECT *
          FROM transaction_events
          WHERE event_type = $1
            AND status = $2
            AND available_at <= now()
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $3
        `,
        [
          TransactionEventType.BALANCE_CURRENCIES_REBUILD,
          TransactionEventStatus.PENDING,
          limit,
        ],
      )) as ClaimedTransactionEventRow[];

      if (!rows.length) {
        return [];
      }

      await manager.query(
        `
          UPDATE transaction_events
          SET status = $2,
              attempt_count = attempt_count + 1,
              locked_at = now(),
              locked_by_id = $3,
              updated_at = now(),
              updated_by = created_by
          WHERE id = ANY($1::uuid[])
        `,
        [
          rows.map((row) => row.id),
          TransactionEventStatus.PROCESSING,
          this.workerId,
        ],
      );

      return rows.map((row) =>
        this.transactionEventRepository.create({
          id: row.id,
          transactionId: row.transaction_id,
          eventType: row.event_type,
          payload: row.payload,
          status: row.status,
          attemptCount: row.attempt_count,
          availableAt: row.available_at,
          processedAt: row.processed_at,
          errorMessage: row.error_message,
          lockedAt: row.locked_at,
          lockedById: row.locked_by_id,
          createdBy: row.created_by,
          updatedBy: row.updated_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
      );
    });
  }

  private async finishEvent(
    eventId: string,
    changes: {
      status: TransactionEventStatus;
      availableAt?: Date;
      processedAt?: Date | null;
      lockedAt?: Date | null;
      lockedById?: string | null;
      errorMessage?: string | null;
    },
  ) {
    await this.database2.transaction(async (manager) => {
      await manager.getRepository(TransactionEvent).update(
        { id: eventId },
        {
          ...(changes.status ? { status: changes.status } : {}),
          ...(changes.processedAt !== undefined
            ? { processedAt: changes.processedAt }
            : {}),
          ...(changes.availableAt !== undefined
            ? { availableAt: changes.availableAt }
            : {}),
          ...(changes.lockedAt !== undefined ? { lockedAt: changes.lockedAt } : {}),
          ...(changes.lockedById !== undefined
            ? { lockedById: changes.lockedById }
            : {}),
          ...(changes.errorMessage !== undefined
            ? { errorMessage: changes.errorMessage }
            : {}),
          updatedBy: this.workerId,
        },
      );
    });
  }

  private async processEvent(event: TransactionEvent) {
    try {
      const context = await this.resolveContext(event);

      for (const currencyId of context.currencyIds) {
        await this.rebuildChainForCurrency(context, currencyId);
      }

      await this.finishEvent(event.id, {
        status: TransactionEventStatus.PROCESSED,
        processedAt: new Date(),
        lockedAt: null,
        lockedById: null,
        errorMessage: null,
      });
    } catch (error) {
      this.logger.error(
        `Failed to rebuild balance currencies for transaction ${event.transactionId}`,
        error instanceof Error ? error.stack : String(error),
      );

      const nextAttempt = Math.max(1, event.attemptCount + 1);
      const shouldFailPermanently = nextAttempt >= MAX_ATTEMPTS;

      await this.finishEvent(event.id, {
        status: shouldFailPermanently
          ? TransactionEventStatus.FAILED
          : TransactionEventStatus.PENDING,
        availableAt: shouldFailPermanently
          ? event.availableAt
          : new Date(Date.now() + RETRY_DELAY_MS),
        processedAt: shouldFailPermanently ? new Date() : null,
        lockedAt: null,
        lockedById: null,
        errorMessage:
          error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async resolveContext(event: TransactionEvent): Promise<RebuildContext> {
    const payload = (event.payload ?? {}) as BalanceEventPayload;
    const transactionId = String(payload.transactionId ?? event.transactionId ?? "").trim();
    const transaction = transactionId
      ? await this.transactionRepository.findOne({
          where: { id: transactionId },
          relations: { items: true },
        })
      : null;

    if (transaction) {
      const branchSnapshot =
        (transaction.branchSnapshot as TransactionReferenceSnapshotValue) ??
        (await loadEntitySnapshot(this.branchRepository, transaction.branchId));
      const counterSnapshot =
        (transaction.counterSnapshot as TransactionReferenceSnapshotValue) ??
        (await loadEntitySnapshot(this.counterRepository, transaction.counterId));
      const profileType = normalizeBalanceProfileType(
        transaction.partyProfileSnapshot?.type ??
          transaction.transactionPartyProfileType ??
          (await this.resolvePartyProfileType(transaction.partyProfileId)),
      );
      const currencyIds = normalizeCurrencyIds(
        transaction.items?.map((item) => item.currencyId) ?? payload.currencyIds,
      );

      if (!currencyIds.length) {
        return {
          transactionId: transaction.id,
          branchId: transaction.branchId,
          counterId: transaction.counterId,
          transactionCreatedAt: transaction.createdAt,
          profileType,
          currencyIds: [],
          sourceTransactionExists: true,
        };
      }

      return {
        transactionId: transaction.id,
        branchId: transaction.branchId,
        counterId: transaction.counterId,
        transactionCreatedAt: transaction.createdAt,
        profileType,
        currencyIds,
        sourceTransactionExists: true,
      };
    }

    const branchId = String(payload.branchId ?? "").trim();
    const counterId = String(payload.counterId ?? "").trim();
    const transactionCreatedAt = parseDateValue(payload.transactionCreatedAt);
    const profileType = normalizeBalanceProfileType(payload.profileType);
    const currencyIds = normalizeCurrencyIds(payload.currencyIds);

    if (!branchId || !counterId || !transactionCreatedAt) {
      throw new Error(
        "Unable to resolve balance rebuild context for deleted or missing transaction",
      );
    }

    return {
      transactionId,
      branchId,
      counterId,
      transactionCreatedAt,
      profileType,
      currencyIds,
      sourceTransactionExists: false,
    };
  }

  private async resolvePartyProfileType(
    partyProfileId: string | null | undefined,
  ): Promise<string | null> {
    const normalizedId = String(partyProfileId ?? "").trim();
    if (!normalizedId) {
      return null;
    }

    const partyProfile = await this.partyProfileRepository.findOne({
      where: { id: normalizedId },
      select: { id: true, type: true },
    });

    return partyProfile?.type ?? null;
  }

  private async rebuildChainForCurrency(
    context: RebuildContext,
    currencyId: string,
  ) {
    const previousRow = await this.transactionBalanceCurrencyRepository
      .createQueryBuilder("balance")
      .where("balance.branchId = :branchId", { branchId: context.branchId })
      .andWhere("balance.counterId = :counterId", {
        counterId: context.counterId,
      })
      .andWhere("balance.currencyId = :currencyId", { currencyId })
      .andWhere("balance.profileType = :profileType", {
        profileType: context.profileType,
      })
      .andWhere("balance.date < :cutoff", { cutoff: context.transactionCreatedAt })
      .orderBy("balance.date", "DESC")
      .addOrderBy("balance.updatedAt", "DESC")
      .getOne();

    await this.transactionBalanceCurrencyRepository
      .createQueryBuilder()
      .delete()
      .from(TransactionBalanceCurrency)
      .where('"branch_id" = :branchId', { branchId: context.branchId })
      .andWhere('"counter_id" = :counterId', { counterId: context.counterId })
      .andWhere('"currency_id" = :currencyId', { currencyId })
      .andWhere('"profiletype" = :profileType', {
        profileType: context.profileType,
      })
      .andWhere('"date" >= :cutoff', { cutoff: context.transactionCreatedAt })
      .execute();

    const sourceRows = (await this.database2.query(
      `
        SELECT
          t.id AS transaction_id,
          t.created_at AS transaction_created_at,
          t.transaction_type AS transaction_type,
          t.branch_id AS branch_id,
          t.counter_id AS counter_id,
          t.branch_snapshot AS branch_snapshot,
          t.counter_snapshot AS counter_snapshot,
          t.party_profile_snapshot AS party_profile_snapshot,
          t.transaction_party_profile_type AS transaction_party_profile_type,
          ti.currency_id AS currency_id,
          ti.quantity AS quantity,
          ti.per AS per,
          ti.rate AS rate,
          ti.hold_cost AS hold_cost,
          ti.line_no AS line_no
        FROM transactions t
        INNER JOIN transaction_items ti ON ti.transaction_id = t.id
        WHERE t.status = $1
          AND t.is_latest = true
          AND t.transaction_type IN ($2, $3)
          AND t.branch_id = $4
          AND t.counter_id = $5
          AND ti.currency_id = $6
          AND t.created_at >= $7
        ORDER BY t.created_at ASC, t.id ASC, ti.line_no ASC
      `,
      [
        "APPROVED",
        TransactionType.PURCHASE,
        TransactionType.SALE,
        context.branchId,
        context.counterId,
        currencyId,
        context.transactionCreatedAt,
      ],
    )) as BalanceSourceRow[];

    const groupedRows = new Map<string, AggregatedTransactionRow>();

    for (const row of sourceRows) {
      const rowProfileType = normalizeBalanceProfileType(
        row.party_profile_snapshot?.type ??
          row.transaction_party_profile_type ??
          context.profileType,
      );

      if (rowProfileType !== context.profileType) {
        continue;
      }

      const existing = groupedRows.get(row.transaction_id);
      const quantity = Number(row.quantity ?? 0);
      const rate = Number(row.rate ?? 0);
      const per = Number(row.per ?? 1) || 1;
      const unitRate = rate / per;
      const purchaseRs = quantity * unitRate;
      const holdCostRate = Number(row.hold_cost ?? 0);
      const saleHoldCostRate = holdCostRate > 0 ? holdCostRate : unitRate;
      const saleHoldCostAmount = quantity * saleHoldCostRate;

      if (existing) {
        if (row.transaction_type === TransactionType.PURCHASE) {
          existing.purchaseQty += quantity;
          existing.purchaseRs += purchaseRs;
        } else {
          existing.sellQty += quantity;
          existing.saleHoldCostAmount += saleHoldCostAmount;
        }
        continue;
      }

      groupedRows.set(row.transaction_id, {
        transactionId: row.transaction_id,
        transactionCreatedAt: row.transaction_created_at,
        transactionType: row.transaction_type,
        branchId: row.branch_id,
        counterId: row.counter_id,
        branchSnapshot: row.branch_snapshot,
        counterSnapshot: row.counter_snapshot,
        profileType: rowProfileType,
        currencyId: row.currency_id,
        purchaseQty:
          row.transaction_type === TransactionType.PURCHASE ? quantity : 0,
        purchaseRs:
          row.transaction_type === TransactionType.PURCHASE ? purchaseRs : 0,
        sellQty: row.transaction_type === TransactionType.SALE ? quantity : 0,
        sellRs: 0,
        saleHoldCostAmount:
          row.transaction_type === TransactionType.SALE ? saleHoldCostAmount : 0,
      });
    }

    const orderedRows = [...groupedRows.values()].sort(
      (left, right) =>
        left.transactionCreatedAt.getTime() -
          right.transactionCreatedAt.getTime() ||
        left.transactionId.localeCompare(right.transactionId),
    );

    let runningQty = Number(previousRow?.closing ?? 0);
    let runningRs = Number(previousRow?.closingRs ?? 0);
    const currencySnapshot =
      ((await loadEntitySnapshot(this.currencyRepository, currencyId)) as
        | TransactionReferenceSnapshotValue
        | null) ?? null;
    const seeds: BalanceRowSeed[] = [];

    for (const row of orderedRows) {
      const opening = runningQty;
      const openingRs = runningRs;
      let purchase = row.purchaseQty;
      let purchaseRs = row.purchaseRs;
      let sell = row.sellQty;
      let sellRs = row.sellRs;

      if (row.transactionType === TransactionType.SALE) {
        const averageCost = opening > 0 ? openingRs / opening : 0;
        const fallbackUnitRate =
          row.sellQty > 0 ? row.saleHoldCostAmount / row.sellQty : 0;
        const unitCost = averageCost > 0 ? averageCost : fallbackUnitRate;
        sellRs = Number(roundMoney(sell * unitCost));
      } else {
        sell = 0;
        sellRs = 0;
      }

      const closing = Number(roundToScale(opening + purchase - sell, 7));
      const rawClosingRs = openingRs + purchaseRs - sellRs;
      const closingRs = Number(roundMoney(rawClosingRs));
      const adjustSellRs = Number(roundMoney(rawClosingRs - closingRs));
      const effectiveSellRs = Number(roundMoney(sellRs + adjustSellRs));

      seeds.push({
        date: row.transactionCreatedAt,
        branchId: row.branchId,
        branchSnapshot: row.branchSnapshot,
        counterId: row.counterId,
        counterSnapshot: row.counterSnapshot,
        currencyId: row.currencyId,
        currencySnapshot,
        profileType: row.profileType,
        opening: Number(roundToScale(opening, 7)),
        openingRs: Number(roundMoney(openingRs)),
        purchase: Number(roundToScale(purchase, 7)),
        purchaseRs: Number(roundMoney(purchaseRs)),
        sell: Number(roundToScale(sell, 7)),
        sellRs: effectiveSellRs,
        adjustSellRs,
        closing,
        closingRs,
      });

      runningQty = closing;
      runningRs = closingRs;
    }

    if (!seeds.length && !previousRow) {
      return;
    }

    const rowsToSave = seeds.map((seed) =>
      this.transactionBalanceCurrencyRepository.create({
        date: seed.date,
        branchId: seed.branchId,
        branchSnapshot: seed.branchSnapshot,
        counterId: seed.counterId,
        counterSnapshot: seed.counterSnapshot,
        currencyId: seed.currencyId,
        currencySnapshot: seed.currencySnapshot,
        profileType: seed.profileType,
        opening: roundToScale(seed.opening, 7),
        openingRs: roundMoney(seed.openingRs),
        purchase: roundToScale(seed.purchase, 7),
        purchaseRs: roundMoney(seed.purchaseRs),
        sell: roundToScale(seed.sell, 7),
        sellRs: roundMoney(seed.sellRs),
        adjustSellRs: roundMoney(seed.adjustSellRs),
        closing: roundToScale(seed.closing, 7),
        closingRs: roundMoney(seed.closingRs),
        createdBy: this.workerId,
        updatedBy: this.workerId,
      }),
    );

    if (!rowsToSave.length) {
      return;
    }

    await this.transactionBalanceCurrencyRepository.save(rowsToSave);
  }
}
