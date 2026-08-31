import {
  Body,
  Controller,
  Get,
  Post,
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
import { DayEndStartProcessService } from "../day-end-start-process/day-end-start-process.service";
import {
  CreateTransactionDataLocksDto,
  CreateTransactionDataLocksResultDto,
} from "../transaction-data-locks/dto/transaction-data-lock.dto";
import { TransactionDataLocksService } from "../transaction-data-locks/transaction-data-locks.service";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { Flm8CnStatementQueryDto } from "./dto/flm8-cn-statement-query.dto";
import { Flm8CnStatementService } from "./flm8-cn-statement.service";

@ApiTags("reports")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("reports")
export class Flm8CnStatementController {
  constructor(
    private readonly reportService: Flm8CnStatementService,
    private readonly transactionDataLocksService: TransactionDataLocksService,
    private readonly dayEndStartProcessService: DayEndStartProcessService,
  ) {}

  @Get("flm8-cn-statement")
  @ApiOperation({ summary: "Get FLM 8 CN statement" })
  @ApiResponse({ status: 200, description: "FLM 8 CN statement response" })
  getFlm8CnStatement(
    @Query() query: Flm8CnStatementQueryDto,
    @Session() session: SessionContext,
  ) {
    return this.reportService.buildReport(query, session);
  }

  @Get("flm8-cn-statement/export")
  @ApiOperation({ summary: "Download FLM 8 CN statement as CSV or Excel" })
  async exportFlm8CnStatement(
    @Query() query: Flm8CnStatementQueryDto,
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

  @Post("flm8-cn-statement/lock-data")
  @ApiOperation({
    summary:
      "Lock FLM 8 report end date for selected branches (no undo; advance-only)",
  })
  @ApiResponse({ status: 201, type: CreateTransactionDataLocksResultDto })
  async lockFlm8Data(
    @Body() dto: CreateTransactionDataLocksDto,
    @Session() session: SessionContext,
  ): Promise<CreateTransactionDataLocksResultDto> {
    const policyContext = await this.dayEndStartProcessService.getPolicyContext(
      session,
      false,
    );
    const maxAllowedBusinessDate =
      policyContext.transactionDate ||
      policyContext.openBusinessDate ||
      policyContext.currentBusinessDate;

    return this.transactionDataLocksService.createOrAdvanceLocks(
      dto,
      session,
      maxAllowedBusinessDate,
    );
  }
}
