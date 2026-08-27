import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
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
import type { Flm3BuildOptions } from "./flm3-purchase-from-public.helpers";
import {
  canSeeAllFlmBranches,
  loadFlmSelectedBranches,
  resolveFlmAccessibleBranchIds,
} from "./flm-report-access.helpers";

@Injectable()
export class Flm4PurchaseFromFfmcService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
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
      return buildFlm4PurchaseFromFfmc([], [], [], query.view, buildOptions);
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
      buildOptions,
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
}
