import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import {
  GenerateLedgerFormat,
  GenerateLedgerQueryDto,
} from "./dto/generate-ledger-query.dto";
import { GenerateLedgerService } from "./generate-ledger.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class GenerateLedgerController {
  constructor(private readonly reportService: GenerateLedgerService) {}

  @Get("generate-ledger")
  @ApiOperation({ summary: "Get generate ledger report data" })
  @ApiResponse({ status: 200, description: "Generate ledger response" })
  async getGenerateLedger(@Query() query: GenerateLedgerQueryDto) {
    return this.reportService.buildReport(query);
  }

  @Get("generate-ledger/export")
  @ApiOperation({ summary: "Download generate ledger as CSV or Excel" })
  async exportGenerateLedger(
    @Query() query: GenerateLedgerQueryDto,
    @Res() res: Response,
  ) {
    const payload = await this.reportService.buildExport(
      query,
      query.format ?? GenerateLedgerFormat.XLSX,
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
