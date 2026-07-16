import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { SalePurchaseReportQueryDto } from "./dto/sale-purchase-report-query.dto";
import { SalePurchaseReportService } from "./sale-purchase-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class SalePurchaseReportController {
  constructor(private readonly reportService: SalePurchaseReportService) {}

  @Get("sale-purchase")
  @ApiOperation({ summary: "Get grouped or flat sale/purchase report data" })
  @ApiResponse({ status: 200, description: "Sale/purchase report response" })
  async getSalePurchaseReport(
    @Query() query: SalePurchaseReportQueryDto,
  ) {
    return this.reportService.buildReport(query, query.layout ?? "grouped");
  }

  @Get("sale-purchase/export")
  @ApiOperation({ summary: "Download sale/purchase report as CSV or Excel" })
  async exportSalePurchaseReport(
    @Query() query: SalePurchaseReportQueryDto,
    @Query("format") format: "csv" | "xlsx" = "xlsx",
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.reportService.buildExport(
      query,
      query.layout ?? "grouped",
      format,
    );
    res.setHeader("Content-Type", payload.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${payload.filename}"`);
    return payload.buffer;
  }
}
