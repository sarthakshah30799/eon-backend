import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import { Branch } from "../branches/branch.entity";
import { User } from "../users/user.entity";
import {
  CreateMonthlyLocksDto,
  MonthlyLockWindowResponseDto,
} from "./dto/monthly-lock-window.dto";
import { MonthlyLockWindow } from "./entities/monthly-lock-window.entity";

const normalizeDateOnly = (value: Date | string): string => {
  if (typeof value === "string") {
    const isoPrefix = value.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoPrefix)) {
      return isoPrefix;
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  // date columns may arrive as UTC midnight; prefer ISO date prefix when present
  const iso = date.toISOString().slice(0, 10);
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
    return iso;
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

@Injectable()
export class MonthlyLocksService {
  constructor(
    @InjectRepository(MonthlyLockWindow, "database2")
    private readonly monthlyLockWindowRepository: Repository<MonthlyLockWindow>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getActiveMonthlyLock(
    branchId: string,
    userId: string,
  ): Promise<MonthlyLockWindowResponseDto | null> {
    const activeMonthlyLock = await this.monthlyLockWindowRepository.findOne({
      where: { branchId, userId, isActive: true, revokedAt: IsNull() },
      order: { createdAt: "DESC" },
    });

    if (!activeMonthlyLock) {
      return null;
    }

    return this.toResponse(activeMonthlyLock);
  }

  /**
   * Any active monthwise window on the branch (used when HO/Admin posts
   * against a selling branch using another user's backdate window).
   */
  async getActiveMonthlyLockForBranch(
    branchId: string,
  ): Promise<MonthlyLockWindowResponseDto | null> {
    const activeMonthlyLock = await this.monthlyLockWindowRepository.findOne({
      where: { branchId, isActive: true, revokedAt: IsNull() },
      order: { createdAt: "DESC" },
    });

    if (!activeMonthlyLock) {
      return null;
    }

    return this.toResponse(activeMonthlyLock);
  }

  private toResponse(
    activeMonthlyLock: MonthlyLockWindow,
  ): MonthlyLockWindowResponseDto {
    return {
      id: activeMonthlyLock.id,
      branchId: activeMonthlyLock.branchId,
      userId: activeMonthlyLock.userId,
      fromDate: normalizeDateOnly(activeMonthlyLock.fromDate),
      toDate: normalizeDateOnly(activeMonthlyLock.toDate),
      isActive: activeMonthlyLock.isActive,
      revokedAt: activeMonthlyLock.revokedAt,
      revokedBy: activeMonthlyLock.revokedBy,
    };
  }

  async createMonthlyLocks(dto: CreateMonthlyLocksDto, actorUserId: string) {
    const created: MonthlyLockWindow[] = [];

    for (const rule of dto.rules) {
      const fromDate = normalizeDateOnly(rule.fromDate);
      const toDate = normalizeDateOnly(rule.toDate);
      if (fromDate > toDate) {
        throw new BadRequestException(
          "Monthly lock from date cannot be after to date",
        );
      }

      const existing = await this.monthlyLockWindowRepository.findOne({
        where: { branchId: rule.branchId, userId: rule.userId, isActive: true },
      });

      if (existing) {
        existing.fromDate = fromDate;
        existing.toDate = toDate;
        existing.revokedAt = null;
        existing.revokedBy = null;
        existing.updatedBy = actorUserId;
        created.push(await this.monthlyLockWindowRepository.save(existing));
        continue;
      }

      const entity = this.monthlyLockWindowRepository.create({
        branchId: rule.branchId,
        userId: rule.userId,
        fromDate,
        toDate,
        isActive: true,
        revokedAt: null,
        revokedBy: null,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      });
      created.push(await this.monthlyLockWindowRepository.save(entity));
    }

    return created;
  }

  async listMonthlyLocks() {
    const rows = await this.monthlyLockWindowRepository.find({
      order: { createdAt: "DESC" },
    });

    const branchIds = [...new Set(rows.map((row) => row.branchId))];
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const [branches, users] = await Promise.all([
      branchIds.length > 0
        ? this.branchRepository.find({ where: { id: In(branchIds) } })
        : Promise.resolve([]),
      userIds.length > 0
        ? this.userRepository.find({ where: { id: In(userIds) } })
        : Promise.resolve([]),
    ]);
    const branchNameById = new Map(
      branches.map((branch) => [branch.id, branch.name ?? null]),
    );
    const userNameById = new Map(
      users.map((user) => [user.id, user.name ?? null]),
    );

    return rows.map((row) => ({
      id: row.id,
      branchId: row.branchId,
      userId: row.userId,
      branchName: branchNameById.get(row.branchId) ?? null,
      userName: userNameById.get(row.userId) ?? null,
      fromDate: row.fromDate,
      toDate: row.toDate,
      isActive: row.isActive,
      revokedAt: row.revokedAt,
      revokedBy: row.revokedBy,
    }));
  }

  async revokeMonthlyLock(windowId: string, actorUserId: string) {
    const window = await this.monthlyLockWindowRepository.findOne({
      where: { id: windowId },
    });
    if (!window) {
      throw new NotFoundException(`Monthly lock with id ${windowId} not found`);
    }

    window.isActive = false;
    window.revokedAt = new Date();
    window.revokedBy = actorUserId;
    window.updatedBy = actorUserId;
    return this.monthlyLockWindowRepository.save(window);
  }

  async applyDataLockToBranchWindows(
    branchId: string,
    earliestAllowedDate: string,
    actorUserId: string,
  ): Promise<{ raised: number; revoked: number }> {
    const windows = await this.monthlyLockWindowRepository.find({
      where: { branchId, isActive: true },
    });

    let raised = 0;
    let revoked = 0;

    for (const window of windows) {
      let changed = false;
      if (window.fromDate < earliestAllowedDate) {
        window.fromDate = earliestAllowedDate;
        changed = true;
        raised += 1;
      }

      if (window.fromDate > window.toDate) {
        window.isActive = false;
        window.revokedAt = new Date();
        window.revokedBy = actorUserId;
        changed = true;
        revoked += 1;
      }

      if (changed) {
        window.updatedBy = actorUserId;
        await this.monthlyLockWindowRepository.save(window);
      }
    }

    return { raised, revoked };
  }
}
