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
  CancelProductSettlementDocumentDto,
  ProductSettlementDocumentQueryDto,
  ProductUnsettledQueryDto,
  CreateProductSettlementDocumentDto,
  RejectProductSettlementDocumentDto,
} from "./dto/product-settlement.dto";
import { ProductSettlementService } from "./product-settlement.service";

@ApiTags("product-settlements")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("product-settlements")
export class ProductSettlementController {
  constructor(private readonly settlementService: ProductSettlementService) {}

  @Get()
  @ApiOperation({ summary: "List CARD settlement documents" })
  list(
    @Query() query: ProductSettlementDocumentQueryDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.settlementService.list(query, session);
  }

  @Get("unsettled")
  @ApiOperation({ summary: "List unsettled CARD items for settlement create" })
  listUnsettled(
    @Query() query: ProductUnsettledQueryDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.settlementService.listUnsettled(query, session);
  }

  @Post()
  @ApiOperation({ summary: "Create a CARD settlement document" })
  create(
    @Body() dto: CreateProductSettlementDocumentDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.settlementService.create(dto, session);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a CARD settlement document" })
  get(@Param("id") id: string, @Session() session: AuthenticatedSession) {
    return this.settlementService.get(id, session);
  }

  @Post(":id/accept")
  @ApiOperation({ summary: "Accept a pending branch CARD settlement" })
  accept(@Param("id") id: string, @Session() session: AuthenticatedSession) {
    return this.settlementService.accept(id, session);
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "Reject a pending branch CARD settlement" })
  reject(
    @Param("id") id: string,
    @Body() dto: RejectProductSettlementDocumentDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.settlementService.reject(id, dto, session);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel an unposted branch CARD settlement" })
  cancel(
    @Param("id") id: string,
    @Body() dto: CancelProductSettlementDocumentDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.settlementService.cancel(id, dto, session);
  }
}
