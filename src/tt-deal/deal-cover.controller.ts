import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
  ApproveDealCoverDto,
  CreateDealCoverDto,
  RejectDealCoverDto,
  DealCoverAckListQueryDto,
  DealCoverListQueryDto,
  UpdateDealCoverDto,
} from "./dto/deal-cover.dto";
import { DealCoverService } from "./deal-cover.service";

@ApiTags("deal-covers")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("deal-covers")
export class DealCoverController {
  constructor(private readonly coverService: DealCoverService) {}

  @Post()
  @ApiOperation({ summary: "Create a deal cover" })
  create(
    @Body() dto: CreateDealCoverDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.coverService.create(dto, session);
  }

  @Get()
  @ApiOperation({ summary: "List deal covers" })
  list(
    @Query() query: DealCoverListQueryDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.coverService.list(query, session);
  }

  @Get("ack")
  @ApiOperation({
    summary: "List deal covers for acknowledgement with currency aggregates",
  })
  listForAck(
    @Query() query: DealCoverAckListQueryDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.coverService.listForAck(query, session);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a deal cover" })
  get(@Param("id") id: string, @Session() session: AuthenticatedSession) {
    return this.coverService.get(id, session);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a PENDING deal cover" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateDealCoverDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.coverService.update(id, dto, session);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel a PENDING deal cover" })
  cancel(@Param("id") id: string, @Session() session: AuthenticatedSession) {
    return this.coverService.cancel(id, session);
  }

  @Post(":id/approve")
  @ApiOperation({ summary: "Approve a PENDING deal cover" })
  approve(
    @Param("id") id: string,
    @Body() dto: ApproveDealCoverDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.coverService.approve(id, dto, session);
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "Reject a PENDING deal cover" })
  reject(
    @Param("id") id: string,
    @Body() dto: RejectDealCoverDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.coverService.reject(id, dto, session);
  }
}
