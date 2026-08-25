import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { CardBlankStockReportQueryDto } from "./dto/card-blank-stock-report-query.dto";
import {
  buildCardBlankStockReport,
  buildCardBlankStockReportExport,
} from "./card-blank-stock-report.helpers";

@Injectable()
export class CardBlankStockReportService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
  ) {}

  buildReport(query: CardBlankStockReportQueryDto) {
    return buildCardBlankStockReport(this.database2, query);
  }

  buildExport(
    query: CardBlankStockReportQueryDto,
    format: CardSettlementReportFormat,
  ) {
    return buildCardBlankStockReportExport(this.database2, query, format);
  }
}
