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
import {
  TradingSummaryReportFormat,
  TradingSummaryReportQueryDto,
} from "./dto/trading-summary-report-query.dto";
import { TradingSummaryReportService } from "./trading-summary-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class TradingSummaryReportController {
  constructor(private readonly reportService: TradingSummaryReportService) {}

  @Get("trading-summary-report")
  @ApiOperation({ summary: "Get Trading Summary report" })
  @ApiResponse({ status: 200, description: "Trading Summary report" })
  getTradingSummaryReport(
    @Query() query: TradingSummaryReportQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("trading-summary-report/export")
  @ApiOperation({
    summary: "Download Trading Summary report as CSV or Excel",
  })
  async exportTradingSummaryReport(
    @Query() query: TradingSummaryReportQueryDto,
    @Session() session: SessionContext,
    @Res() res: Response,
  ) {
    const payload = await this.reportService.buildExport(
      query,
      query.format ?? TradingSummaryReportFormat.XLSX,
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
