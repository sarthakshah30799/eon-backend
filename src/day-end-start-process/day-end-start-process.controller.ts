import { Body, Controller, Post, Session, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CompleteDayEndDto } from "./dto/day-end-start-process.dto";
import { DayEndStartProcessService } from "./day-end-start-process.service";

@ApiTags("day-end-start-process")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("day-end-start-process")
export class DayEndStartProcessController {
  constructor(
    private readonly dayEndStartProcessService: DayEndStartProcessService,
  ) {}

  @Post("start")
  @ApiOperation({
    summary: "Start the current day and save the checklist answers",
  })
  async startDay(@Body() dto: CompleteDayEndDto, @Session() session: any) {
    const canSelectWorkplace = Boolean(
      session?.isAdmin || session?.isHo || session?.isHoStaff,
    );
    return this.dayEndStartProcessService.startDay(
      canSelectWorkplace
        ? (dto.branchId ?? "")
        : (session?.activeBranchId ?? ""),
      session?.userId ?? "",
      dto.answers ?? {},
      session?.userId ?? "",
    );
  }

  @Post("complete")
  @ApiOperation({ summary: "Complete the current day-end checklist" })
  async completeDayEnd(
    @Body() dto: CompleteDayEndDto,
    @Session() session: any,
  ) {
    const canSelectWorkplace = Boolean(
      session?.isAdmin || session?.isHo || session?.isHoStaff,
    );
    return this.dayEndStartProcessService.completeDayEnd(
      canSelectWorkplace
        ? (dto.branchId ?? "")
        : (session?.activeBranchId ?? ""),
      session?.userId ?? "",
      dto.answers ?? {},
      session?.userId ?? "",
    );
  }
}
