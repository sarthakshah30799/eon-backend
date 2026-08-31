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
import { Flm4PurchaseFromFfmcQueryDto } from "./dto/flm4-purchase-from-ffmc-query.dto";
import { Flm4PurchaseFromFfmcService } from "./flm4-purchase-from-ffmc.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class Flm4PurchaseFromFfmcController {
  constructor(private readonly reportService: Flm4PurchaseFromFfmcService) {}

  @Get("flm4-purchase-from-ffmc")
  @ApiOperation({ summary: "Get FLM-4 purchase from FFMC register" })
  @ApiResponse({
    status: 200,
    description: "FLM-4 purchase from FFMC report response",
  })
  getFlm4PurchaseFromFfmc(
    @Query() query: Flm4PurchaseFromFfmcQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("flm4-purchase-from-ffmc/export")
  @ApiOperation({
    summary: "Download FLM-4 purchase from FFMC register as CSV or Excel",
  })
  async exportFlm4PurchaseFromFfmc(
    @Query() query: Flm4PurchaseFromFfmcQueryDto,
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
