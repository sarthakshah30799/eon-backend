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
import { Flm6SalesToFfmcQueryDto } from "./dto/flm6-sales-to-ffmc-query.dto";
import { Flm6SalesToFfmcService } from "./flm6-sales-to-ffmc.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class Flm6SalesToFfmcController {
  constructor(private readonly reportService: Flm6SalesToFfmcService) {}

  @Get("flm6-sales-to-ffmc")
  @ApiOperation({ summary: "Get FLM-6 sales to FFMC register" })
  @ApiResponse({
    status: 200,
    description: "FLM-6 sales to FFMC report response",
  })
  getFlm6SalesToFfmc(
    @Query() query: Flm6SalesToFfmcQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("flm6-sales-to-ffmc/export")
  @ApiOperation({
    summary: "Download FLM-6 sales to FFMC register as CSV or Excel",
  })
  async exportFlm6SalesToFfmc(
    @Query() query: Flm6SalesToFfmcQueryDto,
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
