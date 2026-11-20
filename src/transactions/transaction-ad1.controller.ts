import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Post,
  Query,
  Session,
  UseGuards,
} from "@nestjs/common";
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { TransactionAd1Service } from "./transaction-ad1.service";
import { TransactionAd1ListQueryDto } from "./dto/transaction-ad1-list-query.dto";
import {
  CreateTransactionAd1Dto,
  UpdateTransactionAd1Dto,
} from "./dto/create-transaction-ad1.dto";
import { PaginatedResponseDto } from "../common/pagination";
import { TransactionAd1 } from "./entities/transaction-ad1.entity";

@ApiTags("transaction-ad1")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("transactions/ad1")
export class TransactionAd1Controller {
  constructor(private readonly ad1Service: TransactionAd1Service) {}

  @Post()
  @ApiOperation({ summary: "Create an AD1 transaction" })
  @ApiBody({ type: CreateTransactionAd1Dto })
  async create(@Body() body: Record<string, any>, @Session() session: any) {
    const performedById = session?.userId ?? null;
    const canSelectWorkplace = Boolean(session?.isAdmin || session?.isHoStaff);
    const effectiveBranchId = canSelectWorkplace
      ? (body?.branchId?.trim() || session?.activeBranchId) ?? null
      : session?.activeBranchId ?? null;
    const effectiveCounterId = canSelectWorkplace
      ? (body?.counterId?.trim() || session?.activeCounterId) ?? null
      : session?.activeCounterId ?? null;

    return this.ad1Service.create(
      body as any,
      performedById,
      effectiveBranchId,
      effectiveCounterId,
    );
  }

  @Get()
  @ApiOperation({ summary: "List AD1 transactions" })
  async findAll(
    @Session() session: any,
    @Query() query: TransactionAd1ListQueryDto,
  ): Promise<PaginatedResponseDto<TransactionAd1>> {
    const canSeeAllBranches = Boolean(session?.isAdmin || session?.isHoStaff);
    const effectiveBranchId = canSeeAllBranches
      ? query.branchId?.trim() || undefined
      : session?.activeBranchId;

    return this.ad1Service.findAll({
      ...query,
      branchId: effectiveBranchId,
    });
  }

  @Get("agents")
  @ApiOperation({ summary: "List agents available for AD1" })
  async getAgents(
    @Session() session: any,
    @Query("branchId") branchId?: string,
    @Query("search") search?: string,
  ) {
    const effectiveBranchId =
      session?.isAdmin || session?.isHoStaff
        ? branchId?.trim() || undefined
        : session?.activeBranchId;
    return this.ad1Service.getAgents({ branchId: effectiveBranchId, search });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an AD1 transaction by ID" })
  async findOne(@Param("id") id: string) {
    return this.ad1Service.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update an AD1 transaction" })
  @ApiBody({ type: UpdateTransactionAd1Dto })
  async update(
    @Param("id") id: string,
    @Body() body: Record<string, any>,
    @Session() session: any,
  ) {
    const performedById = session?.userId ?? null;
    const canSelectWorkplace = Boolean(session?.isAdmin || session?.isHoStaff);
    const effectiveBranchId = canSelectWorkplace
      ? (body?.branchId?.trim() || session?.activeBranchId) ?? null
      : session?.activeBranchId ?? null;
    const effectiveCounterId = canSelectWorkplace
      ? (body?.counterId?.trim() || session?.activeCounterId) ?? null
      : session?.activeCounterId ?? null;

    return this.ad1Service.update(
      id,
      body as any,
      performedById,
      effectiveBranchId,
      effectiveCounterId,
    );
  }

  @Post(":id/print")
  @ApiOperation({
    summary: "Record an AD1 print and return Original or Duplicate",
  })
  async recordPrint(@Param("id") id: string) {
    return this.ad1Service.recordPrint(id);
  }
}
