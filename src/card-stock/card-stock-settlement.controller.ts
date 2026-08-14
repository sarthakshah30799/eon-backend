import { Body, Controller, Get, Param, Post, Query, Session, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { AuthenticatedSession } from '../auth/types/session-context';
import { BulkSettleCardStockDto, CancelCardStockSettlementDto, CardStockSettlementQueryDto } from './dto/card-stock-settlement.dto';
import { CardStockSettlementService } from './card-stock-settlement.service';

@ApiTags('card-stock-settlements')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard)
@Controller('card-stock/settlements')
export class CardStockSettlementController {
  constructor(private readonly settlementService: CardStockSettlementService) {}

  @Get()
  @ApiOperation({ summary: 'List CARD issuer settlement items' })
  list(@Query() query: CardStockSettlementQueryDto, @Session() session: AuthenticatedSession) {
    return this.settlementService.list(query, session);
  }

  @Post('bulk-settle')
  @ApiOperation({ summary: 'Settle selected CARD items with issuers' })
  bulkSettle(@Body() dto: BulkSettleCardStockDto, @Session() session: AuthenticatedSession) {
    return this.settlementService.bulkSettle(dto, session);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get CARD issuer settlement item' })
  get(@Param('id') id: string, @Session() session: AuthenticatedSession) {
    return this.settlementService.get(id, session);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending CARD issuer settlement' })
  cancel(@Param('id') id: string, @Body() dto: CancelCardStockSettlementDto, @Session() session: AuthenticatedSession) {
    return this.settlementService.cancel(id, dto.reason, session);
  }
}
