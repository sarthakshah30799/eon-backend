import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Session,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CreditRequestFundService } from "./credit-request-fund.service";
import {
  ApproveCreditRequestFundDto,
  CreateCreditRequestFundDto,
  CreditRequestFundListQueryDto,
  RejectCreditRequestFundDto,
  UpdateCreditRequestFundDto,
} from "./dto/credit-request-fund.dto";

@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@ApiTags("credit-request-fund")
@Controller("credit-request-fund")
export class CreditRequestFundController {
  constructor(private readonly service: CreditRequestFundService) {}

  @Post()
  @ApiOperation({ summary: "Create Credit Request Fund" })
  create(@Body() dto: CreateCreditRequestFundDto, @Session() session: any) {
    return this.service.create(dto, session);
  }

  @Get()
  list(
    @Query() query: CreditRequestFundListQueryDto,
    @Session() session: any,
  ) {
    return this.service.list(query, session);
  }

  @Get("next-number")
  next(@Query("branchId") branchId: string, @Session() session: any) {
    return this.service.nextNumber(branchId, session);
  }

  @Get(":id")
  find(@Param("id", ParseUUIDPipe) id: string, @Session() session: any) {
    return this.service.findById(id, session);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCreditRequestFundDto,
    @Session() session: any,
  ) {
    return this.service.update(id, dto, session);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel pending Credit Request Fund" })
  cancel(@Param("id", ParseUUIDPipe) id: string, @Session() session: any) {
    return this.service.cancel(id, session);
  }

  @Post(":id/approve")
  @ApiOperation({ summary: "HO approve Credit Request Fund" })
  approve(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ApproveCreditRequestFundDto,
    @Session() session: any,
  ) {
    return this.service.approve(id, dto, session);
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "HO reject Credit Request Fund" })
  reject(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectCreditRequestFundDto,
    @Session() session: any,
  ) {
    return this.service.reject(id, dto, session);
  }
}
