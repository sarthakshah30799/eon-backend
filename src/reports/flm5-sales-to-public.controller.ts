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
import { Flm5SalesToPublicQueryDto } from "./dto/flm5-sales-to-public-query.dto";
import { Flm5SalesToPublicService } from "./flm5-sales-to-public.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class Flm5SalesToPublicController {
  constructor(private readonly reportService: Flm5SalesToPublicService) {}

  @Get("flm5-sales-to-public")
  @ApiOperation({ summary: "Get FLM-5 sales to public register" })
  @ApiResponse({
    status: 200,
    description: "FLM-5 sales to public report response",
  })
  getFlm5SalesToPublic(
    @Query() query: Flm5SalesToPublicQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("flm5-sales-to-public/export")
  @ApiOperation({
    summary: "Download FLM-5 sales to public register as CSV or Excel",
  })
  async exportFlm5SalesToPublic(
    @Query() query: Flm5SalesToPublicQueryDto,
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
