import { Body, Controller, ForbiddenException, Get, Param, Post, Session, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CreateCardStockReceiptDto } from './dto/card-stock-receipt.dto';
import { CardStockService } from './card-stock.service';

@ApiTags('card-stock')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard)
@Controller('card-stock/receipts')
export class CardStockController {
  constructor(private readonly cardStockService: CardStockService) {}

  @Get()
  @ApiOperation({ summary: 'List CARD stock receipts' })
  findAll(@Session() session: any) {
    const branchId = session?.isAdmin || session?.isHo || session?.isHoStaff ? undefined : session?.activeBranchId;
    return this.cardStockService.findAll(branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get CARD stock receipt' })
  findById(@Param('id') id: string) { return this.cardStockService.findById(id); }

  @Post()
  @ApiOperation({ summary: 'Create CARD stock receipt' })
  create(@Body() dto: CreateCardStockReceiptDto, @Session() session: any) {
    if (!session?.userId || (!session?.isAdmin && !session?.isHo && !session?.isHoStaff)) throw new ForbiddenException('Only HO/Admin users can create CARD stock receipts');
    return this.cardStockService.create(dto, session.userId);
  }
}
