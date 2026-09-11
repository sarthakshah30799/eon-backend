import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { randomUUID } from "crypto";
import {
  AccountingVoucher,
  VoucherAccountPosting,
  VoucherEvent,
} from "./entities";
import {
  VoucherAdviceRole,
  VoucherEntryDirection,
  VoucherEventStatus,
  VoucherEventType,
  VoucherPostingSourceType,
  VoucherType,
} from "./voucher.enums";
import { TransactionReferenceSnapshotValue } from "../transactions/types/transaction-snapshot.types";

const RETRY_DELAY_MS = 30_000;
const MAX_ATTEMPTS = 10;
const SKIP_ENQUEUE_GUC = "app.skip_voucher_account_postings_enqueue";

type PostingDraft = {
  voucherId: string;
  createdBy: string;
  updatedBy: string;
  sourceType: VoucherPostingSourceType;
  sourceId: string | null;
  transactionId: string | null;
  transactionSnapshot: TransactionReferenceSnapshotValue;
  accountId: string;
  accountSnapshot: TransactionReferenceSnapshotValue;
  profileId: string | null;
  profileSnapshot: TransactionReferenceSnapshotValue;
  direction: VoucherEntryDirection;
  amount: string;
  remarks: string | null;
};

type ClaimedVoucherEventRow = {
  id: string;
  voucher_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: VoucherEventStatus;
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

const toPositiveAmount = (value: unknown): string | null => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return amount.toFixed(2);
};

@Injectable()
export class VoucherAccountPostingWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(VoucherAccountPostingWorker.name);
  private readonly workerId = randomUUID();
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(AccountingVoucher, "database2")
    private readonly voucherRepository: Repository<AccountingVoucher>,
    @InjectRepository(VoucherAccountPosting, "database2")
    private readonly postingRepository: Repository<VoucherAccountPosting>,
    @InjectRepository(VoucherEvent, "database2")
    private readonly eventRepository: Repository<VoucherEvent>,
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
        "Voucher account posting worker failed",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async claimPendingEvents(limit: number): Promise<VoucherEvent[]> {
    return this.database2.transaction(async (manager) => {
      const rows = (await manager.query(
        `
          SELECT *
          FROM voucher_events
          WHERE event_type = $1
            AND status = $2
            AND available_at <= now()
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $3
        `,
        [
          VoucherEventType.ACCOUNT_POSTINGS_REBUILD,
          VoucherEventStatus.PENDING,
          limit,
        ],
      )) as ClaimedVoucherEventRow[];

      if (!rows.length) {
        return [];
      }

      await manager.query(
        `
          UPDATE voucher_events
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
          VoucherEventStatus.PROCESSING,
          this.workerId,
        ],
      );

      return rows.map((row) =>
        this.eventRepository.create({
          id: row.id,
          voucherId: row.voucher_id,
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

  private async processEvent(event: VoucherEvent) {
    try {
      const voucher = await this.voucherRepository.findOne({
        where: { id: event.voucherId },
        relations: { items: true },
      });

      if (!voucher) {
        await this.database2.transaction(async (manager) => {
          await manager.query(
            `SELECT set_config('${SKIP_ENQUEUE_GUC}', 'true', true)`,
          );
          await manager.getRepository(VoucherAccountPosting).delete({
            voucherId: event.voucherId,
          });
        });
        await this.finishEvent(event.id, {
          status: VoucherEventStatus.PROCESSED,
          processedAt: new Date(),
          lockedAt: null,
          lockedById: null,
          errorMessage: null,
        });
        return;
      }

      await this.rebuildVoucher(voucher);

      await this.finishEvent(event.id, {
        status: VoucherEventStatus.PROCESSED,
        processedAt: new Date(),
        lockedAt: null,
        lockedById: null,
        errorMessage: null,
      });
    } catch (error) {
      this.logger.error(
        `Failed to rebuild account postings for voucher ${event.voucherId}`,
        error instanceof Error ? error.stack : String(error),
      );

      const nextAttempt = Math.max(1, event.attemptCount + 1);
      const shouldFailPermanently = nextAttempt >= MAX_ATTEMPTS;

      await this.finishEvent(event.id, {
        status: shouldFailPermanently
          ? VoucherEventStatus.FAILED
          : VoucherEventStatus.PENDING,
        availableAt: shouldFailPermanently
          ? new Date()
          : new Date(Date.now() + RETRY_DELAY_MS),
        processedAt: shouldFailPermanently ? new Date() : null,
        lockedAt: null,
        lockedById: null,
        errorMessage:
          error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async finishEvent(
    eventId: string,
    patch: Partial<VoucherEvent>,
  ) {
    await this.eventRepository.update({ id: eventId }, {
      ...patch,
      updatedAt: new Date(),
    });
  }

  private buildDrafts(voucher: AccountingVoucher): PostingDraft[] {
    const actorId = voucher.updatedBy ?? voucher.createdBy;
    const drafts: PostingDraft[] = [];
    const items = [...(voucher.items ?? [])].sort(
      (left, right) => left.lineNo - right.lineNo,
    );

    const pushHeader = () => {
      const isAdvice = voucher.voucherType === VoucherType.ADVICE;
      if (
        voucher.voucherType !== VoucherType.RECEIPT &&
        voucher.voucherType !== VoucherType.PAYMENT &&
        !isAdvice
      ) {
        return;
      }
      if (!voucher.headerAccountId) {
        return;
      }
      const amount = toPositiveAmount(voucher.finalAmount);
      if (!amount) {
        return;
      }

      const direction = isAdvice
        ? voucher.headerDirection
        : voucher.voucherType === VoucherType.RECEIPT
          ? VoucherEntryDirection.DEBIT
          : VoucherEntryDirection.CREDIT;
      if (!direction) {
        return;
      }

      const otherBranchId =
        voucher.adviceRole === VoucherAdviceRole.HONOUR
          ? (voucher.sourceBranchId ?? null)
          : (voucher.destinationBranchId ?? null);
      const otherBranchSnapshot =
        voucher.adviceRole === VoucherAdviceRole.HONOUR
          ? (voucher.sourceBranchSnapshot ?? null)
          : (voucher.destinationBranchSnapshot ?? null);

      drafts.push({
        voucherId: voucher.id,
        createdBy: actorId,
        updatedBy: actorId,
        sourceType: VoucherPostingSourceType.HEADER,
        sourceId: voucher.id,
        transactionId: null,
        transactionSnapshot: null,
        accountId: voucher.headerAccountId,
        accountSnapshot: voucher.headerAccountSnapshot ?? null,
        profileId: isAdvice ? otherBranchId : null,
        profileSnapshot: isAdvice ? otherBranchSnapshot : null,
        direction,
        amount,
        remarks: voucher.narration || null,
      });
    };

    pushHeader();

    for (const item of items) {
      const amount = toPositiveAmount(item.amount);
      if (!amount) {
        continue;
      }
      if (!item.accountId) {
        throw new Error(
          `Voucher item ${item.id} is missing accountId for posting`,
        );
      }

      const transactionId = item.settledTransactionId ?? null;
      const isBillLine = Boolean(transactionId);
      const profileId = isBillLine
        ? (voucher.partyProfileId ?? null)
        : (item.subledgerPartyProfileId ?? null);
      const profileSnapshot = isBillLine
        ? (voucher.partyProfileSnapshot ?? null)
        : (item.subledgerPartyProfileSnapshot ?? null);

      drafts.push({
        voucherId: voucher.id,
        createdBy: actorId,
        updatedBy: actorId,
        sourceType: VoucherPostingSourceType.ITEM,
        sourceId: item.id,
        transactionId,
        transactionSnapshot: transactionId
          ? (item.settledTransactionSnapshot ?? null)
          : null,
        accountId: item.accountId,
        accountSnapshot: item.accountSnapshot ?? null,
        profileId,
        profileSnapshot: profileId ? profileSnapshot : null,
        direction: item.direction,
        amount,
        remarks: null,
      });
    }

    return drafts;
  }

  private async rebuildVoucher(voucher: AccountingVoucher) {
    const drafts = this.buildDrafts(voucher);
    const finalPostings = drafts.map((draft, index) => ({
      ...draft,
      lineNo: index + 1,
    }));

    await this.database2.transaction(async (manager) => {
      const postingRepo = manager.getRepository(VoucherAccountPosting);

      await manager.query(
        `SELECT set_config('${SKIP_ENQUEUE_GUC}', 'true', true)`,
      );

      await postingRepo.delete({ voucherId: voucher.id });

      if (finalPostings.length > 0) {
        await postingRepo.save(finalPostings);
      }
    });
  }
}
