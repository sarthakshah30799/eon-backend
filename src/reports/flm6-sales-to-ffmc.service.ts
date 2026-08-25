import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { Flm6SalesToFfmcQueryDto } from "./dto/flm6-sales-to-ffmc-query.dto";
import {
  buildFlm6SalesToFfmc,
  buildFlm6SalesToFfmcExport,
  loadFlm6ItemRows,
  loadFlm6OtherDocumentRows,
  loadFlm6PaymentRows,
  resolveFlm6DateRange,
} from "./flm6-sales-to-ffmc.helpers";

@Injectable()
export class Flm6SalesToFfmcService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async buildReport(
    query: Flm6SalesToFfmcQueryDto,
    session?: SessionContext,
  ) {
    const { startDate, endDateExclusive } = resolveFlm6DateRange(
      query.startDate,
      query.endDate,
    );
    const resolvedBranchIds = await this.resolveAccessibleBranchIds(
      query.branchIds ?? [],
      session,
    );
    const hasNoBranchAccess =
      !this.canSeeAllBranches(session) && resolvedBranchIds.length === 0;

    if (hasNoBranchAccess) {
      return buildFlm6SalesToFfmc([], [], [], query.view);
    }

    const itemRows = await loadFlm6ItemRows(this.database2, {
      startDate,
      endDateExclusive,
      branchIds: resolvedBranchIds,
      productId: query.productId,
      profileTypes: query.profileTypes,
    });
    const transactionIds = [
      ...new Set(itemRows.map((row) => row.transactionId)),
    ];
    const [paymentRows, otherDocumentRows] = await Promise.all([
      loadFlm6PaymentRows(this.database2, transactionIds),
      loadFlm6OtherDocumentRows(this.database2, transactionIds),
    ]);

    return buildFlm6SalesToFfmc(
      itemRows,
      paymentRows,
      otherDocumentRows,
      query.view,
    );
  }

  async buildExport(
    query: Flm6SalesToFfmcQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    return buildFlm6SalesToFfmcExport(report, format);
  }

  private canSeeAllBranches(session?: SessionContext) {
    return Boolean(session?.isAdmin || session?.isHo || session?.isHoStaff);
  }

  private async resolveAccessibleBranchIds(
    requestedBranchIds: string[],
    session?: SessionContext,
  ) {
    if (this.canSeeAllBranches(session)) {
      return requestedBranchIds;
    }

    const assignedBranchIds = await this.loadAssignedBranchIds(session?.userId);
    if (!assignedBranchIds.length) {
      return [];
    }

    if (!requestedBranchIds.length) {
      return assignedBranchIds;
    }

    const assignedBranchIdSet = new Set(assignedBranchIds);
    return requestedBranchIds.filter((branchId) =>
      assignedBranchIdSet.has(branchId),
    );
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
}
