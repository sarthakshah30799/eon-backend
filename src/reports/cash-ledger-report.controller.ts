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
import { CashLedgerReportQueryDto } from "./dto/cash-ledger-report-query.dto";
import { CashLedgerReportService } from "./cash-ledger-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class CashLedgerReportController {
  constructor(private readonly reportService: CashLedgerReportService) {}

  @Get("cash-ledger-report")
  @ApiOperation({ summary: "Get Cash Ledger Report" })
  @ApiResponse({ status: 200, description: "Cash ledger report" })
  getCashLedgerReport(
    @Query() query: CashLedgerReportQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("cash-ledger-report/export")
  @ApiOperation({
    summary: "Download Cash Ledger Report as CSV or Excel",
  })
  async exportCashLedgerReport(
    @Query() query: CashLedgerReportQueryDto,
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
