import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Session,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CreateMonthlyLocksDto } from "./dto/monthly-lock-window.dto";
import { MonthlyLocksService } from "./monthly-locks.service";

@ApiTags("monthly-locks")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("monthly-locks")
export class MonthlyLocksController {
  constructor(private readonly monthlyLocksService: MonthlyLocksService) {}

  @Post()
  @ApiOperation({ summary: "Create monthly lock rules" })
  async createMonthlyLocks(
    @Body() dto: CreateMonthlyLocksDto,
    @Session() session: any,
  ) {
    return this.monthlyLocksService.createMonthlyLocks(
      dto,
      session?.userId ?? "",
    );
  }

  @Get()
  @ApiOperation({ summary: "List monthly lock rules" })
  async listMonthlyLocks() {
    return this.monthlyLocksService.listMonthlyLocks();
  }

  @Delete(":windowId")
  @ApiOperation({ summary: "Revoke a monthly lock rule" })
  async revokeMonthlyLock(
    @Param("windowId") windowId: string,
    @Session() session: any,
  ) {
    return this.monthlyLocksService.revokeMonthlyLock(
      windowId,
      session?.userId ?? "",
    );
  }
}
