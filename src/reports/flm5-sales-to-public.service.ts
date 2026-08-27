import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { Flm5SalesToPublicQueryDto } from "./dto/flm5-sales-to-public-query.dto";
import type { Flm3BuildOptions } from "./flm3-purchase-from-public.helpers";
import {
  buildFlm5SalesToPublic,
  buildFlm5SalesToPublicExport,
  loadFlm5ItemRows,
  loadFlm5OtherDocumentRows,
  loadFlm5PaymentRows,
  resolveFlm5DateRange,
} from "./flm5-sales-to-public.helpers";
import {
  canSeeAllFlmBranches,
  loadFlmSelectedBranches,
  resolveFlmAccessibleBranchIds,
} from "./flm-report-access.helpers";

@Injectable()
export class Flm5SalesToPublicService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
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
    const resolvedBranchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );
    const hasNoBranchAccess =
      !canSeeAllFlmBranches(session) && resolvedBranchIds.length === 0;
    const buildOptions: Flm3BuildOptions = {
      layout: query.layout,
      selectedBranches: await loadFlmSelectedBranches(
        this.branchRepository,
        resolvedBranchIds,
      ),
    };

    if (hasNoBranchAccess) {
      return buildFlm5SalesToPublic([], [], [], query.view, buildOptions);
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
      buildOptions,
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
}
