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
import { CashFlowReportQueryDto } from "./dto/cash-flow-report-query.dto";
import { CashFlowReportService } from "./cash-flow-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class CashFlowReportController {
  constructor(private readonly reportService: CashFlowReportService) {}

  @Get("cash-flow-report")
  @ApiOperation({ summary: "Get Cash Flow Report" })
  @ApiResponse({ status: 200, description: "Cash flow report" })
  getCashFlowReport(
    @Query() query: CashFlowReportQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("cash-flow-report/export")
  @ApiOperation({
    summary: "Download Cash Flow Report as CSV or Excel",
  })
  async exportCashFlowReport(
    @Query() query: CashFlowReportQueryDto,
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
