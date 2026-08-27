import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { Flm3PurchaseFromPublicQueryDto } from "./dto/flm3-purchase-from-public-query.dto";
import {
  buildFlm3PurchaseFromPublic,
  buildFlm3PurchaseFromPublicExport,
  loadFlm3ItemRows,
  loadFlm3OtherDocumentRows,
  loadFlm3PaymentRows,
  resolveFlm3DateRange,
  type Flm3BuildOptions,
} from "./flm3-purchase-from-public.helpers";
import {
  canSeeAllFlmBranches,
  loadFlmSelectedBranches,
  resolveFlmAccessibleBranchIds,
} from "./flm-report-access.helpers";
import { Branch } from "../branches/branch.entity";

@Injectable()
export class Flm3PurchaseFromPublicService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async buildReport(
    query: Flm3PurchaseFromPublicQueryDto,
    session?: SessionContext,
  ) {
    const { startDate, endDateExclusive } = resolveFlm3DateRange(
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
      return buildFlm3PurchaseFromPublic([], [], [], query.view, buildOptions);
    }

    const itemRows = await loadFlm3ItemRows(this.database2, {
      startDate,
      endDateExclusive,
      branchIds: resolvedBranchIds,
      productId: query.productId,
    });
    const transactionIds = [
      ...new Set(itemRows.map((row) => row.transactionId)),
    ];
    const [paymentRows, otherDocumentRows] = await Promise.all([
      loadFlm3PaymentRows(this.database2, transactionIds),
      loadFlm3OtherDocumentRows(this.database2, transactionIds),
    ]);

    return buildFlm3PurchaseFromPublic(
      itemRows,
      paymentRows,
      otherDocumentRows,
      query.view,
      buildOptions,
    );
  }

  async buildExport(
    query: Flm3PurchaseFromPublicQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    return buildFlm3PurchaseFromPublicExport(report, format);
  }
}
