import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { Flm6SalesToFfmcQueryDto } from "./dto/flm6-sales-to-ffmc-query.dto";
import type { Flm3BuildOptions } from "./flm3-purchase-from-public.helpers";
import {
  buildFlm6SalesToFfmc,
  buildFlm6SalesToFfmcExport,
  loadFlm6ItemRows,
  loadFlm6OtherDocumentRows,
  loadFlm6PaymentRows,
  resolveFlm6DateRange,
} from "./flm6-sales-to-ffmc.helpers";
import {
  canSeeAllFlmBranches,
  loadFlmSelectedBranches,
  resolveFlmAccessibleBranchIds,
} from "./flm-report-access.helpers";

@Injectable()
export class Flm6SalesToFfmcService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async buildReport(query: Flm6SalesToFfmcQueryDto, session?: SessionContext) {
    const { startDate, endDateExclusive } = resolveFlm6DateRange(
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
      return buildFlm6SalesToFfmc([], [], [], query.view, buildOptions);
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
      buildOptions,
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
}
