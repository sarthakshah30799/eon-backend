import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Session, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { AvailableAdvanceQueryDto, CreateJournalVoucherDto, CreatePaymentVoucherDto, CreateReceiptVoucherDto, VoucherListQueryDto } from "./dto/voucher.dto";
import { VoucherType } from "./voucher.enums";
import { VoucherService } from "./voucher.service";

@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@ApiTags("receipts")
@Controller("receipts")
export class ReceiptVoucherController {
  constructor(private readonly service: VoucherService) {}
  @Post() @ApiOperation({ summary: "Create immutable Receipt voucher" }) create(@Body() dto: CreateReceiptVoucherDto, @Session() session: any) { return this.service.create(VoucherType.RECEIPT, dto, session); }
  @Get() list(@Query() query: VoucherListQueryDto, @Session() session: any) { return this.service.list(VoucherType.RECEIPT, query, session); }
  @Get("next-number") next(@Query("branchId") branchId: string, @Session() session: any) { return this.service.nextNumber(VoucherType.RECEIPT, branchId, session); }
  @Get("available-advances") available(@Query() query: AvailableAdvanceQueryDto, @Session() session: any) { return this.service.available(VoucherType.RECEIPT, query, session); }
  @Get(":id") find(@Param("id", ParseUUIDPipe) id: string, @Session() session: any) { return this.service.findById(VoucherType.RECEIPT, id, session); }
}

@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@ApiTags("payments")
@Controller("payments")
export class PaymentVoucherController {
  constructor(private readonly service: VoucherService) {}
  @Post() @ApiOperation({ summary: "Create immutable Payment voucher" }) create(@Body() dto: CreatePaymentVoucherDto, @Session() session: any) { return this.service.create(VoucherType.PAYMENT, dto, session); }
  @Get() list(@Query() query: VoucherListQueryDto, @Session() session: any) { return this.service.list(VoucherType.PAYMENT, query, session); }
  @Get("next-number") next(@Query("branchId") branchId: string, @Session() session: any) { return this.service.nextNumber(VoucherType.PAYMENT, branchId, session); }
  @Get("available-advances") available(@Query() query: AvailableAdvanceQueryDto, @Session() session: any) { return this.service.available(VoucherType.PAYMENT, query, session); }
  @Get(":id") find(@Param("id", ParseUUIDPipe) id: string, @Session() session: any) { return this.service.findById(VoucherType.PAYMENT, id, session); }
}

@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@ApiTags("journal-vouchers")
@Controller("journal-vouchers")
export class JournalVoucherController {
  constructor(private readonly service: VoucherService) {}
  @Post() @ApiOperation({ summary: "Create immutable Journal voucher" }) create(@Body() dto: CreateJournalVoucherDto, @Session() session: any) { return this.service.create(VoucherType.JOURNAL, dto, session); }
  @Get() list(@Query() query: VoucherListQueryDto, @Session() session: any) { return this.service.list(VoucherType.JOURNAL, query, session); }
  @Get("next-number") next(@Query("branchId") branchId: string, @Session() session: any) { return this.service.nextNumber(VoucherType.JOURNAL, branchId, session); }
  @Get(":id") find(@Param("id", ParseUUIDPipe) id: string, @Session() session: any) { return this.service.findById(VoucherType.JOURNAL, id, session); }
}
