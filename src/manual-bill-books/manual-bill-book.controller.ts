import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Session,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
} from "@nestjs/swagger";
import { ManualBillBookService } from "./manual-bill-book.service";
import {
  CreateManualBookDto,
  ApproveRejectManualBookDto,
  BulkReviewManualBooksDto,
  AssignPagesDto,
  TransferPagesDto,
  UpdatePageStatusDto,
  ReturnPagesDto,
  ManageDeliveryPersonDto,
  ReassignManualBookDto,
} from "./dto/manual-bill-book.dto";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";

@ApiTags("manual-bill-books")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("manual-bill-books")
export class ManualBillBookController {
  private readonly logger = new Logger(ManualBillBookController.name);

  constructor(private readonly service: ManualBillBookService) {}

  @Post("dispatch")
  @ApiOperation({ summary: "Create manual bill book dispatch" })
  @ApiResponse({ status: 201, description: "Dispatch created successfully" })
  async create(@Body() dto: CreateManualBookDto, @Session() session: any) {
    return this.service.create(dto, session.userId);
  }

  @Get("validate-book-range")
  @ApiOperation({ summary: "Validate if book number range overlaps" })
  async validateBookRange(
    @Query("bookNoFrom") bookNoFromStr: string,
    @Query("bookNoTo") bookNoToStr: string,
  ) {
    const bookNoFrom = parseInt(bookNoFromStr, 10);
    const bookNoTo = parseInt(bookNoToStr, 10);
    if (isNaN(bookNoFrom) || isNaN(bookNoTo)) {
      return { valid: true };
    }
    return this.service.validateBookRange(bookNoFrom, bookNoTo);
  }

  @Get("validate-page-range")
  @ApiOperation({ summary: "Validate if page number range overlaps" })
  async validatePageRange(
    @Query("mvNoFrom") mvNoFromStr: string,
    @Query("mvNoTo") mvNoToStr: string,
  ) {
    const mvNoFrom = parseInt(mvNoFromStr, 10);
    const mvNoTo = parseInt(mvNoToStr, 10);
    if (isNaN(mvNoFrom) || isNaN(mvNoTo)) {
      return { valid: true };
    }
    return this.service.validatePageRange(mvNoFrom, mvNoTo);
  }

  @Get("next-number")
  @ApiOperation({ summary: "Get next sequence number for branch and date" })
  async getNextNumber(
    @Query("branchId") branchId: string,
    @Query("dispatchDate") dispatchDate: string,
  ) {
    return this.service.getNextNumber(branchId, dispatchDate);
  }

  @Get("dispatches")
  @ApiOperation({ summary: "Get all manual bill book dispatches" })
  @ApiResponse({ status: 200, description: "List of dispatches" })
  async findAll(
    @Session() session: any,
    @Query("branchId") branchId?: string,
    @Query("status") status?: string,
    @Query("transactionType") transactionType?: string,
  ) {
    let effectiveBranchId = branchId;
    let assignedToFilter: string | undefined;
    if (!session.isAdmin && !session.isHoStaff) {
      effectiveBranchId = session.activeBranchId;
      assignedToFilter = session.userId;
    }
    return this.service.findAll(
      effectiveBranchId,
      status,
      transactionType,
      assignedToFilter,
    );
  }

  @Get("users")
  @ApiOperation({
    summary: "Get authorized users for manual bill book allocation",
  })
  async getAuthorizedUsers(
    @Session() session: any,
    @Query("branchId") branchId?: string,
  ) {
    const effectiveBranchId =
      session.isAdmin
        ? branchId
        : session.isHoStaff
          ? branchId || session.activeBranchId
          : session.activeBranchId;
    console.log(
      `[DEBUG] users request userId=${session?.userId ?? "unknown"} isAdmin=${Boolean(session?.isAdmin)} isHoStaff=${Boolean(session?.isHoStaff)} branchId=${branchId ?? "null"} activeBranchId=${session?.activeBranchId ?? "null"} effectiveBranchId=${effectiveBranchId ?? "null"}`,
    );
    return this.service.getAuthorizedUsers(effectiveBranchId);
  }

  @Get("branch-managers")
  @ApiOperation({ summary: "Get branch managers for a branch" })
  async getBranchManagers(
    @Session() session: any,
    @Query("branchId") branchId: string,
  ) {
    let effectiveBranchId = branchId;
    if (!session.isAdmin && !session.isHoStaff) {
      effectiveBranchId = session.activeBranchId;
    }
    this.logger.log(
      `[DEBUG] branch-managers request userId=${session?.userId ?? "unknown"} isAdmin=${Boolean(session?.isAdmin)} isHoStaff=${Boolean(session?.isHoStaff)} branchId=${branchId ?? "null"} effectiveBranchId=${effectiveBranchId ?? "null"}`,
    );
    return this.service.getBranchManagers(effectiveBranchId);
  }

  @Put("dispatches/bulk-review")
  @ApiOperation({
    summary: "Bulk approve or reject manual bill book dispatches",
  })
  @ApiResponse({ status: 200, description: "Dispatches reviewed successfully" })
  async bulkReview(
    @Body() dto: BulkReviewManualBooksDto,
    @Session() session: any,
  ) {
    return this.service.bulkReview(dto, session.userId);
  }

  @Get("dispatches/:id")
  @ApiOperation({ summary: "Get a single manual bill book dispatch by ID" })
  @ApiParam({ name: "id", description: "Dispatch UUID" })
  @ApiResponse({ status: 200, description: "Dispatch details" })
  async findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Put("dispatches/:id/approve")
  @ApiOperation({ summary: "Approve or Reject manual bill book dispatch" })
  @ApiParam({ name: "id", description: "Dispatch UUID" })
  @ApiResponse({ status: 200, description: "Dispatch updated successfully" })
  async approveOrReject(
    @Param("id") id: string,
    @Body() dto: ApproveRejectManualBookDto,
    @Session() session: any,
  ) {
    return this.service.approveOrReject(id, dto, session.userId);
  }

  @Put("dispatches/:id/reassign")
  @ApiOperation({ summary: "Reassign a REJECTED dispatch to a new user (HO only)" })
  @ApiParam({ name: "id", description: "Dispatch UUID" })
  @ApiResponse({ status: 200, description: "Dispatch reassigned and reset to PENDING" })
  async reassignDispatch(
    @Param("id") id: string,
    @Body() dto: ReassignManualBookDto,
    @Session() session: any,
  ) {
    return this.service.reassignDispatch(id, dto, session.userId);
  }

  @Post("assignments")
  @ApiOperation({ summary: "Save manual book page assignments" })
  @ApiResponse({ status: 201, description: "Assignments saved successfully" })
  async saveAssignments(@Body() dto: AssignPagesDto, @Session() session: any) {
    return this.service.saveAssignments(dto, session.userId);
  }

  @Get("assignments")
  @ApiOperation({ summary: "Get manual book page assignments by book IDs" })
  @ApiResponse({ status: 200, description: "List of assignments" })
  async getAssignments(@Query("manualBookIds") idsStr: string) {
    const ids = idsStr ? idsStr.split(",") : [];
    return this.service.getAssignmentsByBookIds(ids);
  }

  @Get(":manualBookId/books/:bookNo/pages")
  @ApiOperation({ summary: "Get pages for a book number" })
  @ApiResponse({ status: 200, description: "List of pages" })
  async getPagesByBookNo(
    @Param("manualBookId") manualBookId: string,
    @Param("bookNo") bookNoStr: string,
  ) {
    const bookNo = parseInt(bookNoStr, 10);
    return this.service.getPagesByBookNo(manualBookId, bookNo);
  }

  @Post("pages/transfer")
  @ApiOperation({ summary: "Transfer pages to another user" })
  @ApiResponse({ status: 200, description: "Pages transferred" })
  async transferPages(@Body() dto: TransferPagesDto, @Session() session: any) {
    return this.service.transferPages(dto, session.userId);
  }

  @Put("pages/status")
  @ApiOperation({ summary: "Update page status (Void)" })
  @ApiResponse({ status: 200, description: "Pages updated" })
  async updatePagesStatus(
    @Body() dto: UpdatePageStatusDto,
    @Session() session: any,
  ) {
    return this.service.updatePagesStatus(dto, session.userId);
  }

  @Post("pages/return")
  @ApiOperation({ summary: "Return pages (delete from database)" })
  @ApiResponse({ status: 200, description: "Pages returned" })
  async returnPages(@Body() dto: ReturnPagesDto) {
    return this.service.returnPages(dto);
  }

  @Get("pages/search")
  @ApiOperation({ summary: "Search page status" })
  @ApiResponse({ status: 200, description: "Page tracking status" })
  async searchPage(
    @Session() session: any,
    @Query("pageNo") pageNoStr: string,
  ) {
    const pageNo = parseInt(pageNoStr, 10);
    return this.service.searchPage(pageNo, session.isAdmin ? undefined : session.activeBranchId);
  }

  @Get("pages/selectable")
  @ApiOperation({
    summary:
      "Get selectable manual bill book pages for the current branch and assignee",
  })
  @ApiResponse({ status: 200, description: "Selectable pages" })
  async getSelectablePages(
    @Session() session: any,
    @Query("branchId") branchId?: string,
    @Query("userId") userId?: string,
    @Query("transactionType") transactionType?: string,
  ) {
    const effectiveBranchId = session.isAdmin ? branchId : session.activeBranchId;
    const effectiveUserId = userId?.trim() || session.userId;
    this.logger.log(
      `[DEBUG] selectable-pages request userId=${session?.userId ?? "unknown"} isAdmin=${Boolean(session?.isAdmin)} isHoStaff=${Boolean(session?.isHoStaff)} branchId=${branchId ?? "null"} effectiveBranchId=${effectiveBranchId ?? "null"} userFilter=${effectiveUserId ?? "null"} transactionType=${transactionType ?? "null"}`
    );
    return this.service.getSelectablePages(
      effectiveBranchId,
      effectiveUserId,
      transactionType?.trim() || undefined,
    );
  }

  @Get("dp-mapping/search")
  @ApiOperation({ summary: "Search manual book pages for DP mapping" })
  async searchDPMapping(
    @Session() session: any,
    @Query("transactionType") transactionType: string,
    @Query("bookNo") bookNoStr: string,
    @Query("mvNoFrom") mvNoFromStr: string,
    @Query("mvNoTo") mvNoToStr: string,
    @Query("actionType") actionType: "MAP" | "UNMAP",
  ) {
    const bookNo = parseInt(bookNoStr, 10);
    const mvNoFrom = parseInt(mvNoFromStr, 10);
    const mvNoTo = parseInt(mvNoToStr, 10);
    const branchId = session.activeBranchId;
    const currentUserId = session.userId;
    return this.service.searchDPMapping({
      branchId,
      currentUserId,
      transactionType,
      bookNo,
      mvNoFrom,
      mvNoTo,
      actionType,
    });
  }

  @Post("dp-mapping/allocate")
  @ApiOperation({ summary: "Allocate manual book pages to a Delivery Person" })
  async allocateToDP(
    @Session() session: any,
    @Body()
    body: { pageIds: string[]; deliveryPersonId: string; remarks?: string },
  ) {
    return this.service.allocateToDP(
      body.pageIds,
      body.deliveryPersonId,
      session.userId,
      body.remarks,
    );
  }

  @Post("dp-mapping/deallocate")
  @ApiOperation({ summary: "Deallocate manual book pages back to Cashier" })
  async deallocateFromDP(
    @Session() session: any,
    @Body() body: { pageIds: string[]; remarks?: string },
  ) {
    return this.service.deallocateFromDP(
      body.pageIds,
      session.userId,
      body.remarks,
    );
  }

  @Get("dp-mapping/delivery-persons")
  @ApiOperation({
    summary: "Get list of active delivery persons in the cashier branch",
  })
  async getDeliveryPersons(@Session() session: any) {
    const branchId = session.activeBranchId;
    return this.service.getDeliveryPersons(branchId);
  }

  @Get("dp-management/users")
  @ApiOperation({ summary: "Get all active branch users with their delivery person status" })
  async getBranchUsersForDP(@Session() session: any) {
    return this.service.getBranchUsersForDP(session.activeBranchId);
  }

  @Post("dp-management/add")
  @ApiOperation({ summary: "Assign delivery person role to a branch user" })
  async addDeliveryPerson(
    @Session() session: any,
    @Body() dto: ManageDeliveryPersonDto,
  ) {
    return this.service.addDeliveryPerson(session.activeBranchId, dto.userId, session.userId);
  }

  @Post("dp-management/remove")
  @ApiOperation({ summary: "Remove delivery person role from a branch user" })
  async removeDeliveryPerson(
    @Session() session: any,
    @Body() dto: ManageDeliveryPersonDto,
  ) {
    return this.service.removeDeliveryPerson(session.activeBranchId, dto.userId);
  }

  @Get("dp-unmap/pages")
  @ApiOperation({ summary: "Get all pages currently assigned to delivery persons in the branch" })
  async getDPAllocatedPages(@Session() session: any) {
    return this.service.getDPAllocatedPages(session.activeBranchId);
  }

  @Post("dp-unmap/execute")
  @ApiOperation({ summary: "Unmap pages from a delivery person back to cashier or release to BM pool" })
  async unmapFromDP(
    @Session() session: any,
    @Body() body: { dpUserId: string; manualBookId: string; mvFrom: number; mvTo: number; remarks?: string },
  ) {
    return this.service.unmapFromDP({
      dpUserId: body.dpUserId,
      manualBookId: body.manualBookId,
      mvFrom: body.mvFrom,
      mvTo: body.mvTo,
      remarks: body.remarks,
      executorId: session.userId,
    });
  }
}
