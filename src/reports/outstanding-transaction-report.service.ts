import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import {
  OutstandingGrouping,
  OutstandingPartySelection,
  OutstandingReportLayout,
  OutstandingTransactionReportQueryDto,
  OutstandingTransactionSide,
} from "./dto/outstanding-transaction-report-query.dto";
import { resolveFlmAccessibleBranchIds } from "./flm-report-access.helpers";
import {
  buildOutstandingExport,
  buildOutstandingReport,
  loadOutstandingPartyIds,
  loadOutstandingPartyMeta,
  loadOutstandingSourceRows,
  loadSettlementsAfterAccountingDate,
  resolveOutstandingDateRange,
} from "./outstanding-transaction-report.helpers";

@Injectable()
export class OutstandingTransactionReportService {
  constructor(
    @InjectDataSource()
    private readonly database: DataSource,
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async buildReport(
    query: OutstandingTransactionReportQueryDto,
    session?: SessionContext,
  ) {
    const { startDate, endDateExclusive, accountingDate } =
      resolveOutstandingDateRange(
        query.startDate,
        query.endDate,
        query.accountingDate,
      );
    const branchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );
    const grouping = query.grouping ?? OutstandingGrouping.CODE;
    const layout = query.layout ?? OutstandingReportLayout.DETAIL;
    const partyProfileIds = await loadOutstandingPartyIds(this.database, {
      partySelection: query.partySelection ?? OutstandingPartySelection.ALL,
      entityTypeId: query.entityTypeId,
      partyProfileIds: query.partyProfileIds,
    });
    const sourceRows = await loadOutstandingSourceRows(this.database2, {
      startDate,
      endDateExclusive,
      accountingDate,
      branchIds,
      partyProfileIds,
      transactionSide: query.transactionSide ?? OutstandingTransactionSide.BOTH,
    });
    const [laterSettlementByTransactionId, partyMetaById] = await Promise.all([
      loadSettlementsAfterAccountingDate(
        this.database2,
        sourceRows.map((row) => row.id),
        accountingDate,
      ),
      loadOutstandingPartyMeta(
        this.database,
        sourceRows.map((row) => String(row.partyProfileId ?? "")),
      ),
    ]);

    return buildOutstandingReport(sourceRows, {
      startDate: query.startDate.slice(0, 10),
      endDate: query.endDate.slice(0, 10),
      accountingDate,
      grouping,
      layout,
      laterSettlementByTransactionId,
      partyMetaById,
    });
  }

  async buildExport(
    query: OutstandingTransactionReportQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    return buildOutstandingExport(report, format);
  }
}
