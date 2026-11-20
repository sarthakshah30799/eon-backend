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
  @ApiOperation({ summary: "Get cash report data" })
  @ApiResponse({ status: 200, description: "Cash report response" })
  getCashReport(
    @Query() query: CashReportQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("cash-report/export")
  @ApiOperation({ summary: "Download cash report as CSV or Excel" })
  async exportCashReport(
    @Query() query: CashReportQueryDto,
    @Session() session: SessionContext,
    @Res() res: Response,
  ) {
    const payload = await this.reportService.buildExport(
      query,
      query.format ?? CashReportFormat.XLSX,
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
