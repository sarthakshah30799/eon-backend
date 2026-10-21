import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { TourPaxReportQueryDto } from "./dto/tour-pax-report-query.dto";
import { resolveFlmAccessibleBranchIds } from "./flm-report-access.helpers";
import {
  buildTourPaxExport,
  buildTourPaxReport,
  loadTourPaxMarketingReferences,
  loadTourPaxPurposeCodes,
  loadTourPaxRows,
  resolveTourPaxDateRange,
} from "./tour-pax-report.helpers";

@Injectable()
export class TourPaxReportService {
  constructor(
    @InjectDataSource()
    private readonly database: DataSource,
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async buildReport(query: TourPaxReportQueryDto, session?: SessionContext) {
    const { startDate, endDateExclusive } = resolveTourPaxDateRange(
      query.startDate,
      query.endDate,
    );
    const branchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );
    const sourceRows = await loadTourPaxRows(this.database2, {
      startDate,
      endDateExclusive,
      branchIds,
    });
    const [purposeCodeById, marketingByPartyId] = await Promise.all([
      loadTourPaxPurposeCodes(
        this.database,
        sourceRows.map((row) => String(row.purposeId ?? "")),
      ),
      loadTourPaxMarketingReferences(
        this.database,
        sourceRows.map((row) => String(row.partyProfileId ?? "")),
      ),
    ]);

    return buildTourPaxReport(sourceRows, {
      startDate: query.startDate.slice(0, 10),
      endDate: query.endDate.slice(0, 10),
      purposeCodeById,
      marketingByPartyId,
    });
  }

  async buildExport(
    query: TourPaxReportQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    return buildTourPaxExport(report, format);
  }
}
