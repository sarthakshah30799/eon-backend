import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Session } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { ManualBillBookService } from './manual-bill-book.service';
import { CreateManualBookDto, ApproveRejectManualBookDto } from './dto/manual-bill-book.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@ApiTags('manual-bill-books')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('manual-bill-books')
export class ManualBillBookController {
  constructor(private readonly service: ManualBillBookService) {}

  @Post('dispatch')
  @ApiOperation({ summary: 'Create manual bill book dispatch' })
  @ApiResponse({ status: 201, description: 'Dispatch created successfully' })
  async create(@Body() dto: CreateManualBookDto, @Session() session: any) {
    return this.service.create(dto, session.userId);
  }

  @Get('next-number')
  @ApiOperation({ summary: 'Get next sequence number for branch and date' })
  async getNextNumber(
    @Query('branchId') branchId: string,
    @Query('dispatchDate') dispatchDate: string,
  ) {
    return this.service.getNextNumber(branchId, dispatchDate);
  }

  @Get('dispatches')
  @ApiOperation({ summary: 'Get all manual bill book dispatches' })
  @ApiResponse({ status: 200, description: 'List of dispatches' })
  async findAll(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(branchId, status);
  }

  @Put('dispatches/:id/approve')
  @ApiOperation({ summary: 'Approve or Reject manual bill book dispatch' })
  @ApiParam({ name: 'id', description: 'Dispatch UUID' })
  @ApiResponse({ status: 200, description: 'Dispatch updated successfully' })
  async approveOrReject(
    @Param('id') id: string,
    @Body() dto: ApproveRejectManualBookDto,
    @Session() session: any,
  ) {
    return this.service.approveOrReject(id, dto, session.userId);
  }
}
