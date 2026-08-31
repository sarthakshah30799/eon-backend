import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
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
} from "./flm1-daily-cn-summary.helpers";
import {
  canSeeAllFlmBranches,
  loadFlmSelectedBranches,
  resolveFlmAccessibleBranchIds,
} from "./flm-report-access.helpers";

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

  async buildReport(
    query: Flm1DailyCnSummaryQueryDto,
    session?: SessionContext,
  ) {
    const { startDate, endDateExclusive, dateLabel } = resolveFlm1ReportDate(
      query.date,
    );
    const resolvedBranchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );
    const currenciesPerBlock = await this.loadCurrencyColumnCount();
    const hasNoBranchAccess =
      !canSeeAllFlmBranches(session) && resolvedBranchIds.length === 0;

    if (hasNoBranchAccess) {
      return buildFlm1DailyCnSummary([], {
        dateLabel,
        currenciesPerBlock,
        selectedBranches: [],
        layout: query.layout,
      });
    }

    const selectedBranches = await loadFlmSelectedBranches(
      this.branchRepository,
      resolvedBranchIds,
    );
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
      layout: query.layout,
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

  private async loadCurrencyColumnCount() {
    const stored = await this.additionalSettingService.getSettingNumberValue(
      FLM1_REPORTS_SETTING_CATEGORY,
      FLM1_CURRENCY_COLUMN_COUNT_CODE,
      FLM1_DEFAULT_CURRENCY_COLUMNS,
    );
    return clampCurrencyColumnCount(
      Math.min(
        FLM1_MAX_CURRENCY_COLUMNS,
        Math.max(FLM1_MIN_CURRENCY_COLUMNS, stored),
      ),
    );
  }
}
