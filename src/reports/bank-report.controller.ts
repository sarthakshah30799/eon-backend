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
  BankReportFormat,
  BankReportQueryDto,
} from "./dto/bank-report-query.dto";
import { BankReportService } from "./bank-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class BankReportController {
  constructor(private readonly reportService: BankReportService) {}

  @Get("bank-report")
  @ApiOperation({ summary: "Get bank ledger report data" })
  @ApiResponse({ status: 200, description: "Bank report response" })
  async getBankReport(@Query() query: BankReportQueryDto) {
    return this.reportService.buildReport(query);
  }

  @Get("bank-report/export")
  @ApiOperation({ summary: "Download bank report as CSV or Excel" })
  async exportBankReport(
    @Query() query: BankReportQueryDto,
    @Res() res: Response,
  ) {
    const payload = await this.reportService.buildExport(
      query,
      query.format ?? BankReportFormat.XLSX,
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
