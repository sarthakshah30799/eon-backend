import {
  Controller,
  Get,
  Query,
  Res,
  Session,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { SessionContext } from "../auth/types/session-context";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { OutstandingTransactionReportQueryDto } from "./dto/outstanding-transaction-report-query.dto";
import { OutstandingTransactionReportService } from "./outstanding-transaction-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class OutstandingTransactionReportController {
  constructor(
    private readonly reportService: OutstandingTransactionReportService,
  ) {}

  @Get("outstanding-transaction-report")
  @ApiOperation({ summary: "Get Outstanding Transaction Report" })
  @ApiResponse({ status: 200, description: "Outstanding transaction report" })
  getOutstandingTransactionReport(
    @Query() query: OutstandingTransactionReportQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("outstanding-transaction-report/export")
  @ApiOperation({
    summary: "Download Outstanding Transaction Report as CSV or Excel",
  })
  async exportOutstandingTransactionReport(
    @Query() query: OutstandingTransactionReportQueryDto,
    @Session() session: SessionContext,
    @Res() res: Response,
  ) {
    const payload = await this.reportService.buildExport(
      query,
      query.format ?? CardSettlementReportFormat.XLSX,
      session,
    );
    res.status(200);
    res.setHeader("Content-Type", payload.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${payload.filename}"`,
    );
    return res.send(payload.buffer);
  }
}
