import {
  BadRequestException,
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
import { TransfersService } from "./transfers.service";
import { CurrencyTransferType } from "./transfers.enums";
import { CreateTransferRequestPayload } from "./dto/transfer-request.dto";
import { RecordTransferPrintDto } from "./dto/record-transfer-print.dto";
import { TransferListQueryDto } from "./dto/transfer-list-query.dto";
import { CurrencyTransfer } from "./entities";
import { PaginatedResponseDto } from "../common/pagination";

@ApiTags("transfers")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  @ApiOperation({ summary: "List currency transfers" })
  async findAll(
    @Session() session: any,
    @Query() query: TransferListQueryDto,
  ): Promise<PaginatedResponseDto<CurrencyTransfer>> {
    return this.transfersService.findAll({
      transferType: query.transferType,
      status: query.status,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
      branchId:
        session?.isAdmin || session?.isHoStaff
          ? undefined
          : session?.activeBranchId,
      counterId:
        session?.isAdmin || session?.isHoStaff
          ? undefined
          : session?.activeCounterId,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get currency transfer by ID" })
  async findById(@Param("id") id: string): Promise<CurrencyTransfer> {
    return this.transfersService.findById(id);
  }

  @Post("counter")
  @ApiOperation({ summary: "Create a counter transfer hold" })
  async createCounterTransfer(
    @Body() body: CreateTransferRequestPayload,
    @Session() session: any,
  ): Promise<CurrencyTransfer> {
    return this.transfersService.createHold(
      { ...body, transferType: CurrencyTransferType.COUNTER },
      session?.userId,
      session?.activeBranchId ?? null,
      session?.activeCounterId ?? null,
      Boolean(session?.isAdmin),
      Boolean(session?.isHoStaff),
    );
  }

  @Post("branch")
  @ApiOperation({ summary: "Create a branch transfer hold" })
  async createBranchTransfer(
    @Body() body: CreateTransferRequestPayload,
    @Session() session: any,
  ): Promise<CurrencyTransfer> {
    return this.transfersService.createHold(
      { ...body, transferType: CurrencyTransferType.BRANCH },
      session?.userId,
      session?.activeBranchId ?? null,
      session?.activeCounterId ?? null,
      Boolean(session?.isAdmin),
      Boolean(session?.isHoStaff),
    );
  }

  @Post(":id/accept")
  @ApiOperation({ summary: "Accept a held transfer" })
  async acceptTransfer(
    @Param("id") id: string,
    @Session() session: any,
  ): Promise<CurrencyTransfer> {
    if (!session?.userId) {
      throw new BadRequestException("User session not found");
    }

    return this.transfersService.acceptTransfer(
      id,
      session.userId,
      session?.activeBranchId ?? null,
      session?.activeCounterId ?? null,
      Boolean(session?.isAdmin),
      Boolean(session?.isHoStaff),
    );
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "Reject a held transfer" })
  async rejectTransfer(
    @Param("id") id: string,
    @Body() body: { remarks?: string | null },
    @Session() session: any,
  ): Promise<CurrencyTransfer> {
    if (!session?.userId) {
      throw new BadRequestException("User session not found");
    }

    return this.transfersService.rejectTransfer(
      id,
      session.userId,
      body?.remarks ?? null,
      session?.activeBranchId ?? null,
      session?.activeCounterId ?? null,
      Boolean(session?.isAdmin),
      Boolean(session?.isHoStaff),
    );
  }

  @Post(":id/print")
  @ApiOperation({
    summary: "Record a transfer print and optionally send the copy by email",
  })
  async recordPrint(
    @Param("id") id: string,
    @Body() dto: RecordTransferPrintDto,
    @Session() session: any,
  ): Promise<{ message: string }> {
    return this.transfersService.recordPrint(
      id,
      dto,
      session?.userId ?? null,
      session?.activeBranchId ?? null,
      session?.activeCounterId ?? null,
      Boolean(session?.isAdmin),
      Boolean(session?.isHoStaff),
    );
  }
}
