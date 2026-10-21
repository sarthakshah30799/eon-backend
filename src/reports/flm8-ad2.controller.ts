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
import { Flm8Ad2QueryDto } from "./dto/flm8-ad2-query.dto";
import { Flm8Ad2Service } from "./flm8-ad2.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class Flm8Ad2Controller {
  constructor(private readonly reportService: Flm8Ad2Service) {}

  @Get("flm8-ad2")
  @ApiOperation({ summary: "Get FLM 8 - AD 2" })
  @ApiResponse({ status: 200, description: "FLM 8 - AD 2 report response" })
  getFlm8Ad2(
    @Query() query: Flm8Ad2QueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("flm8-ad2/export")
  @ApiOperation({ summary: "Download FLM 8 - AD 2 as CSV or Excel" })
  async exportFlm8Ad2(
    @Query() query: Flm8Ad2QueryDto,
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
