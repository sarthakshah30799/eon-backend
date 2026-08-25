import { Controller, Get, Query, Res, Session, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { SessionContext } from "../auth/types/session-context";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { Flm3PurchaseFromPublicQueryDto } from "./dto/flm3-purchase-from-public-query.dto";
import { Flm3PurchaseFromPublicService } from "./flm3-purchase-from-public.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class Flm3PurchaseFromPublicController {
  constructor(private readonly reportService: Flm3PurchaseFromPublicService) {}

  @Get("flm3-purchase-from-public")
  @ApiOperation({ summary: "Get FLM-3 purchase from public register" })
  @ApiResponse({
    status: 200,
    description: "FLM-3 purchase from public report response",
  })
  getFlm3PurchaseFromPublic(
    @Query() query: Flm3PurchaseFromPublicQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("flm3-purchase-from-public/export")
  @ApiOperation({
    summary: "Download FLM-3 purchase from public register as CSV or Excel",
  })
  async exportFlm3PurchaseFromPublic(
    @Query() query: Flm3PurchaseFromPublicQueryDto,
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
