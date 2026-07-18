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
import { TransactionAd1Service } from './transaction-ad1.service';

@ApiTags('transaction-ad1')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard)
@Controller('transactions/ad1')
export class TransactionAd1Controller {
  constructor(private readonly ad1Service: TransactionAd1Service) {}

  @Post()
  @ApiOperation({ summary: 'Create an AD1 transaction' })
  async create(@Body() body: Record<string, any>, @Session() session: any) {
    const performedById = session?.userId ?? null;
    return this.ad1Service.create(body, performedById, session?.activeBranchId ?? null);
  }

  @Get()
  @ApiOperation({ summary: 'List AD1 transactions' })
  async findAll(
    @Session() session: any,
    @Query('search') search?: string,
  ) {
    const effectiveBranchId = session?.activeBranchId;

    return this.ad1Service.findAll({ branchId: effectiveBranchId, search });
  }

  @Get('agents')
  @ApiOperation({ summary: 'List agents available for AD1' })
  async getAgents(
    @Session() session: any,
    @Query('search') search?: string,
  ) {
    return this.ad1Service.getAgents({ branchId: session?.activeBranchId, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an AD1 transaction by ID' })
  async findOne(@Param('id') id: string) {
    return this.ad1Service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an AD1 transaction' })
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
    @Session() session: any,
  ) {
    const performedById = session?.userId ?? null;
    return this.ad1Service.update(id, body, performedById, session?.activeBranchId ?? null);
  }
}
