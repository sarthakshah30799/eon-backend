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
import { AgeingReportQueryDto } from "./dto/ageing-report-query.dto";
import { AgeingReportService } from "./ageing-report.service";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class AgeingReportController {
  constructor(private readonly reportService: AgeingReportService) {}

  @Get("ageing-report")
  @ApiOperation({ summary: "Get Ageing Report" })
  @ApiResponse({ status: 200, description: "Ageing report" })
  getAgeingReport(
    @Query() query: AgeingReportQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("ageing-report/export")
  @ApiOperation({ summary: "Download Ageing Report as CSV or Excel" })
  async exportAgeingReport(
    @Query() query: AgeingReportQueryDto,
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
