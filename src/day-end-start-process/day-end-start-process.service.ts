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

const parseDateOnly = (value: string | null | undefined): Date | undefined => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = new Date(`${normalized.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const formatDateOnly = (date: Date): string => normalizeDateOnly(date);

const clampDate = (date: Date, min?: Date, max?: Date): Date => {
  if (min && date < min) {
    return min;
  }

  if (max && date > max) {
    return max;
  }

  return date;
};

@Injectable()
export class DayEndStartProcessService {
  constructor(
    @InjectRepository(DayEndExecution, "database2")
    private readonly dayEndExecutionRepository: Repository<DayEndExecution>,
    private readonly additionalSettingService: AdditionalSettingService,
    private readonly monthlyLocksService: MonthlyLocksService,
  ) {}

  private assertSessionContext(session: SessionContext, requireCounter = false) {
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

  private async findLatestExecution(branchId: string) {
    return this.dayEndExecutionRepository.findOne({
      where: { branchId },
      order: { businessDate: "DESC", createdAt: "DESC" },
    });
  }

  private async findExecution(branchId: string, businessDate: string) {
    return this.dayEndExecutionRepository.findOne({
      where: { branchId, businessDate },
    });
  }

  private getWorkflowStateForExecution(
    today: string,
    todayExecution: DayEndExecution | null,
    latestExecution: DayEndExecution | null,
  ) {
    const openExecution =
      todayExecution && !todayExecution.eodAt
        ? todayExecution
        : latestExecution && !latestExecution.eodAt
          ? latestExecution
          : null;

    if (todayExecution?.bodAt && todayExecution.eodAt) {
      return {
        workflowState: "CLOSED_TODAY",
        openExecution,
        canStartDay: false,
        canCompleteDayEnd: false,
        openBusinessDate: todayExecution.businessDate,
        currentBusinessDate: today,
        eodIncomplete: false,
        bodCompleted: true,
      };
    }

    if (todayExecution && !todayExecution.bodAt) {
      return {
        workflowState: "PENDING_BOD",
        openExecution,
        canStartDay: true,
        canCompleteDayEnd: false,
        openBusinessDate: todayExecution.businessDate,
        currentBusinessDate: today,
        eodIncomplete: false,
        bodCompleted: false,
      };
    }

    if (todayExecution?.bodAt && !todayExecution.eodAt) {
      return {
        workflowState: "PENDING_EOD",
        openExecution,
        canStartDay: false,
        canCompleteDayEnd: true,
        openBusinessDate: todayExecution.businessDate,
        currentBusinessDate: todayExecution.businessDate,
        eodIncomplete: true,
        bodCompleted: true,
      };
    }

    if (latestExecution && !latestExecution.eodAt) {
      return {
        workflowState: latestExecution.bodAt ? "PENDING_EOD" : "PENDING_BOD",
        openExecution,
        canStartDay: false,
        canCompleteDayEnd: Boolean(latestExecution.bodAt),
        openBusinessDate: latestExecution.businessDate,
        currentBusinessDate: latestExecution.businessDate,
        eodIncomplete: Boolean(latestExecution.bodAt),
        bodCompleted: Boolean(latestExecution.bodAt),
      };
    }

    return {
      workflowState: "READY_TO_START",
      openExecution,
      canStartDay: true,
      canCompleteDayEnd: false,
      openBusinessDate: today,
      currentBusinessDate: today,
      eodIncomplete: false,
      bodCompleted: false,
    };
  }

  private resolveSuggestedTransactionDate(
    currentBusinessDate: string,
    activeMonthlyLock: { fromDate: string; toDate: string } | null,
  ): string {
    const currentDate = parseDateOnly(currentBusinessDate);
    if (!currentDate) {
      return currentBusinessDate;
    }

    if (!activeMonthlyLock) {
      return currentBusinessDate;
    }

    const minDate = parseDateOnly(activeMonthlyLock.fromDate);
    const maxDate = parseDateOnly(activeMonthlyLock.toDate);
    return formatDateOnly(clampDate(currentDate, minDate, maxDate));
  }

  private async upsertBodRow(
    branchId: string,
    businessDate: string,
    actorUserId: string,
    answers: Record<string, unknown>,
  ) {
    let row = await this.findExecution(branchId, businessDate);

    if (!row) {
      row = this.dayEndExecutionRepository.create({
        branchId,
        userId: actorUserId,
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
    const { userId, branchId, counterId } = this.assertSessionContext(session, false);
    const today = this.getTodayBusinessDate();
    const todayExecution = await this.findExecution(branchId, today);
    const latestExecution = await this.findLatestExecution(branchId);
    const workflow = this.getWorkflowStateForExecution(today, todayExecution, latestExecution);
    const activeMonthlyLock = await this.monthlyLocksService.getActiveMonthlyLock(branchId, userId);
    const suggestedTransactionDate = this.resolveSuggestedTransactionDate(
      workflow.currentBusinessDate,
      activeMonthlyLock,
    );

    return {
      userId,
      branchId,
      counterId,
      currentBusinessDate: workflow.currentBusinessDate,
      transactionDate: suggestedTransactionDate,
      eodIncomplete: workflow.eodIncomplete,
      bodCompleted: workflow.bodCompleted,
      canStartDay: workflow.canStartDay,
      canCompleteDayEnd: workflow.canCompleteDayEnd,
      openBusinessDate: workflow.openBusinessDate,
      workflowState: workflow.workflowState,
      activeMonthlyLock,
      activeBackdateWindow: activeMonthlyLock,
      checklist: await this.getPolicyChecklist(),
    };
  }

  async getPolicyContext(session: SessionContext, requireCounter = true) {
    return this.getDayEndContext(session, requireCounter);
  }

  async assertTransactionDateAllowed(
    branchId: string,
    userId: string,
    transactionDate: Date | string | null | undefined,
    counterId?: string | null,
  ): Promise<{ allowedDate: string; context: DayEndStartProcessContextDto }> {
    const context = await this.getDayEndContext(
      { userId, activeBranchId: branchId, activeCounterId: counterId },
      false,
    );
    const allowedDate = context.transactionDate;
    const activeWindow = context.activeMonthlyLock;
    const hasMonthlyLockOverride = Boolean(activeWindow);

    if (!transactionDate) {
      if (hasMonthlyLockOverride || context.workflowState === "PENDING_EOD") {
        return { allowedDate, context };
      }

      if (context.workflowState === "CLOSED_TODAY") {
        throw new BadRequestException(
          `Day end is already completed for ${context.openBusinessDate}`,
        );
      }

      throw new BadRequestException(
        'Day start is required before punching transactions',
      );
    }

    const requestedDate = normalizeDateOnly(transactionDate);
    if (!requestedDate) {
      throw new BadRequestException("Transaction date is invalid");
    }

    if (requestedDate > this.getTodayBusinessDate()) {
      throw new BadRequestException("Transaction date cannot be in the future");
    }

    if (hasMonthlyLockOverride) {
      if (requestedDate < activeWindow.fromDate || requestedDate > activeWindow.toDate) {
        throw new BadRequestException(
          `Transaction date must be between ${activeWindow.fromDate} and ${activeWindow.toDate}`,
        );
      }
      return { allowedDate, context };
    }

    if (context.workflowState === "CLOSED_TODAY") {
      throw new BadRequestException(
        `Day end is already completed for ${context.openBusinessDate}`,
      );
    }

    if (context.workflowState === "PENDING_BOD" || context.workflowState === "READY_TO_START") {
      throw new BadRequestException(
        'Day start is required before punching transactions',
      );
    }

    if (context.workflowState === "PENDING_EOD" && requestedDate !== context.openBusinessDate) {
      throw new BadRequestException(
        `EOD is pending for this branch/user. Allowed transaction date is ${context.openBusinessDate}`,
      );
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
    });
    const latest = await this.findLatestExecution(resolvedBranchId);
    const today = this.getTodayBusinessDate();
    const todayExecution = await this.findExecution(resolvedBranchId, today);
    const businessDate = todayExecution && !todayExecution.eodAt
      ? todayExecution.businessDate
      : latest && !latest.eodAt
        ? latest.businessDate
        : today;
    const row = await this.findExecution(resolvedBranchId, businessDate);

    if (!row || !row.bodAt || row.eodAt) {
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
    });
    const latest = await this.findLatestExecution(resolvedBranchId);
    const today = this.getTodayBusinessDate();
    const todayExecution = await this.findExecution(resolvedBranchId, today);

    if (todayExecution?.bodAt && todayExecution.eodAt) {
      throw new BadRequestException(
        `Day end is already completed for ${todayExecution.businessDate}`,
      );
    }

    if (todayExecution?.bodAt && !todayExecution.eodAt) {
      throw new BadRequestException(
        `Day start is already completed for ${todayExecution.businessDate}`,
      );
    }

    if (latest && !latest.eodAt && latest.businessDate !== today) {
      throw new BadRequestException(
        `Complete EOD for ${latest.businessDate} before starting the next day`,
      );
    }

    return this.upsertBodRow(resolvedBranchId, today, actorUserId, answers ?? {});
  }
}
