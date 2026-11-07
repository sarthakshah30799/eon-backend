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
  BankReconciliationReportFormat,
  BankReconciliationReportQueryDto,
} from "./dto/bank-reconciliation-report-query.dto";
import { BankReconciliationReportService } from "./bank-reconciliation-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class BankReconciliationReportController {
  constructor(private readonly reportService: BankReconciliationReportService) {}

  @Get("bank-reconciliation-report")
  @ApiOperation({ summary: "Get bank reconciliation report data" })
  @ApiResponse({
    status: 200,
    description: "Bank reconciliation report response",
  })
  async getReport(@Query() query: BankReconciliationReportQueryDto) {
    return this.reportService.buildReport(query);
  }

  @Get("bank-reconciliation-report/export")
  @ApiOperation({
    summary: "Download bank reconciliation report as CSV, Excel, or PDF",
  })
  async exportReport(
    @Query() query: BankReconciliationReportQueryDto,
    @Res() res: Response,
  ) {
    const payload = await this.reportService.buildExport(
      query,
      query.format ?? BankReconciliationReportFormat.XLSX,
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
