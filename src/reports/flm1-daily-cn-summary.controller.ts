import { Controller, Get, Query, Res, Session, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { SessionContext } from "../auth/types/session-context";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { Flm1DailyCnSummaryQueryDto } from "./dto/flm1-daily-cn-summary-query.dto";
import { Flm1DailyCnSummaryService } from "./flm1-daily-cn-summary.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class Flm1DailyCnSummaryController {
  constructor(private readonly reportService: Flm1DailyCnSummaryService) {}

  @Get("flm1-daily-cn-summary")
  @ApiOperation({ summary: "Get FLM-1 daily CN summary" })
  @ApiResponse({ status: 200, description: "FLM-1 daily CN summary response" })
  getFlm1DailyCnSummary(
    @Query() query: Flm1DailyCnSummaryQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("flm1-daily-cn-summary/export")
  @ApiOperation({ summary: "Download FLM-1 daily CN summary as CSV or Excel" })
  async exportFlm1DailyCnSummary(
    @Query() query: Flm1DailyCnSummaryQueryDto,
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
