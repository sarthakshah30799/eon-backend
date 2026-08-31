import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import {
  CardSettlementReportFormat,
  CardSettlementReportQueryDto,
} from "./dto/card-settlement-report-query.dto";
import { CardUnsettledReportService } from "./card-unsettled-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class CardUnsettledReportController {
  constructor(private readonly reportService: CardUnsettledReportService) {}

  @Get("card-unsettled")
  @ApiOperation({ summary: "Get unsettled CARD report data" })
  @ApiResponse({ status: 200, description: "Unsettled CARD report response" })
  async getCardUnsettledReport(@Query() query: CardSettlementReportQueryDto) {
    return this.reportService.buildReport(query);
  }

  @Get("card-unsettled/export")
  @ApiOperation({ summary: "Download unsettled CARD report as CSV or Excel" })
  async exportCardUnsettledReport(
    @Query() query: CardSettlementReportQueryDto,
    @Res() res: Response,
  ) {
    const payload = await this.reportService.buildExport(
      query,
      query.format ?? CardSettlementReportFormat.XLSX,
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
