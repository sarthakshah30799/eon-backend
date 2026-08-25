import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { Flm5SalesToPublicQueryDto } from "./dto/flm5-sales-to-public-query.dto";
import {
  buildFlm5SalesToPublic,
  buildFlm5SalesToPublicExport,
  loadFlm5ItemRows,
  loadFlm5OtherDocumentRows,
  loadFlm5PaymentRows,
  resolveFlm5DateRange,
} from "./flm5-sales-to-public.helpers";

@Injectable()
export class Flm5SalesToPublicService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async buildReport(
    query: Flm5SalesToPublicQueryDto,
    session?: SessionContext,
  ) {
    const { startDate, endDateExclusive } = resolveFlm5DateRange(
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
      return buildFlm5SalesToPublic([], [], [], query.view);
    }

    const itemRows = await loadFlm5ItemRows(this.database2, {
      startDate,
      endDateExclusive,
      branchIds: resolvedBranchIds,
      productId: query.productId,
    });
    const transactionIds = [
      ...new Set(itemRows.map((row) => row.transactionId)),
    ];
    const [paymentRows, otherDocumentRows] = await Promise.all([
      loadFlm5PaymentRows(this.database2, transactionIds),
      loadFlm5OtherDocumentRows(this.database2, transactionIds),
    ]);

    return buildFlm5SalesToPublic(
      itemRows,
      paymentRows,
      otherDocumentRows,
      query.view,
    );
  }

  async buildExport(
    query: Flm5SalesToPublicQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    return buildFlm5SalesToPublicExport(report, format);
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
