import { Body, Controller, Delete, Get, Param, Post, Put, Query, Session, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CardTransferService } from './card-transfer.service';
import { CardTransferActionDto, CardTransferListQueryDto, CreateCardTransferDto } from './dto/card-transfer.dto';

@ApiTags('card-stock-transfers')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard)
@Controller('card-stock/transfers')
export class CardTransferController {
  constructor(private readonly service: CardTransferService) {}

  @Get()
  @ApiOperation({ summary: 'List CARD transfer requests' })
  list(@Query() query: CardTransferListQueryDto, @Session() session: any) {
    return this.service.list(session, query);
  }

  @Get('available-cards')
  @ApiOperation({ summary: 'List available CARD stock for transfer' })
  availableCards(@Query('sourceBranchId') sourceBranchId: string, @Session() session: any) {
    return this.service.availableCards(sourceBranchId, session);
  }

  @Get(':id')
  get(@Param('id') id: string, @Session() session: any) {
    return this.service.findById(id, session);
  }

  @Post()
  create(@Body() dto: CreateCardTransferDto, @Session() session: any) {
    return this.service.create(dto, session);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CreateCardTransferDto, @Session() session: any) {
    return this.service.update(id, dto, session);
  }

  @Post(':id/accept')
  accept(@Param('id') id: string, @Session() session: any) {
    return this.service.accept(id, session);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: CardTransferActionDto, @Session() session: any) {
    return this.service.reject(id, dto.remarks, session);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CardTransferActionDto, @Session() session: any) {
    return this.service.cancel(id, dto.remarks, session);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Session() session: any) {
    return this.service.cancel(id, 'Deleted by authorized user', session);
  }
}
