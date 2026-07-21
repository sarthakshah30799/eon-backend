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
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { TransactionsService } from './transactions.service';

@ApiTags('other-transaction')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard)
@Controller('transactions/other')
export class OtherTransactionController {
  constructor(private readonly service: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an other transaction' })
  async create(@Body() body: Record<string, any>, @Session() session: any) {
    const performedById = session?.userId ?? null;
    return this.service.createOtherTransaction(body, performedById, session?.activeBranchId ?? null);
  }

  @Get()
  @ApiOperation({ summary: 'List other transactions' })
  async findAll(
    @Session() session: any,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
  ) {
    const canSeeAllBranches = Boolean(session?.isAdmin || session?.isHoStaff);
    const effectiveBranchId = canSeeAllBranches
      ? branchId?.trim() || undefined
      : session?.activeBranchId;

    return this.service.findAllOtherTransactions({ branchId: effectiveBranchId, search });
  }

  @Get('agents')
  @ApiOperation({ summary: 'List agents available for other transactions' })
  async getAgents(
    @Session() session: any,
    @Query('search') search?: string,
  ) {
    return this.service.getOtherTransactionAgents(session?.activeBranchId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an other transaction by ID' })
  async findOne(@Param('id') id: string) {
    return this.service.findOtherTransaction(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an other transaction' })
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
    @Session() session: any,
  ) {
    const performedById = session?.userId ?? null;
    return this.service.updateOtherTransaction(id, body, performedById, session?.activeBranchId ?? null);
  }
}
