import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { PurposeService } from "../purpose/purpose.service";
import { UserRole } from "../user-roles/user-role.entity";
import {
  LrsDailyReportExportFormat,
  LrsDailyReportFormat,
  LrsDailyReportQueryDto,
} from "./dto/lrs-daily-report-query.dto";
import {
  canSeeAllFlmBranches,
  resolveFlmAccessibleBranchIds,
} from "./flm-report-access.helpers";
import {
  buildLrsDailyReport,
  buildLrsDailyReportExport,
  loadLrsDailyReportSourceRows,
  loadLrsTourPaxRows,
  resolveLrsReportDateRange,
} from "./lrs-daily-report.helpers";

@Injectable()
export class LrsDailyReportService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    private readonly purposeService: PurposeService,
  ) {}

  async buildReport(query: LrsDailyReportQueryDto, session?: SessionContext) {
    const { startDate, endDateExclusive, startLabel, endLabel } =
      resolveLrsReportDateRange(query.startDate, query.endDate);
    const resolvedBranchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );
    const rbiCodeByPurposeId = await this.purposeService.listRbiCodesByPurposeId();
    const purposeIds = query.purposeId
      ? rbiCodeByPurposeId.has(query.purposeId)
        ? [query.purposeId]
        : []
      : [...rbiCodeByPurposeId.keys()];
    const reportInput = {
      date: endLabel,
      startDate: startLabel,
      endDate: endLabel,
      usdRate: Number(query.usdRate),
      bankName: query.bankName ?? "",
      bankCode: query.bankCode ?? "",
      reportFormat: query.reportFormat ?? LrsDailyReportFormat.CIMS,
      rbiCodeByPurposeId,
      showTourPaxBreakup: query.showTourPaxBreakup === true,
    };
    const hasNoBranchAccess =
      !canSeeAllFlmBranches(session) && resolvedBranchIds.length === 0;

    if (hasNoBranchAccess) {
      return buildLrsDailyReport([], reportInput);
    }

    const sourceFilters = {
      startDate,
      endDateExclusive,
      branchIds: resolvedBranchIds,
      productId: query.productId,
      issuerPartyProfileId: query.issuerPartyProfileId,
      purposeIds,
      includeCorporateTransactions: query.includeCorporateTransactions,
    };
    const sourceRows = await loadLrsDailyReportSourceRows(
      this.database2,
      sourceFilters,
    );
    const tourPaxRows = query.showTourPaxBreakup
      ? await loadLrsTourPaxRows(this.database2, sourceFilters)
      : [];

    return buildLrsDailyReport(sourceRows, {
      ...reportInput,
      tourPassengers: tourPaxRows,
    });
  }

  async buildExport(
    query: LrsDailyReportQueryDto,
    format: LrsDailyReportExportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    return buildLrsDailyReportExport(report, format);
  }
}
