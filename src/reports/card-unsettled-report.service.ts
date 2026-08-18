import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  CardSettlementReportFormat,
  CardSettlementReportQueryDto,
} from "./dto/card-settlement-report-query.dto";
import {
  buildCardSettlementReport,
  buildCardSettlementReportExport,
} from "./card-settlement-report.helpers";

@Injectable()
export class CardUnsettledReportService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
  ) {}

  buildReport(query: CardSettlementReportQueryDto) {
    return buildCardSettlementReport(this.database2, "unsettled", query);
  }

  buildExport(
    query: CardSettlementReportQueryDto,
    format: CardSettlementReportFormat,
  ) {
    return buildCardSettlementReportExport(
      this.database2,
      "unsettled",
      query,
      format,
    );
  }
}
