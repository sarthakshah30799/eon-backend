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
import { AdvanceAdjustmentService } from "./advance-adjustment.service";
import {
  AdvanceAdjustmentQueryDto,
  OutstandingSalesForAdjustmentQueryDto,
} from "./dto/advance-adjustment-query.dto";
import { CreateAdvanceAdjustmentDto } from "./dto/create-advance-adjustment.dto";
import { RecordAdvanceAdjustmentPrintDto } from "./dto/record-advance-adjustment-print.dto";

@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@ApiTags("advance-adjustments")
@Controller("advance-adjustments")
export class AdvanceAdjustmentController {
  constructor(private readonly service: AdvanceAdjustmentService) {}

  @Post()
  @ApiOperation({ summary: "Create Advance Adjustment" })
  create(@Body() dto: CreateAdvanceAdjustmentDto, @Session() session: any) {
    return this.service.create(dto, session);
  }

  @Post(":id/print")
  @ApiOperation({ summary: "Record Advance Adjustment memo print" })
  recordPrint(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RecordAdvanceAdjustmentPrintDto,
    @Session() session: any,
  ) {
    return this.service.recordPrint(id, dto, session);
  }

  @Get()
  @ApiOperation({ summary: "List Advance Adjustments" })
  findAll(
    @Query() query: AdvanceAdjustmentQueryDto,
    @Session() session: any,
  ) {
    return this.service.findAll(query, session);
  }

  @Get("outstanding-sales")
  @ApiOperation({ summary: "List outstanding SALE bills for adjustment" })
  getOutstandingSales(
    @Query() query: OutstandingSalesForAdjustmentQueryDto,
    @Session() session: any,
  ) {
    return this.service.getOutstandingSales(query, session);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Advance Adjustment Details" })
  findById(@Param("id", ParseUUIDPipe) id: string, @Session() session: any) {
    return this.service.findById(id, session);
  }
}
