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
import { GeneralLedgerReportQueryDto } from "./dto/general-ledger-report-query.dto";
import { GeneralLedgerReportService } from "./general-ledger-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class GeneralLedgerReportController {
  constructor(
    private readonly reportService: GeneralLedgerReportService,
  ) {}

  @Get("general-ledger-report")
  @ApiOperation({ summary: "Get General Ledger Report" })
  @ApiResponse({ status: 200, description: "General ledger report" })
  getGeneralLedgerReport(
    @Query() query: GeneralLedgerReportQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("general-ledger-report/export")
  @ApiOperation({
    summary: "Download General Ledger Report as CSV or Excel",
  })
  async exportGeneralLedgerReport(
    @Query() query: GeneralLedgerReportQueryDto,
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
