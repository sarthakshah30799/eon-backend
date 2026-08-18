import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import {
  CardSettlementReportFormat,
  CardSettlementReportQueryDto,
} from "./dto/card-settlement-report-query.dto";
import { CardSettledReportService } from "./card-settled-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class CardSettledReportController {
  constructor(private readonly reportService: CardSettledReportService) {}

  @Get("card-settled")
  @ApiOperation({ summary: "Get settled CARD report data" })
  @ApiResponse({ status: 200, description: "Settled CARD report response" })
  async getCardSettledReport(@Query() query: CardSettlementReportQueryDto) {
    return this.reportService.buildReport(query);
  }

  @Get("card-settled/export")
  @ApiOperation({ summary: "Download settled CARD report as CSV or Excel" })
  async exportCardSettledReport(
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
