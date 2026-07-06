import { Body, Controller, Param, Post, Session, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { RecordTransactionPrintDto } from './dto/record-transaction-print.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

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
