import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { AdvancedSetting } from "../additional-settings/advanced-setting.entity";
import { MonthlyLocksService } from "../monthly-locks/monthly-locks.service";
import { DayEndExecution, DayEndExecutionStatus } from "./entities/day-end-execution.entity";
import {
  CompleteDayEndDto,
  DayEndStartProcessContextDto,
  PolicyChecklistItemDto,
} from "./dto/day-end-start-process.dto";

type SessionContext = {
  userId?: string | null;
  activeBranchId?: string | null;
  activeCounterId?: string | null;
};

const POLICY_CATEGORY_CODE = "DAY_END_POLICY";

const normalizeDateOnly = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

@Injectable()
export class DayEndStartProcessService {
  constructor(
    @InjectRepository(DayEndExecution, "database2")
    private readonly dayEndExecutionRepository: Repository<DayEndExecution>,
    private readonly additionalSettingService: AdditionalSettingService,
    private readonly monthlyLocksService: MonthlyLocksService,
  ) {}

  private assertSessionContext(session: SessionContext, requireCounter = true) {
    const userId = session.userId?.trim();
    const branchId = session.activeBranchId?.trim();
    const counterId = session.activeCounterId?.trim();

    if (!userId) {
      throw new BadRequestException("User session not found");
    }

    if (!branchId) {
      throw new BadRequestException("Active branch is required");
    }

    if (requireCounter && !counterId) {
      throw new BadRequestException("Active counter is required");
    }

    return { userId, branchId, counterId: counterId ?? "" };
  }

  private getTodayBusinessDate(reference = new Date()): string {
    return normalizeDateOnly(reference);
  }

  private async getPolicyChecklist(): Promise<PolicyChecklistItemDto[]> {
    const categories = await this.additionalSettingService.findAll();
    const category = categories.find(
      item => String(item.code ?? "").trim().toUpperCase() === POLICY_CATEGORY_CODE,
    );

    return (
      category?.children?.map(child => ({
        code: String(child.code ?? ""),
        label: String(child.label ?? child.description ?? child.code ?? ""),
        valueType: String(child.valueType ?? "text"),
        required: Boolean(child.isActive),
      })) ?? []
    );
  }

  private async findLatestExecution(branchId: string, userId: string) {
    return this.dayEndExecutionRepository.findOne({
      where: { branchId, userId },
      order: { businessDate: "DESC", createdAt: "DESC" },
    });
  }

  private async findExecution(branchId: string, userId: string, businessDate: string) {
    return this.dayEndExecutionRepository.findOne({
      where: { branchId, userId, businessDate },
    });
  }

  private async upsertBodRow(
    branchId: string,
    userId: string,
    businessDate: string,
    actorUserId: string,
    answers: Record<string, unknown>,
  ) {
    let row = await this.findExecution(branchId, userId, businessDate);

    if (!row) {
      row = this.dayEndExecutionRepository.create({
        branchId,
        userId,
        businessDate,
        bodAt: new Date(),
        eodAt: null,
        status: DayEndExecutionStatus.BOD_COMPLETED,
        checklistSnapshot: answers ?? {},
        createdBy: actorUserId,
        updatedBy: actorUserId,
      });
      return this.dayEndExecutionRepository.save(row);
    }

    if (!row.bodAt) {
      row.bodAt = new Date();
      row.status = DayEndExecutionStatus.BOD_COMPLETED;
      row.checklistSnapshot = answers ?? row.checklistSnapshot ?? {};
      row.updatedBy = actorUserId;
      row = await this.dayEndExecutionRepository.save(row);
      return row;
    }

    if (answers && Object.keys(answers).length > 0) {
      row.checklistSnapshot = answers;
      row.updatedBy = actorUserId;
      row = await this.dayEndExecutionRepository.save(row);
    }

    return row;
  }

  async getDayEndContext(
    session: SessionContext,
    requireCounter = true,
  ): Promise<DayEndStartProcessContextDto> {
    const { userId, branchId, counterId } = this.assertSessionContext(session, requireCounter);
    const today = this.getTodayBusinessDate();
    const latestExecution = await this.findLatestExecution(branchId, userId);
    const incompleteEod = Boolean(latestExecution && !latestExecution.eodAt);
    const currentBusinessDate = incompleteEod ? latestExecution!.businessDate : today;
    const activeMonthlyLock = await this.monthlyLocksService.getActiveMonthlyLock(branchId, userId);

    return {
      userId,
      branchId,
      counterId,
      currentBusinessDate,
      transactionDate: currentBusinessDate,
      eodIncomplete: incompleteEod,
      bodCompleted: Boolean(latestExecution?.bodAt),
      activeMonthlyLock,
      activeBackdateWindow: activeMonthlyLock,
      checklist: await this.getPolicyChecklist(),
    };
  }

  async getPolicyContext(session: SessionContext) {
    return this.getDayEndContext(session);
  }

  async assertTransactionDateAllowed(
    branchId: string,
    userId: string,
    transactionDate: Date | string | null | undefined,
  ): Promise<{ allowedDate: string; context: DayEndStartProcessContextDto }> {
    const context = await this.getDayEndContext(
      { userId, activeBranchId: branchId },
      false,
    );
    const allowedDate = context.transactionDate;

    if (!context.bodCompleted) {
      throw new BadRequestException(
        'Day start is required before punching transactions',
      );
    }

    if (!transactionDate) {
      return { allowedDate, context };
    }

    const requestedDate = normalizeDateOnly(transactionDate);
    if (!requestedDate) {
      throw new BadRequestException("Transaction date is invalid");
    }

    if (requestedDate > this.getTodayBusinessDate()) {
      throw new BadRequestException("Transaction date cannot be in the future");
    }

    if (context.eodIncomplete && requestedDate !== context.currentBusinessDate) {
      throw new BadRequestException(
        `EOD is pending for this branch/user. Allowed transaction date is ${context.currentBusinessDate}`,
      );
    }

    const activeWindow = context.activeMonthlyLock;
    if (activeWindow) {
      if (requestedDate < activeWindow.fromDate || requestedDate > activeWindow.toDate) {
        throw new BadRequestException(
          `Transaction date must be between ${activeWindow.fromDate} and ${activeWindow.toDate}`,
        );
      }
      return { allowedDate, context };
    }

    if (requestedDate !== allowedDate) {
      throw new BadRequestException(
        `Transaction date must be ${allowedDate} unless a monthly lock is active`,
      );
    }

    return { allowedDate, context };
  }

  async completeDayEnd(
    branchId: string,
    userId: string,
    answers: Record<string, unknown>,
    actorUserId: string,
  ) {
    const { branchId: resolvedBranchId, userId: resolvedUserId } = this.assertSessionContext({
      activeBranchId: branchId,
      userId,
      activeCounterId: null,
    }, false);
    const latest = await this.findLatestExecution(resolvedBranchId, resolvedUserId);
    const today = this.getTodayBusinessDate();
    const businessDate = latest && !latest.eodAt ? latest.businessDate : today;
    const row = await this.findExecution(resolvedBranchId, resolvedUserId, businessDate);

    if (!row || !row.bodAt) {
      throw new BadRequestException('Day start is required before completing day end');
    }

    row.eodAt = new Date();
    row.status = DayEndExecutionStatus.EOD_COMPLETED;
    row.checklistSnapshot = answers ?? {};
    row.updatedBy = actorUserId;
    return this.dayEndExecutionRepository.save(row);
  }

  async startDay(
    branchId: string,
    userId: string,
    answers: Record<string, unknown>,
    actorUserId: string,
  ) {
    const { branchId: resolvedBranchId, userId: resolvedUserId } = this.assertSessionContext({
      activeBranchId: branchId,
      userId,
      activeCounterId: null,
    }, false);
    const latest = await this.findLatestExecution(resolvedBranchId, resolvedUserId);
    const today = this.getTodayBusinessDate();
    const businessDate = latest && !latest.eodAt ? latest.businessDate : today;

    return this.upsertBodRow(resolvedBranchId, resolvedUserId, businessDate, actorUserId, answers ?? {});
  }
}
