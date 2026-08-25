import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { CardBlankStockReportQueryDto } from "./dto/card-blank-stock-report-query.dto";
import { CardBlankStockReportService } from "./card-blank-stock-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class CardBlankStockReportController {
  constructor(private readonly reportService: CardBlankStockReportService) {}

  @Get("card-blank-stock")
  @ApiOperation({ summary: "Get blank CARD stock report data" })
  @ApiResponse({ status: 200, description: "Blank CARD stock report response" })
  async getCardBlankStockReport(@Query() query: CardBlankStockReportQueryDto) {
    return this.reportService.buildReport(query);
  }

  @Get("card-blank-stock/export")
  @ApiOperation({ summary: "Download blank CARD stock report as CSV or Excel" })
  async exportCardBlankStockReport(
    @Query() query: CardBlankStockReportQueryDto,
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
