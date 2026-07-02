import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Session } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { ChequeBookService } from './chequebook.service';
import { CreateChequeBookDto, ApproveRejectChequeBookDto, BulkReviewChequeBooksDto, SaveChequeBookAllocationsDto } from './dto/chequebook.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@ApiTags('chequebooks')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('chequebooks')
export class ChequeBookController {
  constructor(private readonly service: ChequeBookService) {}

  @Post('dispatch')
  @ApiOperation({ summary: 'Create check book dispatch' })
  @ApiResponse({ status: 201, description: 'Dispatch created successfully' })
  async create(@Body() dto: CreateChequeBookDto, @Session() session: any) {
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
  @ApiOperation({ summary: 'Get all check book dispatches' })
  @ApiResponse({ status: 200, description: 'List of dispatches' })
  async findAll(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('transactionType') transactionType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.service.findAll(branchId, status, transactionType, fromDate, toDate);
  }

  @Get('cashiers')
  @ApiOperation({ summary: 'Get cashiers for a branch' })
  async getCashiers(@Query('branchId') branchId: string) {
    return [
      { id: '9a4c4e78-98e3-470a-bd63-a5b67cdde901', name: 'sonali' },
      { id: '9a4c4e78-98e3-470a-bd63-a5b67cdde902', name: 'sajipy' },
    ];
  }

  @Put('dispatches/bulk-review')
  @ApiOperation({ summary: 'Bulk approve or reject check book dispatches' })
  @ApiResponse({ status: 200, description: 'Dispatches reviewed successfully' })
  async bulkReview(
    @Body() dto: BulkReviewChequeBooksDto,
    @Session() session: any,
  ) {
    return this.service.bulkReview(dto, session.userId);
  }

  @Put('dispatches/:id/approve')
  @ApiOperation({ summary: 'Approve or Reject check book dispatch' })
  @ApiParam({ name: 'id', description: 'Dispatch UUID' })
  @ApiResponse({ status: 200, description: 'Dispatch updated successfully' })
  async approveOrReject(
    @Param('id') id: string,
    @Body() dto: ApproveRejectChequeBookDto,
    @Session() session: any,
  ) {
    return this.service.approveOrReject(id, dto, session.userId);
  }

  @Post('allocations')
  @ApiOperation({ summary: 'Save check book cashier allocations' })
  @ApiResponse({ status: 201, description: 'Allocations saved successfully' })
  async saveAllocations(
    @Body() dto: SaveChequeBookAllocationsDto,
    @Session() session: any,
  ) {
    return this.service.saveAllocations(dto, session.userId);
  }

  @Get('allocations')
  @ApiOperation({ summary: 'Get check book allocations by book IDs' })
  @ApiResponse({ status: 200, description: 'List of allocations' })
  async getAllocations(@Query('checkBookIds') idsStr: string) {
    const ids = idsStr ? idsStr.split(',') : [];
    return this.service.getAllocationsByBookIds(ids);
  }
}
