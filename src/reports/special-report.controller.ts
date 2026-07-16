import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import {
  SpecialReportFormat,
  SpecialReportQueryDto,
} from "./dto/special-report-query.dto";
import { SpecialReportService } from "./special-report.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class SpecialReportController {
  constructor(private readonly reportService: SpecialReportService) {}

  @Get("special-report")
  @ApiOperation({ summary: "Get special report data" })
  @ApiResponse({ status: 200, description: "Special report response" })
  async getSpecialReport(@Query() query: SpecialReportQueryDto) {
    return this.reportService.buildReport(query);
  }

  @Get("special-report/export")
  @ApiOperation({ summary: "Download special report as CSV or Excel" })
  async exportSpecialReport(
    @Query() query: SpecialReportQueryDto,
    @Res() res: Response,
  ) {
    const payload = await this.reportService.buildExport(
      query,
      query.format ?? SpecialReportFormat.XLSX,
    );

    res.status(200);
    res.setHeader("Content-Type", payload.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${payload.filename}"`);
    return res.send(payload.buffer);
  }
}
