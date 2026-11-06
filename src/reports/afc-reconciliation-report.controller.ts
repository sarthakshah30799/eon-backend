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
import { AfcReconciliationReportQueryDto } from "./dto/afc-reconciliation-report-query.dto";
import { AfcReconciliationReportService } from "./afc-reconciliation-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class AfcReconciliationReportController {
  constructor(
    private readonly reportService: AfcReconciliationReportService,
  ) {}

  @Get("afc-reconciliation-report")
  @ApiOperation({ summary: "Get AFC Reconciliation Report" })
  @ApiResponse({ status: 200, description: "AFC reconciliation report" })
  getAfcReconciliationReport(
    @Query() query: AfcReconciliationReportQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("afc-reconciliation-report/export")
  @ApiOperation({
    summary: "Download AFC Reconciliation Report as CSV or Excel",
  })
  async exportAfcReconciliationReport(
    @Query() query: AfcReconciliationReportQueryDto,
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
