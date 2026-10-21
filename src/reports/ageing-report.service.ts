import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import {
  AgeingEefcFilter,
  AgeingReportLayout,
  AgeingReportQueryDto,
  AgeingScope,
} from "./dto/ageing-report-query.dto";
import {
  OutstandingPartySelection,
  OutstandingTransactionSide,
} from "./dto/outstanding-transaction-report-query.dto";
import { resolveFlmAccessibleBranchIds } from "./flm-report-access.helpers";
import {
  buildAgeingExport,
  buildAgeingReport,
  filterAgeingTransactionIdsByAccount,
  loadAgeingPartyMeta,
} from "./ageing-report.helpers";
import {
  loadOutstandingPartyIds,
  loadOutstandingSourceRows,
  loadSettlementsAfterAccountingDate,
  resolveOutstandingDateRange,
} from "./outstanding-transaction-report.helpers";

@Injectable()
export class AgeingReportService {
  constructor(
    @InjectDataSource()
    private readonly database: DataSource,
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async buildReport(query: AgeingReportQueryDto, session?: SessionContext) {
    const asOnDate = query.endDate.slice(0, 10);
    const { startDate, endDateExclusive, accountingDate } =
      resolveOutstandingDateRange(query.startDate, query.endDate, asOnDate);
    const branchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );
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
    const accountIds = query.accountIds ?? [];
    const allowedTransactionIds = accountIds.length
      ? await filterAgeingTransactionIdsByAccount(
          this.database2,
          sourceRows.map((row) => row.id),
          accountIds,
        )
      : null;
    const [laterSettlementByTransactionId, partyMetaById] = await Promise.all([
      loadSettlementsAfterAccountingDate(
        this.database2,
        sourceRows.map((row) => row.id),
        accountingDate,
      ),
      loadAgeingPartyMeta(
        this.database,
        sourceRows.map((row) => String(row.partyProfileId ?? "")),
      ),
    ]);

    return buildAgeingReport(sourceRows, {
      startDate: query.startDate.slice(0, 10),
      endDate: asOnDate,
      asOnDate,
      layout: query.layout ?? AgeingReportLayout.DETAIL,
      scope: query.scope ?? AgeingScope.BRANCH,
      eefcFilter: query.eefcFilter ?? AgeingEefcFilter.ALL,
      ageingBuckets: query.ageingBuckets ?? [],
      laterSettlementByTransactionId,
      partyMetaById,
      allowedTransactionIds,
    });
  }

  async buildExport(
    query: AgeingReportQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    return buildAgeingExport(report, format);
  }
}
