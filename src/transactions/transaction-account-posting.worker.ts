import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { randomUUID } from "crypto";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { Product } from "../products/product.entity";
import {
  TransactionType,
  TradeMode,
  TransactionPaymentDirection,
  TransactionPostingDirection,
  TransactionPostingSourceType,
  TransactionEventType,
  TransactionEventStatus,
} from "./transactions.enums";
import { Transaction } from "./entities/transaction.entity";
import { TransactionItem } from "./entities/transaction-item.entity";
import { TransactionPayment } from "./entities/transaction-payment.entity";
import { TransactionAdditionalCharge } from "./entities/transaction-additional-charge.entity";
import { TransactionAccountPosting } from "./entities/transaction-account-posting.entity";
import { TransactionEvent } from "./entities/transaction-event.entity";
import { loadEntitySnapshot } from "../common/snapshot/entity-snapshot.util";
import { TransactionReferenceSnapshotValue } from "./types/transaction-snapshot.types";
import {
  resolveProductTransactionAccount,
  roundMoney,
  roundToScale,
  toPositiveAmount,
} from "./transaction-accounting.util";

const RETRY_DELAY_MS = 30_000;
const MAX_ATTEMPTS = 10;

type PostingDraft = {
  transactionId: string;
  createdBy: string;
  updatedBy: string;
  sourceType: TransactionPostingSourceType;
  sourceId: string | null;
  accountId: string;
  accountSnapshot: Record<string, unknown> | null;
  profileId: string | null;
  direction: TransactionPostingDirection;
  amount: string;
  remarks: string | null;
};

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

@Injectable()
export class TransactionAccountPostingWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TransactionAccountPostingWorker.name);
  private readonly workerId = randomUUID();
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(Transaction, "database2")
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionItem, "database2")
    private readonly transactionItemRepository: Repository<TransactionItem>,
    @InjectRepository(TransactionPayment, "database2")
    private readonly transactionPaymentRepository: Repository<TransactionPayment>,
    @InjectRepository(TransactionAdditionalCharge, "database2")
    private readonly transactionAdditionalChargeRepository: Repository<TransactionAdditionalCharge>,
    @InjectRepository(TransactionAccountPosting, "database2")
    private readonly transactionAccountPostingRepository: Repository<TransactionAccountPosting>,
    @InjectRepository(TransactionEvent, "database2")
    private readonly transactionEventRepository: Repository<TransactionEvent>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(AccountProfile)
    private readonly accountProfileRepository: Repository<AccountProfile>,
    private readonly additionalSettingService: AdditionalSettingService,
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
        "Transaction account posting worker failed",
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
          TransactionEventType.ACCOUNT_POSTINGS_REBUILD,
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
          rows.map((row: { id: string }) => row.id),
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

  private async processEvent(event: TransactionEvent) {
    try {
      const transaction = await this.transactionRepository.findOne({
        where: { id: event.transactionId },
        relations: {
          items: true,
          payments: true,
          additionalCharges: true,
        },
      });

      if (!transaction) {
        await this.finishEvent(event.id, {
          status: TransactionEventStatus.PROCESSED,
          processedAt: new Date(),
          lockedAt: null,
          lockedById: null,
          errorMessage: null,
        });
        return;
      }

      await this.rebuildTransaction(transaction);

      await this.finishEvent(event.id, {
        status: TransactionEventStatus.PROCESSED,
        processedAt: new Date(),
        lockedAt: null,
        lockedById: null,
        errorMessage: null,
      });
    } catch (error) {
      this.logger.error(
        `Failed to rebuild account postings for transaction ${event.transactionId}`,
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
          error instanceof Error ? error.message : "Unknown rebuild failure",
      });
    }
  }

  private async finishEvent(
    eventId: string,
    changes: Partial<
      Pick<
        TransactionEvent,
        | "status"
        | "processedAt"
        | "availableAt"
        | "lockedAt"
        | "lockedById"
        | "errorMessage"
      >
    >,
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

  private async rebuildTransaction(transaction: Transaction) {
    const isFinalStandardTransaction =
      transaction.isLatest &&
      transaction.status === "APPROVED" &&
      (transaction.transactionType === TransactionType.PURCHASE ||
        transaction.transactionType === TransactionType.SALE);

    const productSnapshots = new Map<string, TransactionReferenceSnapshotValue>();
    const accountSnapshots = new Map<string, TransactionReferenceSnapshotValue>();
    const productAccountCache = new Map<string, Product>();
    const avgCostCache = new Map<string, number>();

    const loadProduct = async (productId: string) => {
      const cached = productAccountCache.get(productId);
      if (cached) {
        return cached;
      }

      const product = await this.productRepository.findOne({
        where: { id: productId },
        relations: [
          "bulkPurAc",
          "purchaseAc",
          "bulkSaleAc",
          "saleAc",
          "bulkProficAc",
          "profitAc",
        ],
      });

      if (!product) {
        throw new BadRequestException(`Product with id ${productId} not found`);
      }

      productAccountCache.set(productId, product);
      return product;
    };

    const loadSnapshot = async (
      cache: Map<string, TransactionReferenceSnapshotValue>,
      repository: Repository<any>,
      id: string,
      label: string,
    ) => {
      if (!cache.has(id)) {
        const snapshot = await loadEntitySnapshot(repository, id);
        if (!snapshot) {
          throw new BadRequestException(`${label} with id ${id} not found`);
        }
        cache.set(id, snapshot as TransactionReferenceSnapshotValue);
      }

      return cache.get(id)!;
    };

    const resolveAccountSnapshot = async (accountId: string) =>
      loadSnapshot(
        accountSnapshots,
        this.accountProfileRepository,
        accountId,
        "Account profile",
      );

    const resolveProductSnapshot = async (productId: string) =>
      loadSnapshot(productSnapshots, this.productRepository, productId, "Product");

    const resolveAveragePurchaseCost = async (
      productId: string,
      currencyId: string,
      productCurrencyRateId: string | null,
    ): Promise<number> => {
      const cacheKey = [productId, currencyId, productCurrencyRateId ?? ""].join("|");
      const cached = avgCostCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }

      const rows = await this.database2.query(
        `
          SELECT COALESCE(
            SUM((ti.quantity::numeric * (ti.rate::numeric / COALESCE(NULLIF(ti.per::numeric, 0), 1)))) / NULLIF(SUM(ti.quantity::numeric), 0),
            0
          ) AS average_cost
          FROM transaction_items ti
          INNER JOIN transactions t ON t.id = ti.transaction_id
          WHERE t.status = $1
            AND t.is_latest = true
            AND t.transaction_type = $2
            AND ti.product_id = $3
            AND ti.currency_id = $4
            AND ($5::uuid IS NULL OR ti.product_currency_rate_id = $5::uuid)
        `,
        [
          "APPROVED",
          TransactionType.PURCHASE,
          productId,
          currencyId,
          productCurrencyRateId,
        ],
      );

      const averageCost = Number(rows?.[0]?.average_cost ?? 0);
      avgCostCache.set(cacheKey, averageCost);
      return averageCost;
    };

  const determineAccount = (
      product: Product,
      kind: "purchase" | "sale" | "profit",
    ) => {
      const account =
        kind === "profit"
          ? resolveProductTransactionAccount(
              product,
              TransactionType.SALE,
              transaction.tradeMode as TradeMode,
              kind,
            )
          : resolveProductTransactionAccount(
              product,
              transaction.transactionType as TransactionType,
              transaction.tradeMode as TradeMode,
              kind,
            );

      if (!account) {
        throw new BadRequestException(
          `Product account is not configured for ${kind} postings`,
        );
      }

      return account;
    };

    const resolveRoundOffDirection = (
      roundOffAmount: number,
      transactionType: TransactionType,
    ): TransactionPostingDirection | null => {
      if (!Number.isFinite(roundOffAmount) || roundOffAmount === 0) {
        return null;
      }

      if (transactionType === TransactionType.PURCHASE) {
        return roundOffAmount > 0
          ? TransactionPostingDirection.DEBIT
          : TransactionPostingDirection.CREDIT;
      }

      return roundOffAmount > 0
        ? TransactionPostingDirection.CREDIT
        : TransactionPostingDirection.DEBIT;
    };

    const itemPostingGroups = new Map<
      string,
      Omit<PostingDraft, "amount"> & { amountCents: number }
    >();
    const postingSequence: PostingDraft[] = [];
    let roundOffAccountId: string | null = null;
    let roundOffAccountSnapshot: TransactionReferenceSnapshotValue = null;
    const postingActorId =
      transaction.updatedBy || transaction.createdBy || this.workerId;

    const addGroupedPosting = (posting: PostingDraft) => {
      const key = [
        posting.sourceType,
        posting.accountId,
        posting.profileId ?? "",
        posting.direction,
      ].join("|");

      const existing = itemPostingGroups.get(key);
      if (existing) {
        existing.amountCents += Math.round(Number(posting.amount) * 100);
        return;
      }

      itemPostingGroups.set(key, {
        ...posting,
        amountCents: Math.round(Number(posting.amount) * 100),
      });
    };

    const addPosting = (posting: PostingDraft, grouped = false) => {
      if (grouped) {
        addGroupedPosting(posting);
        return;
      }

      postingSequence.push(posting);
    };

    const sortedItems = [...(transaction.items ?? [])].sort((left, right) => left.lineNo - right.lineNo);

    const itemUpdates: TransactionItem[] = [];

    for (const item of sortedItems) {
      const product = await loadProduct(item.productId);
      const productSnapshot = await resolveProductSnapshot(item.productId);
      const itemAccount =
        transaction.transactionType === TransactionType.SALE
          ? resolveProductTransactionAccount(
              product,
              transaction.transactionType,
              transaction.tradeMode as TradeMode,
              "sale",
            )
          : resolveProductTransactionAccount(
              product,
              transaction.transactionType,
              transaction.tradeMode as TradeMode,
              "purchase",
            );

      if (!itemAccount) {
        throw new BadRequestException(
          `Product account is not configured for item ${item.id}`,
        );
      }

      const accountSnapshot = await resolveAccountSnapshot(itemAccount.id);

      item.accountId = itemAccount.id;
      item.accountSnapshot = accountSnapshot;
      item.productSnapshot = productSnapshot;
      item.updatedBy = transaction.updatedBy;

      const quantity = Number(item.quantity);
      const rate = Number(item.rate);
      const per = Number(item.per ?? 1) || 1;
      const unitRate = rate / per;
      const itemTotalAmount = Number(roundMoney(quantity * unitRate));
      const roundOffAmount = Number(item.roundOff ?? 0);

      if (!isFinalStandardTransaction) {
        item.holdCost = null;
        item.profit = null;
        itemUpdates.push(item);
        continue;
      }

      if (transaction.transactionType === TransactionType.PURCHASE) {
        item.holdCost = roundToScale(unitRate, 7);
        item.profit = roundToScale(0, 2);
        addPosting(
          {
            transactionId: transaction.id,
            createdBy: postingActorId,
            updatedBy: postingActorId,
            sourceType: "ITEM",
            sourceId: item.id,
            accountId: itemAccount.id,
            accountSnapshot,
            profileId: null,
            direction: TransactionPostingDirection.DEBIT,
            amount: roundMoney(itemTotalAmount),
            remarks: `Purchase item ${item.lineNo}`,
          },
          true,
        );
        itemUpdates.push(item);

        const roundOffDirection = resolveRoundOffDirection(
          roundOffAmount,
          transaction.transactionType as TransactionType,
        );
        if (roundOffDirection) {
          addPosting(
            {
              transactionId: transaction.id,
              createdBy: postingActorId,
              updatedBy: postingActorId,
              sourceType: TransactionPostingSourceType.ROUND_OFF,
              sourceId: item.id,
              accountId: roundOffAccountId as string,
              accountSnapshot: roundOffAccountSnapshot,
              profileId: null,
              direction: roundOffDirection,
              amount: roundMoney(Math.abs(roundOffAmount)),
              remarks: `Purchase round off item ${item.lineNo}`,
            },
            false,
          );
        }
        continue;
      }

      const averageCost = await resolveAveragePurchaseCost(
        item.productId,
        item.currencyId,
        item.productCurrencyRateId,
      );
      const holdCost = averageCost > 0 ? averageCost : unitRate;
      const profitRate = unitRate - holdCost;
      const signedProfitAmount = Number(roundMoney(quantity * profitRate));
      const profitAmount = Math.abs(signedProfitAmount);
      const saleAmount = Number(roundMoney(itemTotalAmount - signedProfitAmount));
      const profitAccount = determineAccount(product, "profit");
      const saleAccount = determineAccount(product, "sale");
      const profitAccountSnapshot = await resolveAccountSnapshot(profitAccount.id);
      const saleAccountSnapshot = await resolveAccountSnapshot(saleAccount.id);

      item.holdCost = roundToScale(holdCost, 7);
      item.profit = roundToScale(profitRate, 2);

      addPosting(
        {
          transactionId: transaction.id,
          createdBy: postingActorId,
          updatedBy: postingActorId,
          sourceType: "ITEM_PROFIT",
          sourceId: item.id,
          accountId: profitAccount.id,
          accountSnapshot: profitAccountSnapshot,
          profileId: null,
          direction:
            signedProfitAmount >= 0
              ? TransactionPostingDirection.CREDIT
              : TransactionPostingDirection.DEBIT,
          amount: toPositiveAmount(signedProfitAmount),
          remarks: `Sale profit item ${item.lineNo}`,
        },
        true,
      );

      const roundOffDirection = resolveRoundOffDirection(
        roundOffAmount,
        transaction.transactionType as TransactionType,
      );
      if (roundOffDirection) {
        addPosting(
          {
            transactionId: transaction.id,
            createdBy: postingActorId,
            updatedBy: postingActorId,
            sourceType: TransactionPostingSourceType.ROUND_OFF,
            sourceId: item.id,
            accountId: roundOffAccountId as string,
            accountSnapshot: roundOffAccountSnapshot,
            profileId: null,
            direction: roundOffDirection,
            amount: roundMoney(Math.abs(roundOffAmount)),
            remarks: `Sale round off item ${item.lineNo}`,
          },
          false,
        );
      }

      addPosting(
        {
          transactionId: transaction.id,
          createdBy: postingActorId,
          updatedBy: postingActorId,
          sourceType: "ITEM_SALE",
          sourceId: item.id,
          accountId: saleAccount.id,
          accountSnapshot: saleAccountSnapshot,
          profileId: null,
          direction: TransactionPostingDirection.CREDIT,
          amount: roundMoney(saleAmount),
          remarks: `Sale amount item ${item.lineNo}`,
        },
        true,
      );

      itemUpdates.push(item);
    }

    const chargeRows = [...(transaction.additionalCharges ?? [])].sort(
      (left, right) => left.lineNo - right.lineNo,
    );
    const paymentRows = [...(transaction.payments ?? [])].sort(
      (left, right) => left.lineNo - right.lineNo,
    );

    let controlAccountId: string | null = null;
    let controlAccountSnapshot: TransactionReferenceSnapshotValue = null;
    let controlDirection: TransactionPostingDirection =
      TransactionPostingDirection.CREDIT;

    if (isFinalStandardTransaction) {
      const settingCode =
        transaction.transactionType === TransactionType.PURCHASE
          ? "PURCHASE_CONTROL_ACCOUNT"
          : "SALE_CONTROL_ACCOUNT";
      const accountIdText = await this.additionalSettingService.getSettingTextValue(
        "TRANSACTION_ACCOUNTING",
        settingCode,
      );

      if (!accountIdText) {
        throw new BadRequestException(
          `Missing ${settingCode} additional setting`,
        );
      }

      controlAccountId = accountIdText;
      controlAccountSnapshot = await resolveAccountSnapshot(accountIdText);
      const roundOffAccountText =
        await this.additionalSettingService.getSettingTextValue(
          "TRANSACTION_ACCOUNTING",
          "ROUND_OFF_ACCOUNT",
        );

      if (!roundOffAccountText) {
        throw new BadRequestException(
          "Missing ROUND_OFF_ACCOUNT additional setting",
        );
      }

      roundOffAccountId = roundOffAccountText;
      roundOffAccountSnapshot = await resolveAccountSnapshot(roundOffAccountText);
      controlDirection =
        transaction.transactionType === TransactionType.PURCHASE
          ? TransactionPostingDirection.CREDIT
          : TransactionPostingDirection.DEBIT;
      const itemTotal = sortedItems.reduce((sum, currentItem) => {
        const quantity = Number(currentItem.quantity);
        const rate = Number(currentItem.rate);
        return sum + Number(roundMoney(quantity * rate));
      }, 0);
      const chargeTotal = chargeRows.reduce(
        (sum, currentCharge) => sum + Number(roundMoney(Number(currentCharge.amount))),
        0,
      );
      const roundOffTotal = sortedItems.reduce(
        (sum, currentItem) => sum + Number(currentItem.roundOff ?? 0),
        0,
      );
      const controlAmountTotal = Number(
        roundMoney(itemTotal + roundOffTotal + chargeTotal),
      );

      addPosting(
        {
          transactionId: transaction.id,
          createdBy: postingActorId,
          updatedBy: postingActorId,
          sourceType: "PARTY_CONTROL",
          sourceId: null,
          accountId: controlAccountId,
          accountSnapshot: controlAccountSnapshot,
          profileId: transaction.partyProfileId,
          direction: controlDirection,
          amount: roundMoney(controlAmountTotal),
          remarks:
            transaction.transactionType === TransactionType.PURCHASE
              ? "Purchase party control"
              : "Sale party control",
        },
        false,
      );
    }

    for (const charge of chargeRows) {
      const accountSnapshot = await resolveAccountSnapshot(charge.accountId);

      if (!isFinalStandardTransaction) {
        continue;
      }

      addPosting(
        {
          transactionId: transaction.id,
          createdBy: postingActorId,
          updatedBy: postingActorId,
          sourceType: "ADDITIONAL_CHARGE",
          sourceId: charge.id,
          accountId: charge.accountId,
          accountSnapshot,
          profileId: null,
          direction: TransactionPostingDirection.CREDIT,
          amount: roundMoney(Number(charge.amount)),
          remarks: charge.remarks ?? null,
        },
        false,
      );

      addPosting(
        {
          transactionId: transaction.id,
          createdBy: postingActorId,
          updatedBy: postingActorId,
          sourceType: "ADDITIONAL_CHARGE",
          sourceId: charge.id,
          accountId: controlAccountId as string,
          accountSnapshot: controlAccountSnapshot,
          profileId: transaction.partyProfileId,
          direction: TransactionPostingDirection.DEBIT,
          amount: roundMoney(Number(charge.amount)),
          remarks: `Additional charge control ${charge.lineNo}`,
        },
        false,
      );
    }

    for (const payment of paymentRows) {
      const accountSnapshot = await resolveAccountSnapshot(payment.accountId);
      const amount = roundMoney(Number(payment.amount));
      const paymentDirection =
        payment.paymentDirection === TransactionPaymentDirection.RECEIPT
          ? TransactionPostingDirection.DEBIT
          : TransactionPostingDirection.CREDIT;

      if (!isFinalStandardTransaction) {
        continue;
      }

      addPosting(
        {
          transactionId: transaction.id,
          createdBy: postingActorId,
          updatedBy: postingActorId,
          sourceType: "PAYMENT",
          sourceId: payment.id,
          accountId: payment.accountId,
          accountSnapshot,
          profileId: null,
          direction: paymentDirection,
          amount,
          remarks: payment.remarks ?? null,
        },
        false,
      );

      addPosting(
        {
          transactionId: transaction.id,
          createdBy: postingActorId,
          updatedBy: postingActorId,
          sourceType: "PAYMENT",
          sourceId: payment.id,
          accountId: controlAccountId as string,
          accountSnapshot: controlAccountSnapshot,
          profileId: transaction.partyProfileId,
          direction:
            paymentDirection === TransactionPostingDirection.DEBIT
              ? TransactionPostingDirection.CREDIT
              : TransactionPostingDirection.DEBIT,
          amount,
          remarks: `Payment control ${payment.lineNo}`,
        },
        false,
      );
    }

    const groupedPostings = [...itemPostingGroups.values()].map((posting) => ({
      transactionId: posting.transactionId,
      createdBy: posting.createdBy,
      updatedBy: posting.updatedBy,
      sourceType: posting.sourceType,
      sourceId: posting.sourceId,
      accountId: posting.accountId,
      accountSnapshot: posting.accountSnapshot,
      profileId: posting.profileId,
      direction: posting.direction,
      amount: roundMoney(posting.amountCents / 100),
      remarks: posting.remarks,
    }));

    const finalPostings = [
      ...groupedPostings,
      ...postingSequence,
    ].map((posting, index) => ({
      ...posting,
      lineNo: index + 1,
    }));

    await this.database2.transaction(async (manager) => {
      const postingRepo = manager.getRepository(TransactionAccountPosting);
      const itemRepo = manager.getRepository(TransactionItem);

      await manager.query(
        `SELECT set_config('app.skip_transaction_account_postings_enqueue', 'true', true)`,
      );

      await postingRepo.delete({ transactionId: transaction.id });

      if (itemUpdates.length > 0) {
        await itemRepo.save(itemUpdates);
      }

      if (finalPostings.length > 0) {
        await postingRepo.save(finalPostings);
      }
    });
  }
}
