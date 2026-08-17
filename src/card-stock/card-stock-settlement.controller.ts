import { Body, Controller, Get, Param, Post, Query, Session, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuthenticatedSession } from '../auth/types/session-context';
import {
  CancelCardStockSettlementDocumentDto,
  CardStockSettlementDocumentQueryDto,
  CardStockUnsettledQueryDto,
  CreateCardStockSettlementDocumentDto,
  RejectCardStockSettlementDocumentDto,
} from './dto/card-stock-settlement.dto';
import { CardStockSettlementService } from './card-stock-settlement.service';

@ApiTags('card-stock-settlements')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('card-stock/settlements')
export class CardStockSettlementController {
  constructor(private readonly settlementService: CardStockSettlementService) {}

  @Get()
  @ApiOperation({ summary: 'List CARD settlement documents' })
  list(@Query() query: CardStockSettlementDocumentQueryDto, @Session() session: AuthenticatedSession) {
    return this.settlementService.list(query, session);
  }

  @Get('unsettled')
  @ApiOperation({ summary: 'List unsettled CARD items for settlement create' })
  listUnsettled(@Query() query: CardStockUnsettledQueryDto, @Session() session: AuthenticatedSession) {
    return this.settlementService.listUnsettled(query, session);
  }

  @Post()
  @ApiOperation({ summary: 'Create a CARD settlement document' })
  create(@Body() dto: CreateCardStockSettlementDocumentDto, @Session() session: AuthenticatedSession) {
    return this.settlementService.create(dto, session);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a CARD settlement document' })
  get(@Param('id') id: string, @Session() session: AuthenticatedSession) {
    return this.settlementService.get(id, session);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept a pending branch CARD settlement' })
  accept(@Param('id') id: string, @Session() session: AuthenticatedSession) {
    return this.settlementService.accept(id, session);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a pending branch CARD settlement' })
  reject(@Param('id') id: string, @Body() dto: RejectCardStockSettlementDocumentDto, @Session() session: AuthenticatedSession) {
    return this.settlementService.reject(id, dto, session);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an unposted branch CARD settlement' })
  cancel(@Param('id') id: string, @Body() dto: CancelCardStockSettlementDocumentDto, @Session() session: AuthenticatedSession) {
    return this.settlementService.cancel(id, dto, session);
  }
}
