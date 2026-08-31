import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Branch } from "../branches/branch.entity";
import { MonthlyLocksService } from "../monthly-locks/monthly-locks.service";
import { SessionContext } from "../auth/types/session-context";
import { UserRole } from "../user-roles/user-role.entity";
import {
  CreateTransactionDataLocksDto,
  CreateTransactionDataLocksResultDto,
  TransactionDataLockResponseDto,
} from "./dto/transaction-data-lock.dto";
import { TransactionDataLock } from "./entities/transaction-data-lock.entity";
import {
  getEarliestAllowedPunchDate,
  normalizeDateOnly,
} from "./transaction-data-lock.utils";

@Injectable()
export class TransactionDataLocksService {
  constructor(
    @InjectRepository(TransactionDataLock, "database2")
    private readonly lockRepository: Repository<TransactionDataLock>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    private readonly monthlyLocksService: MonthlyLocksService,
  ) {}

  async getActiveLockForBranch(
    branchId: string,
  ): Promise<TransactionDataLockResponseDto | null> {
    const lock = await this.lockRepository.findOne({
      where: { branchId },
    });
    if (!lock) {
      return null;
    }
    return this.toResponse(lock);
  }

  async createOrAdvanceLocks(
    dto: CreateTransactionDataLocksDto,
    session: SessionContext,
    maxAllowedBusinessDate: string,
  ): Promise<CreateTransactionDataLocksResultDto> {
    const lockedThroughDate = normalizeDateOnly(dto.lockedThroughDate);
    const reportStartDate =
      normalizeDateOnly(dto.reportStartDate ?? null) || null;
    const reportEndDate =
      normalizeDateOnly(dto.reportEndDate ?? dto.lockedThroughDate) ||
      lockedThroughDate;
    const maxDate = normalizeDateOnly(maxAllowedBusinessDate);
    const actorUserId = session.userId;

    if (!lockedThroughDate) {
      throw new BadRequestException("Lock date is required");
    }
    if (!maxDate) {
      throw new BadRequestException(
        "Business date is required to create a data lock",
      );
    }
    if (lockedThroughDate > maxDate) {
      throw new BadRequestException(
        `Lock date cannot be after the current transaction date (${maxDate})`,
      );
    }

    const accessibleBranchIds = await this.resolveAccessibleBranchIds(
      dto.branchIds,
      session,
    );
    if (!accessibleBranchIds.length) {
      throw new BadRequestException(
        "No accessible branches selected for data lock",
      );
    }

    const branches = await this.branchRepository.find({
      where: { id: In(accessibleBranchIds) },
      select: ["id", "name", "code"],
    });
    const branchNameById = new Map(
      branches.map((branch) => [
        branch.id,
        branch.code && branch.name
          ? `${branch.code} - ${branch.name}`
          : branch.name || branch.code || branch.id,
      ]),
    );

    const missing = accessibleBranchIds.filter((id) => !branchNameById.has(id));
    if (missing.length) {
      throw new NotFoundException(`Branch not found: ${missing[0]}`);
    }

    const existingLocks = await this.lockRepository.find({
      where: { branchId: In(accessibleBranchIds) },
    });
    const existingByBranch = new Map(
      existingLocks.map((lock) => [lock.branchId, lock]),
    );
    const earliestAllowed = getEarliestAllowedPunchDate(lockedThroughDate);
    const results: TransactionDataLockResponseDto[] = [];

    for (const branchId of accessibleBranchIds) {
      const existing = existingByBranch.get(branchId);
      if (!existing) {
        const created = await this.lockRepository.save(
          this.lockRepository.create({
            branchId,
            lockedThroughDate,
            lockedAt: new Date(),
            lockedBy: actorUserId,
            reportStartDate,
            reportEndDate,
            createdBy: actorUserId,
            updatedBy: actorUserId,
          }),
        );
        await this.monthlyLocksService.applyDataLockToBranchWindows(
          branchId,
          earliestAllowed,
          actorUserId,
        );
        results.push({
          ...this.toResponse(created, branchNameById.get(branchId)),
          status: "created",
          message: `Locked through ${lockedThroughDate}`,
        });
        continue;
      }

      if (lockedThroughDate < existing.lockedThroughDate) {
        results.push({
          ...this.toResponse(existing, branchNameById.get(branchId)),
          status: "skipped",
          message: `Already locked through ${existing.lockedThroughDate}; cannot move lock earlier`,
        });
        continue;
      }

      if (lockedThroughDate === existing.lockedThroughDate) {
        results.push({
          ...this.toResponse(existing, branchNameById.get(branchId)),
          status: "unchanged",
          message: `Already locked through ${existing.lockedThroughDate}`,
        });
        continue;
      }

      existing.lockedThroughDate = lockedThroughDate;
      existing.lockedAt = new Date();
      existing.lockedBy = actorUserId;
      existing.reportStartDate = reportStartDate;
      existing.reportEndDate = reportEndDate;
      existing.updatedBy = actorUserId;
      const advanced = await this.lockRepository.save(existing);
      await this.monthlyLocksService.applyDataLockToBranchWindows(
        branchId,
        earliestAllowed,
        actorUserId,
      );
      results.push({
        ...this.toResponse(advanced, branchNameById.get(branchId)),
        status: "advanced",
        message: `Lock advanced to ${lockedThroughDate}`,
      });
    }

    return { results };
  }

  private async resolveAccessibleBranchIds(
    requestedBranchIds: string[],
    session: SessionContext,
  ) {
    const uniqueRequested = [...new Set(requestedBranchIds.filter(Boolean))];
    if (session.isAdmin || session.isHo || session.isHoStaff) {
      return uniqueRequested;
    }

    const assignedBranchIds = await this.loadAssignedBranchIds(session.userId);
    const assignedSet = new Set(assignedBranchIds);
    return uniqueRequested.filter((branchId) => assignedSet.has(branchId));
  }

  private async loadAssignedBranchIds(userId?: string | null) {
    if (!userId) {
      return [];
    }

    const assignments = await this.userRoleRepository.find({
      where: { user: { id: userId } },
      relations: { branch: true },
    });

    return [
      ...new Set(
        assignments
          .map((assignment) => assignment.branch?.id)
          .filter((branchId): branchId is string => Boolean(branchId)),
      ),
    ];
  }

  private toResponse(
    lock: TransactionDataLock,
    branchName?: string | null,
  ): TransactionDataLockResponseDto {
    return {
      id: lock.id,
      branchId: lock.branchId,
      branchName: branchName ?? null,
      lockedThroughDate: normalizeDateOnly(lock.lockedThroughDate),
      lockedAt:
        lock.lockedAt instanceof Date
          ? lock.lockedAt.toISOString()
          : String(lock.lockedAt),
      lockedBy: lock.lockedBy,
      reportStartDate: lock.reportStartDate
        ? normalizeDateOnly(lock.reportStartDate)
        : null,
      reportEndDate: lock.reportEndDate
        ? normalizeDateOnly(lock.reportEndDate)
        : null,
    };
  }
}
