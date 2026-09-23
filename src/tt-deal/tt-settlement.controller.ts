import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Session,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { AuthenticatedSession } from "../auth/types/session-context";
import {
  CancelTtSettlementDocumentDto,
  CreateTtSettlementDocumentDto,
  RejectTtSettlementDocumentDto,
  TtSettlementDocumentQueryDto,
  TtSettlementUnsettledQueryDto,
} from "./dto/tt-settlement.dto";
import { TtSettlementService } from "./tt-settlement.service";

@ApiTags("tt-deal-settlements")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("tt-deal/settlements")
export class TtSettlementController {
  constructor(private readonly settlementService: TtSettlementService) {}

  @Get()
  @ApiOperation({ summary: "List TT settlement documents" })
  list(
    @Query() query: TtSettlementDocumentQueryDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.settlementService.list(query, session);
  }

  @Get("unsettled")
  @ApiOperation({ summary: "List unsettled TT items for settlement create" })
  listUnsettled(
    @Query() query: TtSettlementUnsettledQueryDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.settlementService.listUnsettled(query, session);
  }

  @Post()
  @ApiOperation({ summary: "Create a TT settlement document" })
  create(
    @Body() dto: CreateTtSettlementDocumentDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.settlementService.create(dto, session);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a TT settlement document" })
  get(@Param("id") id: string, @Session() session: AuthenticatedSession) {
    return this.settlementService.get(id, session);
  }

  @Post(":id/accept")
  @ApiOperation({ summary: "Accept a pending branch TT settlement" })
  accept(@Param("id") id: string, @Session() session: AuthenticatedSession) {
    return this.settlementService.accept(id, session);
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "Reject a pending branch TT settlement" })
  reject(
    @Param("id") id: string,
    @Body() dto: RejectTtSettlementDocumentDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.settlementService.reject(id, dto, session);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel an unposted branch TT settlement" })
  cancel(
    @Param("id") id: string,
    @Body() dto: CancelTtSettlementDocumentDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.settlementService.cancel(id, dto, session);
  }
}
