import { Body, Controller, Get, Param, Post, Query, Session, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { RecordTransactionPrintDto } from './dto/record-transaction-print.dto';
import { TransactionsService } from './transactions.service';
import { Transaction } from './entities/transaction.entity';

@ApiTags('transactions')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get transactions filtered by slug and current branch' })
  @ApiResponse({ status: 200, description: 'List of transactions', type: [Transaction] })
  async getTransactions(
    @Session() session: any,
    @Query('slug') slug?: string,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
  ): Promise<Transaction[]> {
    const effectiveBranchId =
      session?.isAdmin || session?.isHoStaff ? branchId || session?.activeBranchId : session?.activeBranchId;
    return this.transactionsService.getTransactions(slug, effectiveBranchId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({ status: 200, description: 'Transaction details', type: Transaction })
  async getTransactionById(@Param('id') id: string): Promise<Transaction | null> {
    return this.transactionsService.getTransactionById(id);
  }

  @Post(':id/print')
  @ApiOperation({ summary: 'Record a purchase print and optionally send the customer copy by email' })
  @ApiResponse({ status: 201, description: 'Print recorded successfully' })
  async recordPrint(
    @Param('id') transactionId: string,
    @Body() dto: RecordTransactionPrintDto,
    @Session() session: any,
  ): Promise<{ message: string; messageId?: string }> {
    return this.transactionsService.recordPrint(transactionId, dto, session?.userId ?? null);
  }
}
