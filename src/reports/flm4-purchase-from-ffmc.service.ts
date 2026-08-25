import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { Flm4PurchaseFromFfmcQueryDto } from "./dto/flm4-purchase-from-ffmc-query.dto";
import {
  buildFlm4PurchaseFromFfmc,
  buildFlm4PurchaseFromFfmcExport,
  loadFlm4ItemRows,
  loadFlm4OtherDocumentRows,
  loadFlm4PaymentRows,
  resolveFlm4DateRange,
} from "./flm4-purchase-from-ffmc.helpers";

@Injectable()
export class Flm4PurchaseFromFfmcService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async buildReport(
    query: Flm4PurchaseFromFfmcQueryDto,
    session?: SessionContext,
  ) {
    const { startDate, endDateExclusive } = resolveFlm4DateRange(
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
      return buildFlm4PurchaseFromFfmc([], [], [], query.view);
    }

    const itemRows = await loadFlm4ItemRows(this.database2, {
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
      loadFlm4PaymentRows(this.database2, transactionIds),
      loadFlm4OtherDocumentRows(this.database2, transactionIds),
    ]);

    return buildFlm4PurchaseFromFfmc(
      itemRows,
      paymentRows,
      otherDocumentRows,
      query.view,
    );
  }

  async buildExport(
    query: Flm4PurchaseFromFfmcQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    return buildFlm4PurchaseFromFfmcExport(report, format);
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
