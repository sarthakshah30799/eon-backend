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
  CurrencyBalanceReportFormat,
  CurrencyBalanceReportQueryDto,
} from "./dto/currency-balance-report-query.dto";
import { CurrencyBalanceReportService } from "./currency-balance-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class CurrencyBalanceReportController {
  constructor(private readonly reportService: CurrencyBalanceReportService) {}

  @Get("currency-balance")
  @ApiOperation({ summary: "Get currency balance report data" })
  @ApiResponse({ status: 200, description: "Currency balance report response" })
  async getCurrencyBalanceReport(
    @Query() query: CurrencyBalanceReportQueryDto,
  ) {
    return this.reportService.buildReport(query);
  }

  @Get("currency-balance/export")
  @ApiOperation({ summary: "Download currency balance report as CSV or Excel" })
  async exportCurrencyBalanceReport(
    @Query() query: CurrencyBalanceReportQueryDto,
    @Res() res: Response,
  ) {
    const payload = await this.reportService.buildExport(
      query,
      query.format ?? CurrencyBalanceReportFormat.XLSX,
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
