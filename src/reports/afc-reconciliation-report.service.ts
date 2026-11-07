import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import {
  AfcReconciliationReportLayout,
  AfcReconciliationReportQueryDto,
  AfcReconciliationReportScope,
} from "./dto/afc-reconciliation-report-query.dto";
import { resolveFlmAccessibleBranchIds } from "./flm-report-access.helpers";
import {
  buildAfcReconciliationExport,
  buildAfcReconciliationReport,
  loadAfcReconciliationSourceRows,
  resolveAfcDateRange,
} from "./afc-reconciliation-report.helpers";

@Injectable()
export class AfcReconciliationReportService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async buildReport(
    query: AfcReconciliationReportQueryDto,
    session?: SessionContext,
  ) {
    const { startDate, endDateExclusive, accountingDate } = resolveAfcDateRange(
      query.startDate,
      query.endDate,
      query.accountingDate,
    );
    const branchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );
    const sourceRows = await loadAfcReconciliationSourceRows(this.database2, {
      startDate,
      endDateExclusive,
      accountingDate:
        typeof accountingDate === "string"
          ? accountingDate.slice(0, 10)
          : query.accountingDate.slice(0, 10),
      branchIds,
      counterIds: query.counterIds ?? [],
    });

    return buildAfcReconciliationReport(sourceRows, {
      startDate: query.startDate.slice(0, 10),
      endDate: query.endDate.slice(0, 10),
      accountingDate: query.accountingDate.slice(0, 10),
      layout: query.layout ?? AfcReconciliationReportLayout.DETAIL,
      scope: query.scope ?? AfcReconciliationReportScope.BRANCH,
    });
  }

  async buildExport(
    query: AfcReconciliationReportQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    return buildAfcReconciliationExport(report, format);
  }
}
