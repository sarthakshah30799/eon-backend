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
  LrsDailyReportExportFormat,
  LrsDailyReportQueryDto,
} from "./dto/lrs-daily-report-query.dto";
import { LrsDailyReportService } from "./lrs-daily-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class LrsDailyReportController {
  constructor(private readonly reportService: LrsDailyReportService) {}

  @Get("lrs-daily-report")
  @ApiOperation({ summary: "Get the LRS daily report" })
  @ApiResponse({ status: 200, description: "LRS daily report response" })
  getLrsDailyReport(
    @Query() query: LrsDailyReportQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("lrs-daily-report/export")
  @ApiOperation({
    summary: "Download the LRS daily report as Excel, PDF, or TXT",
  })
  async exportLrsDailyReport(
    @Query() query: LrsDailyReportQueryDto,
    @Session() session: SessionContext,
    @Res() res: Response,
  ) {
    const payload = await this.reportService.buildExport(
      query,
      query.format ?? LrsDailyReportExportFormat.XLSX,
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
