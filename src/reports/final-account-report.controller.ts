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
import { FinalAccountReportQueryDto } from "./dto/final-account-report-query.dto";
import { FinalAccountReportService } from "./final-account-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class FinalAccountReportController {
  constructor(private readonly reportService: FinalAccountReportService) {}

  @Get("final-account-report")
  @ApiOperation({ summary: "Get Final Account Report" })
  @ApiResponse({ status: 200, description: "Final account report" })
  getFinalAccountReport(
    @Query() query: FinalAccountReportQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("final-account-report/export")
  @ApiOperation({
    summary: "Download Final Account Report as CSV or Excel",
  })
  async exportFinalAccountReport(
    @Query() query: FinalAccountReportQueryDto,
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
