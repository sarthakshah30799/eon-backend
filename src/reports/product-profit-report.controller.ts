import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { ProductProfitReportFormat, ProductProfitReportQueryDto } from "./dto/product-profit-report-query.dto";
import { ProductProfitReportService } from "./product-profit-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class ProductProfitReportController {
  constructor(private readonly reportService: ProductProfitReportService) {}

  @Get("product-profit")
  @ApiOperation({ summary: "Get product profit report data" })
  @ApiResponse({ status: 200, description: "Product profit report response" })
  async getProductProfitReport(@Query() query: ProductProfitReportQueryDto) {
    return this.reportService.buildReport(query);
  }

  @Get("product-profit/export")
  @ApiOperation({ summary: "Download product profit report as CSV or Excel" })
  async exportProductProfitReport(
    @Query() query: ProductProfitReportQueryDto,
    @Res() res: Response,
  ) {
    const payload = await this.reportService.buildExport(
      query,
      query.format ?? ProductProfitReportFormat.XLSX,
    );
    res.status(200);
    res.setHeader("Content-Type", payload.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${payload.filename}"`);
    return res.send(payload.buffer);
  }
}
