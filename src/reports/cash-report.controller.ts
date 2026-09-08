import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import {
  CashReportFormat,
  CashReportQueryDto,
} from "./dto/cash-report-query.dto";
import { CashReportService } from "./cash-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class CashReportController {
  constructor(private readonly reportService: CashReportService) {}

  @Get("cash-report")
  @ApiOperation({ summary: "Get cash ledger report data" })
  @ApiResponse({ status: 200, description: "Cash report response" })
  async getCashReport(@Query() query: CashReportQueryDto) {
    return this.reportService.buildReport(query);
  }

  @Get("cash-report/export")
  @ApiOperation({ summary: "Download cash report as CSV or Excel" })
  async exportCashReport(
    @Query() query: CashReportQueryDto,
    @Res() res: Response,
  ) {
    const payload = await this.reportService.buildExport(
      query,
      query.format ?? CashReportFormat.XLSX,
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
