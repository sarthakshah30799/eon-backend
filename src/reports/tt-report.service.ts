import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { TtReportLayout, TtReportQueryDto } from "./dto/tt-report-query.dto";
import { resolveFlmAccessibleBranchIds } from "./flm-report-access.helpers";
import { TT_REPORT_FORMATS } from "./tt-report.formats";
import {
  buildTtReport,
  buildTtReportExport,
  loadTtReportRows,
  markTtReportRowsBlocked,
  resolveTtReportDateRange,
} from "./tt-report.helpers";

@Injectable()
export class TtReportService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async buildReport(query: TtReportQueryDto, session?: SessionContext) {
    const { startDate, endDateExclusive } = resolveTtReportDateRange(
      query.startDate,
      query.endDate,
    );
    const branchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );
    const layout = query.layout ?? TtReportLayout.INDUS;
    const format = TT_REPORT_FORMATS[layout];
    if (!format.columns.length) {
      return {
        startDate: query.startDate.slice(0, 10),
        endDate: query.endDate.slice(0, 10),
        blockedBatchAt: null,
        layout,
        message: format.emptyMessage,
        columns: [],
        rows: [],
      };
    }
    const blockedBatchAt = query.blockedBatchAt
      ? new Date(query.blockedBatchAt)
      : null;
    const blockAfterGenerate =
      query.blockAfterGenerate === true && !blockedBatchAt;
    const markedAt = blockAfterGenerate ? new Date() : null;
    const sourceRows = await loadTtReportRows(this.database2, {
      startDate,
      endDateExclusive,
      branchIds,
      productId: query.productId,
      issuerPartyProfileIds: query.issuerPartyProfileIds ?? [],
      issuerName: format.issuerName,
      showBlocked: query.showBlocked === true,
      showBeforeHoAcceptance: query.showBeforeHoAcceptance === true,
      blockedBatchAt,
    });
    if (markedAt) {
      await markTtReportRowsBlocked(
        this.database2,
        sourceRows.map((row) => row.transactionId),
        session?.userId ?? "",
        markedAt,
      );
    }

    return buildTtReport(sourceRows, {
      startDate: query.startDate.slice(0, 10),
      endDate: query.endDate.slice(0, 10),
      markedNow: blockAfterGenerate,
      blockedBatchAt: markedAt ? markedAt.toISOString() : query.blockedBatchAt ?? null,
      layout,
    });
  }

  async buildExport(
    query: TtReportQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    return buildTtReportExport(report, format);
  }
}
