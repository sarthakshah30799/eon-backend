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
import { TtReportQueryDto } from "./dto/tt-report-query.dto";
import { TtReportService } from "./tt-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class TtReportController {
  constructor(private readonly reportService: TtReportService) {}

  @Get("tt-report")
  @ApiOperation({ summary: "Get TT Report" })
  @ApiResponse({ status: 200, description: "TT report response" })
  getTtReport(
    @Query() query: TtReportQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("tt-report/export")
  @ApiOperation({ summary: "Download TT Report as CSV or Excel" })
  async exportTtReport(
    @Query() query: TtReportQueryDto,
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
