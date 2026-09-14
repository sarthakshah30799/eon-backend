import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { DataSource, Repository } from "typeorm";
import { PartyProfile } from "../party-profiles/party-profile.entity";
import {
  DAY_END_POST_PROCESS_EVENT_TYPES,
  DayEndEventStatus,
  DayEndEventType,
} from "./day-end-process.enums";
import { DayEndEvent } from "./entities/day-end-event.entity";

const RETRY_DELAY_MS = 30_000;
const MAX_ATTEMPTS = 10;

type ClaimedDayEndEventRow = {
  id: string;
  day_end_execution_id: string;
  branch_id: string;
  business_date: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: DayEndEventStatus;
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

type DayEndEventPayload = {
  dayEndExecutionId?: string;
  branchId?: string;
  businessDate?: string;
  actorUserId?: string;
};

@Injectable()
export class DayEndProcessWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DayEndProcessWorker.name);
  private readonly workerId = randomUUID();
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(DayEndEvent, "database2")
    private readonly dayEndEventRepository: Repository<DayEndEvent>,
    @InjectRepository(PartyProfile)
    private readonly partyProfileRepository: Repository<PartyProfile>,
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
        "Day end process worker failed",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async claimPendingEvents(limit: number): Promise<DayEndEvent[]> {
    return this.database2.transaction(async (manager) => {
      const rows = (await manager.query(
        `
          SELECT *
          FROM day_end_events
          WHERE event_type = ANY($1::text[])
            AND status = $2
            AND available_at <= now()
            AND deleted_at IS NULL
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $3
        `,
        [
          DAY_END_POST_PROCESS_EVENT_TYPES,
          DayEndEventStatus.PENDING,
          limit,
        ],
      )) as ClaimedDayEndEventRow[];

      if (!rows.length) {
        return [];
      }

      await manager.query(
        `
          UPDATE day_end_events
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
          DayEndEventStatus.PROCESSING,
          this.workerId,
        ],
      );

      return rows.map((row) =>
        this.dayEndEventRepository.create({
          id: row.id,
          dayEndExecutionId: row.day_end_execution_id,
          branchId: row.branch_id,
          businessDate: row.business_date,
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

  private async processEvent(event: DayEndEvent) {
    try {
      switch (event.eventType) {
        case DayEndEventType.CLEAR_TEMPORARY_CREDIT:
          await this.clearTemporaryCredit(event);
          break;
        default:
          throw new Error(`Unsupported day end event type: ${event.eventType}`);
      }

      await this.finishEvent(event.id, {
        status: DayEndEventStatus.PROCESSED,
        processedAt: new Date(),
        lockedAt: null,
        lockedById: null,
        errorMessage: null,
      });
    } catch (error) {
      this.logger.error(
        `Failed to process day end event ${event.id} (${event.eventType})`,
        error instanceof Error ? error.stack : String(error),
      );

      const nextAttempt = Math.max(1, event.attemptCount + 1);
      const shouldFailPermanently = nextAttempt >= MAX_ATTEMPTS;

      await this.finishEvent(event.id, {
        status: shouldFailPermanently
          ? DayEndEventStatus.FAILED
          : DayEndEventStatus.PENDING,
        availableAt: shouldFailPermanently
          ? event.availableAt
          : new Date(Date.now() + RETRY_DELAY_MS),
        processedAt: shouldFailPermanently ? new Date() : null,
        lockedAt: null,
        lockedById: null,
        errorMessage:
          error instanceof Error ? error.message : "Unknown day end process failure",
      });
    }
  }

  private async clearTemporaryCredit(event: DayEndEvent) {
    const payload = (event.payload ?? {}) as DayEndEventPayload;
    const branchId = String(payload.branchId ?? event.branchId ?? "").trim();
    const actorUserId = String(
      payload.actorUserId ?? event.updatedBy ?? event.createdBy ?? "",
    ).trim();

    if (!branchId) {
      throw new Error(
        "Day end clear-temporary-credit payload is missing branchId",
      );
    }

    if (!actorUserId) {
      throw new Error(
        "Day end clear-temporary-credit payload is missing actorUserId",
      );
    }

    await this.partyProfileRepository
      .createQueryBuilder()
      .update(PartyProfile)
      .set({
        temporaryCreditLimit: () => "NULL",
        temporaryCreditDays: () => "NULL",
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where("branch_id = :branchId", { branchId })
      .andWhere(
        "(temporary_credit_limit IS NOT NULL OR temporary_credit_days IS NOT NULL)",
      )
      .andWhere("deleted_at IS NULL")
      .execute();
  }

  private async finishEvent(
    eventId: string,
    changes: Partial<
      Pick<
        DayEndEvent,
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
      await manager.getRepository(DayEndEvent).update(
        { id: eventId },
        {
          ...(changes.status ? { status: changes.status } : {}),
          ...(changes.processedAt !== undefined
            ? { processedAt: changes.processedAt }
            : {}),
          ...(changes.availableAt !== undefined
            ? { availableAt: changes.availableAt }
            : {}),
          ...(changes.lockedAt !== undefined
            ? { lockedAt: changes.lockedAt }
            : {}),
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
}
