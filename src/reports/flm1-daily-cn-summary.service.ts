import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { SessionContext } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { Flm1DailyCnSummaryQueryDto } from "./dto/flm1-daily-cn-summary-query.dto";
import {
  FLM1_CURRENCY_COLUMN_COUNT_CODE,
  FLM1_DEFAULT_CURRENCY_COLUMNS,
  FLM1_MAX_CURRENCY_COLUMNS,
  FLM1_MIN_CURRENCY_COLUMNS,
  FLM1_REPORTS_SETTING_CATEGORY,
} from "./flm1-report.constants";
import {
  buildFlm1DailyCnSummary,
  buildFlm1DailyCnSummaryExport,
  clampCurrencyColumnCount,
  loadFlm1SourceRows,
  resolveFlm1ReportDate,
  type Flm1BranchMeta,
} from "./flm1-daily-cn-summary.helpers";

@Injectable()
export class Flm1DailyCnSummaryService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    private readonly additionalSettingService: AdditionalSettingService,
  ) {}

  async buildReport(query: Flm1DailyCnSummaryQueryDto, session?: SessionContext) {
    const { startDate, endDateExclusive, dateLabel } = resolveFlm1ReportDate(
      query.date,
    );
    const resolvedBranchIds = await this.resolveAccessibleBranchIds(
      query.branchIds ?? [],
      session,
    );
    const currenciesPerBlock = await this.loadCurrencyColumnCount();
    const hasNoBranchAccess =
      !this.canSeeAllBranches(session) && resolvedBranchIds.length === 0;

    if (hasNoBranchAccess) {
      return buildFlm1DailyCnSummary([], {
        dateLabel,
        currenciesPerBlock,
        selectedBranches: [],
      });
    }

    const selectedBranches = await this.loadSelectedBranches(resolvedBranchIds);
    const sourceRows = await loadFlm1SourceRows(this.database2, {
      startDate,
      endDateExclusive,
      branchIds: resolvedBranchIds,
      productId: query.productId,
    });

    return buildFlm1DailyCnSummary(sourceRows, {
      dateLabel,
      currenciesPerBlock,
      selectedBranches,
    });
  }

  async buildExport(
    query: Flm1DailyCnSummaryQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    return buildFlm1DailyCnSummaryExport(report, format);
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
    return requestedBranchIds.filter((branchId) => assignedBranchIdSet.has(branchId));
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

  private async loadSelectedBranches(branchIds: string[]): Promise<Flm1BranchMeta[]> {
    if (!branchIds.length) {
      return [];
    }

    const branches = await this.branchRepository.find({
      where: { id: In(branchIds) },
      select: ["id", "code", "name"],
    });
    const labelById = new Map(
      branches.map((branch) => [
        branch.id,
        branch.code && branch.name
          ? `${branch.code} - ${branch.name}`
          : branch.name || branch.code || branch.id,
      ]),
    );

    return branchIds.map((id) => ({
      id,
      label: labelById.get(id) ?? id,
    }));
  }

  private async loadCurrencyColumnCount() {
    const stored = await this.additionalSettingService.getSettingNumberValue(
      FLM1_REPORTS_SETTING_CATEGORY,
      FLM1_CURRENCY_COLUMN_COUNT_CODE,
      FLM1_DEFAULT_CURRENCY_COLUMNS,
    );
    return clampCurrencyColumnCount(
      Math.min(FLM1_MAX_CURRENCY_COLUMNS, Math.max(FLM1_MIN_CURRENCY_COLUMNS, stored)),
    );
  }
}
