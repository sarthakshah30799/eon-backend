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
import { TourPaxReportQueryDto } from "./dto/tour-pax-report-query.dto";
import { TourPaxReportService } from "./tour-pax-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class TourPaxReportController {
  constructor(private readonly reportService: TourPaxReportService) {}

  @Get("tour-pax-report")
  @ApiOperation({ summary: "Get Tour Pax Report" })
  @ApiResponse({ status: 200, description: "Tour Pax report response" })
  getTourPaxReport(
    @Query() query: TourPaxReportQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("tour-pax-report/export")
  @ApiOperation({ summary: "Download Tour Pax Report as CSV or Excel" })
  async exportTourPaxReport(
    @Query() query: TourPaxReportQueryDto,
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
