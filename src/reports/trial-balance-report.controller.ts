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
import { TrialBalanceReportQueryDto } from "./dto/trial-balance-report-query.dto";
import { TrialBalanceReportService } from "./trial-balance-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class TrialBalanceReportController {
  constructor(private readonly reportService: TrialBalanceReportService) {}

  @Get("trial-balance-report")
  @ApiOperation({ summary: "Get Trial Balance Report" })
  @ApiResponse({ status: 200, description: "Trial balance report" })
  getTrialBalanceReport(
    @Query() query: TrialBalanceReportQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("trial-balance-report/export")
  @ApiOperation({
    summary: "Download Trial Balance Report as CSV or Excel",
  })
  async exportTrialBalanceReport(
    @Query() query: TrialBalanceReportQueryDto,
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
