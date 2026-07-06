import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Session, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { ChequeBookService } from './chequebook.service';
import { CreateChequeBookDto, ApproveRejectChequeBookDto, BulkReviewChequeBooksDto, SaveChequeBookAssignmentsDto, UpdatePageStatusDto, ReturnPagesDto } from './dto/chequebook.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@ApiTags('chequebooks')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('chequebooks')
export class ChequeBookController {
  private readonly logger = new Logger(ChequeBookController.name);

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
    @Session() session: any,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('bankAccountCode') bankAccountCode?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    let effectiveBranchId = branchId;
    if (!session.isAdmin) {
      effectiveBranchId = session.activeBranchId;
    }
    return this.service.findAll(effectiveBranchId, status, bankAccountCode, fromDate, toDate);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get authorized users for check book allocation' })
  async getAuthorizedUsers(
    @Session() session: any,
    @Query('branchId') branchId: string,
  ) {
    let effectiveBranchId = branchId;
    if (!session.isAdmin) {
      effectiveBranchId = session.activeBranchId;
    }
    this.logger.log(
      `[DEBUG] users request userId=${session?.userId ?? 'unknown'} isAdmin=${Boolean(session?.isAdmin)} isHoStaff=${Boolean(session?.isHoStaff)} branchId=${branchId ?? 'null'} activeBranchId=${session?.activeBranchId ?? 'null'} effectiveBranchId=${effectiveBranchId ?? 'null'}`
    );
    return this.service.getAuthorizedUsers(effectiveBranchId);
  }

  @Get('branch-managers')
  @ApiOperation({ summary: 'Get branch managers for a branch' })
  async getBranchManagers(
    @Session() session: any,
    @Query('branchId') branchId: string,
  ) {
    let effectiveBranchId = branchId;
    if (!session.isAdmin && !session.isHoStaff) {
      effectiveBranchId = session.activeBranchId;
    }
    this.logger.log(
      `[DEBUG] branch-managers request userId=${session?.userId ?? 'unknown'} isAdmin=${Boolean(session?.isAdmin)} isHoStaff=${Boolean(session?.isHoStaff)} branchId=${branchId ?? 'null'} effectiveBranchId=${effectiveBranchId ?? 'null'}`
    );
    return this.service.getBranchManagers(effectiveBranchId);
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

  @Post('assignments')
  @ApiOperation({ summary: 'Save check book page assignments' })
  @ApiResponse({ status: 201, description: 'Assignments saved successfully' })
  async saveAssignments(
    @Body() dto: SaveChequeBookAssignmentsDto,
    @Session() session: any,
  ) {
    return this.service.saveAssignments(dto, session.userId);
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Get check book page assignments by book IDs' })
  @ApiResponse({ status: 200, description: 'List of assignments' })
  async getAssignments(@Query('checkBookIds') idsStr: string) {
    const ids = idsStr ? idsStr.split(',') : [];
    return this.service.getAssignmentsByBookIds(ids);
  }

  @Get(':checkBookId/books/:bookNo/pages')
  @ApiOperation({ summary: 'Get pages for a book number' })
  @ApiResponse({ status: 200, description: 'List of pages' })
  async getPagesByBookNo(
    @Param('checkBookId') checkBookId: string,
    @Param('bookNo') bookNoStr: string,
  ) {
    const bookNo = parseInt(bookNoStr, 10);
    return this.service.getPagesByBookNo(checkBookId, bookNo);
  }

  @Put('pages/status')
  @ApiOperation({ summary: 'Update page status (Void)' })
  @ApiResponse({ status: 200, description: 'Pages updated' })
  async updatePagesStatus(
    @Body() dto: UpdatePageStatusDto,
    @Session() session: any,
  ) {
    return this.service.updatePagesStatus(dto, session.userId);
  }

  @Post('pages/return')
  @ApiOperation({ summary: 'Return pages (delete from database)' })
  @ApiResponse({ status: 200, description: 'Pages returned' })
  async returnPages(@Body() dto: ReturnPagesDto) {
    return this.service.returnPages(dto);
  }

  @Get('pages/search')
  @ApiOperation({ summary: 'Search page status' })
  @ApiResponse({ status: 200, description: 'Page tracking status' })
  async searchPage(
    @Session() session: any,
    @Query('pageNo') pageNoStr: string,
  ) {
    const pageNo = parseInt(pageNoStr, 10);
    const branchId = !session.isAdmin ? session.activeBranchId : undefined;
    return this.service.searchPage(pageNo, branchId);
  }

  @Get('pages/selectable')
  @ApiOperation({ summary: 'Get selectable cheque book pages for the current branch, account and assignee' })
  @ApiResponse({ status: 200, description: 'Selectable pages' })
  async getSelectablePages(
    @Session() session: any,
    @Query('branchId') branchId?: string,
    @Query('accountId') accountId?: string,
    @Query('userId') userId?: string,
  ) {
    const effectiveBranchId = !session.isAdmin ? session.activeBranchId : branchId;
    const effectiveUserId = userId || session.userId;
    return this.service.getSelectablePages(
      effectiveBranchId,
      accountId,
      effectiveUserId
    );
  }

  @Get('cashier-return/search')
  @ApiOperation({ summary: 'Search cashier allocated checkbook pages for return' })
  async searchCashierReturn(
    @Session() session: any,
    @Query('bankAccountCode') bankAccountCode: string,
    @Query('bookNo') bookNoStr: string,
    @Query('chequeNoFrom') chequeNoFromStr: string,
    @Query('chequeNoTo') chequeNoToStr: string,
  ) {
    const bookNo = parseInt(bookNoStr, 10);
    const chequeNoFrom = parseInt(chequeNoFromStr, 10);
    const chequeNoTo = parseInt(chequeNoToStr, 10);
    const branchId = session.activeBranchId;
    const currentUserId = session.userId;
    return this.service.searchCashierReturn({
      branchId,
      currentUserId,
      bankAccountCode,
      bookNo,
      chequeNoFrom,
      chequeNoTo,
    });
  }
}
