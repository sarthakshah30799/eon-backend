import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Session,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { AdvanceRefundService } from "./advance-refund.service";
import {
  AdvanceRefundQueryDto,
  AvailableAdvanceForRefundQueryDto,
} from "./dto/advance-refund-query.dto";
import { CreateAdvanceRefundDto } from "./dto/create-advance-refund.dto";
import { HonourAdvanceRefundDto } from "./dto/honour-advance-refund.dto";

@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@ApiTags("advance-refunds")
@Controller("advance-refunds")
export class AdvanceRefundController {
  constructor(private readonly service: AdvanceRefundService) {}

  @Post()
  @ApiOperation({ summary: "Create Advance Refund / Knock Off" })
  create(@Body() dto: CreateAdvanceRefundDto, @Session() session: any) {
    return this.service.create(dto, session);
  }

  @Post(":id/honour")
  @ApiOperation({ summary: "Honour Advance Refund by Head Office" })
  honour(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: HonourAdvanceRefundDto,
    @Session() session: any,
  ) {
    return this.service.honour(id, dto, session);
  }

  @Get()
  @ApiOperation({ summary: "List Advance Refunds" })
  findAll(@Query() query: AdvanceRefundQueryDto, @Session() session: any) {
    return this.service.findAll(query, session);
  }

  @Get("available-advances")
  @ApiOperation({ summary: "List available advance receipts for refund" })
  getAvailableAdvances(
    @Query() query: AvailableAdvanceForRefundQueryDto,
    @Session() session: any,
  ) {
    return this.service.getAvailableAdvances(query, session);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Advance Refund Details" })
  findById(@Param("id", ParseUUIDPipe) id: string, @Session() session: any) {
    return this.service.findById(id, session);
  }
}
