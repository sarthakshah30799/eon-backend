import { Body, Controller, Get, Post, Query, Session, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { BankReconciliationService } from "./bank-reconciliation.service";
import { BankReconciliationClearDto } from "./dto/bank-reconciliation-clear.dto";
import { BankReconciliationQueryDto } from "./dto/bank-reconciliation-query.dto";

@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@ApiTags("bank-reconciliation")
@Controller("bank-reconciliation")
export class BankReconciliationController {
  constructor(private readonly service: BankReconciliationService) {}

  @Get()
  @ApiOperation({ summary: "List bank reconciliation cheque rows" })
  query(@Query() query: BankReconciliationQueryDto, @Session() session: any) {
    return this.service.query(query, session);
  }

  @Post("clear")
  @ApiOperation({
    summary: "Clear or dishonor selected bank reconciliation rows",
  })
  clear(@Body() dto: BankReconciliationClearDto, @Session() session: any) {
    return this.service.clear(dto, session);
  }
}
