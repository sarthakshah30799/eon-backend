import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, In, Between } from "typeorm";
import { ManualBook } from "./entities/manual-book.entity";
import { ManualBookPageTracking } from "./entities/manual-book-page-tracking.entity";
import { Branch } from "../branches/branch.entity";
import { SelectOption } from "../category-options/category-option.entity";
import { User } from "../users/user.entity";
import {
  CreateManualBookDto,
  ApproveRejectManualBookDto,
  BulkReviewManualBooksDto,
  AssignPagesDto,
  TransferPagesDto,
  UpdatePageStatusDto,
  ReturnPagesDto,
} from "./dto/manual-bill-book.dto";

const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

type UserLookup = {
  id: string;
  name: string;
};

@Injectable()
export class ManualBillBookService {
  private readonly logger = new Logger(ManualBillBookService.name);

  constructor(
    @InjectRepository(ManualBook, "database2")
    private readonly manualBookRepository: Repository<ManualBook>,

    @InjectRepository(ManualBookPageTracking, "database2")
    private readonly pageTrackingRepository: Repository<ManualBookPageTracking>,

    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
  ) { }

  async create(dto: CreateManualBookDto, userId: string): Promise<ManualBook> {
    const {
      dispatchDate,
      branchId,
      transactionType,
      bookNoFrom,
      bookNoTo,
      vouchersPerBook,
      mvNoFrom,
      assignedTo,
      remarks,
    } = dto;

    // Verify branch exists in primary DB
    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${branchId} not found`);
    }

    // Auto-calculate mvNoTo: mvNoFrom + (numBooks * vouchersPerBook) - 1
    const numBooks = bookNoTo - bookNoFrom + 1;
    const mvNoTo = mvNoFrom + numBooks * vouchersPerBook - 1;

    // Check for overlapping book number ranges (global)
    const overlappingBookNo = await this.manualBookRepository
      .createQueryBuilder('book')
      .where('book.bookNoFrom <= :bookNoTo AND book.bookNoTo >= :bookNoFrom', {
        bookNoFrom,
        bookNoTo,
      })
      .getOne();

    if (overlappingBookNo) {
      throw new BadRequestException(
        `Book number range [${bookNoFrom} - ${bookNoTo}] overlaps with existing book [${overlappingBookNo.no}]`
      );
    }

    // Check for overlapping page number ranges
    const overlapping = await this.manualBookRepository
      .createQueryBuilder('book')
      .where('book.mv_no_from <= :mvNoTo AND book.mv_no_to >= :mvNoFrom', {
        mvNoFrom,
        mvNoTo,
      })
      .getOne();

    if (overlapping) {
      throw new BadRequestException(
        `Page number range [${mvNoFrom} - ${mvNoTo}] overlaps with existing book [${overlapping.no}] with range [${overlapping.mvNoFrom} - ${overlapping.mvNoTo}]`
      );
    }

    // Auto-generate branch-specific sequence number (no) e.g., MBYY00001
    const year = new Date(dispatchDate).getFullYear().toString().slice(-2); // e.g. "26"
    const prefix = `MB${year}`;

    const lastRecord = await this.manualBookRepository.findOne({
      where: {
        branchId,
        no: Like(`${prefix}%`),
      },
      order: { no: "DESC" },
    });

    let nextSeq = 1;
    if (lastRecord) {
      const lastSeqStr = lastRecord.no.slice(prefix.length);
      const lastSeq = parseInt(lastSeqStr, 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
    const no = `${prefix}${String(nextSeq).padStart(5, "0")}`;

    const book = this.manualBookRepository.create({
      dispatchDate,
      no,
      branchId,
      transactionType,
      bookNoFrom,
      bookNoTo,
      vouchersPerBook,
      mvNoFrom,
      mvNoTo,
      assignedTo,
      remarks,
      status: "Pending",
      createdBy: userId,
      updatedBy: userId,
    });

    return this.manualBookRepository.save(book);
  }

  async getNextNumber(
    branchId: string,
    dispatchDate: string,
  ): Promise<{ nextNumber: string }> {
    if (!branchId || !dispatchDate) {
      return { nextNumber: "" };
    }
    const year = new Date(dispatchDate).getFullYear().toString().slice(-2);
    const prefix = `MB${year}`;

    const lastRecord = await this.manualBookRepository.findOne({
      where: {
        branchId,
        no: Like(`${prefix}%`),
      },
      order: { no: "DESC" },
    });

    let nextSeq = 1;
    if (lastRecord) {
      const lastSeqStr = lastRecord.no.slice(prefix.length);
      const lastSeq = parseInt(lastSeqStr, 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    const nextNumber = `${prefix}${String(nextSeq).padStart(5, "0")}`;
    return { nextNumber };
  }

  async findAll(
    branchId?: string,
    status?: string,
    transactionType?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<any[]> {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
    if (transactionType && transactionType !== "ALL")
      where.transactionType = transactionType;
    if (fromDate && toDate) {
      where.dispatchDate = Between(fromDate, toDate);
    }

    const books = await this.manualBookRepository.find({
      where,
      order: { createdAt: "DESC" },
    });

    if (books.length === 0) {
      return [];
    }

    // Fetch branch profiles from DB1 in a single query
    const branchIds = Array.from(new Set(books.map((b) => b.branchId)));
    const branches = await this.branchRepository.find({
      where: { id: In(branchIds) },
    });
    const branchMap = new Map(branches.map((b) => [b.id, b]));

    // Fetch transaction options from DB1
    const transactionTypeIds = Array.from(
      new Set(
        books.map((b) => b.transactionType).filter((id) => id && isUuid(id)),
      ),
    );
    let selectOptions: SelectOption[] = [];
    if (transactionTypeIds.length > 0) {
      selectOptions = await this.branchRepository.manager.find(SelectOption, {
        where: { id: In(transactionTypeIds) },
      });
    }
    const optionMap = new Map(selectOptions.map((o) => [o.id, o]));

    // Fetch assigned users from DB1
    const assignedToIds = Array.from(
      new Set(books.map((b) => b.assignedTo).filter((id) => id && isUuid(id))),
    );
    let assignedUsers: User[] = [];
    if (assignedToIds.length > 0) {
      assignedUsers = await this.branchRepository.manager.find(User, {
        where: { id: In(assignedToIds) },
      });
    }
    const userMap = new Map(assignedUsers.map((u) => [u.id, u]));

    return books.map((book) => {
      const branch = branchMap.get(book.branchId);
      const option = optionMap.get(book.transactionType);
      const assignedUser = userMap.get(book.assignedTo);
      return {
        ...book,
        branchName: branch ? branch.name : "Unknown Branch",
        branchCode: branch ? branch.code : "",
        transactionTypeLabel: option ? option.label : book.transactionType,
        assignedTo: {
          id: assignedUser ? assignedUser.id : book.assignedTo,
          name: assignedUser ? assignedUser.name : book.assignedTo,
        },
      };
    });
  }

  async approveOrReject(
    id: string,
    dto: ApproveRejectManualBookDto,
    userId: string,
  ): Promise<ManualBook> {
    const book = await this.manualBookRepository.findOne({ where: { id } });
    if (!book) {
      throw new NotFoundException(`Manual Book entry with ID ${id} not found`);
    }

    book.status = dto.status;
    book.approvalRemarks = dto.approvalRemarks;
    book.approvedAt = new Date();
    book.approvedBy = userId;
    book.updatedBy = userId;

    return this.manualBookRepository.save(book);
  }

  async bulkReview(
    dto: BulkReviewManualBooksDto,
    userId: string,
  ): Promise<any[]> {
    const results = [];
    for (const item of dto.reviews) {
      const book = await this.manualBookRepository.findOne({
        where: { id: item.id },
      });
      if (!book) continue;
      book.status = item.status;
      book.approvalRemarks = item.approvalRemarks;
      book.approvedAt = new Date();
      book.approvedBy = userId;
      book.updatedBy = userId;
      const saved = await this.manualBookRepository.save(book);
      results.push(saved);
    }
    return results;
  }

  async getAuthorizedUsers(branchId: string): Promise<any[]> {
    this.logger.log(`[DEBUG] getAuthorizedUsers called with branchId=${branchId ?? 'null'}`);
    const diagnostics = await this.branchRepository.manager.query(
      `
      SELECT
        COUNT(*)::int AS role_rows,
        COUNT(DISTINCT ur.user_id)::int AS distinct_users,
        COUNT(*) FILTER (WHERE u.is_active = true)::int AS active_user_rows,
        COUNT(*) FILTER (WHERE r.is_brn_mgr = true)::int AS branch_manager_rows,
        COUNT(*) FILTER (WHERE r.is_cashier = true)::int AS cashier_rows,
        COUNT(*) FILTER (WHERE r.is_delivery_boy = true)::int AS delivery_boy_rows,
        COUNT(*) FILTER (WHERE r.is_cashier = true OR r.is_delivery_boy = true)::int AS allocation_user_rows,
        COUNT(*) FILTER (WHERE r.is_admin = true)::int AS admin_rows
      FROM user_roles ur
      JOIN users u ON u.id = ur.user_id
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.branch_id = $1
      `,
      [branchId],
    );
    this.logger.log(
      `[DEBUG] getAuthorizedUsers diagnostics branchId=${branchId ?? 'null'} payload=${JSON.stringify(diagnostics?.[0] ?? {})}`,
    );
    const rows = await this.branchRepository.manager.query(
      `
      SELECT DISTINCT u.id, u.name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.branch_id = $1 
        AND u.is_active = true
        AND (r.is_cashier = true OR r.is_delivery_boy = true)
    `,
      [branchId],
    );
    this.logger.log(
      `[DEBUG] getAuthorizedUsers result count=${rows.length} branchId=${branchId ?? 'null'} rows=${JSON.stringify(rows)}`
    );
    return rows;
  }

  async getBranchManagers(branchId: string): Promise<UserLookup[]> {
    this.logger.log(`[DEBUG] getBranchManagers called with branchId=${branchId ?? 'null'}`);
    const diagnostics = await this.branchRepository.manager.query(
      `
      SELECT
        COUNT(*)::int AS role_rows,
        COUNT(DISTINCT ur.user_id)::int AS distinct_users,
        COUNT(*) FILTER (WHERE u.is_active = true)::int AS active_user_rows,
        COUNT(*) FILTER (WHERE r.is_brn_mgr = true)::int AS branch_manager_rows,
        COUNT(*) FILTER (WHERE r.is_cashier = true)::int AS cashier_rows,
        COUNT(*) FILTER (WHERE r.is_delivery_boy = true)::int AS delivery_boy_rows,
        COUNT(*) FILTER (WHERE r.is_admin = true)::int AS admin_rows
      FROM user_roles ur
      JOIN users u ON u.id = ur.user_id
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.branch_id = $1
      `,
      [branchId],
    );
    this.logger.log(
      `[DEBUG] getBranchManagers diagnostics branchId=${branchId ?? 'null'} payload=${JSON.stringify(diagnostics?.[0] ?? {})}`,
    );
    const rows = await this.branchRepository.manager.query(
      `
      SELECT DISTINCT u.id, u.name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.branch_id = $1 
        AND u.is_active = true
        AND r.is_brn_mgr = true
      `,
      [branchId],
    );
    this.logger.log(
      `[DEBUG] getBranchManagers result count=${rows.length} branchId=${branchId ?? 'null'} rows=${JSON.stringify(rows)}`
    );
    return rows as UserLookup[];
  }

  async saveAssignments(dto: AssignPagesDto, userId: string): Promise<any[]> {
    const results = [];
    for (const item of dto.assignments) {
      const book = await this.manualBookRepository.findOne({
        where: { id: item.manualBookId },
      });
      if (!book) continue;

      const offset = item.bookNo - book.bookNoFrom;
      const startPageNo = book.mvNoFrom + offset * book.vouchersPerBook;
      const endPageNo = startPageNo + book.vouchersPerBook - 1;

      const existingPages = await this.pageTrackingRepository.find({
        where: { pageNo: Between(startPageNo, endPageNo) },
      });
      const existingPageNos = new Set(existingPages.map((p) => p.pageNo));

      const pagesToInsert = [];
      for (let p = startPageNo; p <= endPageNo; p++) {
        if (!existingPageNos.has(p)) {
          pagesToInsert.push({
            manualBookId: item.manualBookId,
            userId: item.userId,
            pageNo: p,
            isVoided: false,
            remarks: item.remarks,
            updatedBy: userId,
          });
        } else {
          const existing = existingPages.find((ep) => ep.pageNo === p);
          if (existing && !existing.isVoided) {
            existing.userId = item.userId;
            existing.remarks = item.remarks;
            existing.updatedBy = userId;
            await this.pageTrackingRepository.save(existing);
          }
        }
      }
      if (pagesToInsert.length > 0) {
        await this.pageTrackingRepository.insert(pagesToInsert);
      }
      results.push({
        manualBookId: item.manualBookId,
        bookNo: item.bookNo,
        userId: item.userId,
      });
    }
    return results;
  }

  async getAssignmentsByBookIds(manualBookIds: string[]): Promise<any[]> {
    if (manualBookIds.length === 0) return [];
    const books = await this.manualBookRepository.find({
      where: { id: In(manualBookIds) },
    });
    const bookMap = new Map(books.map((b) => [b.id, b]));

    const pages = await this.pageTrackingRepository.find({
      where: { manualBookId: In(manualBookIds) },
      order: { pageNo: "ASC" },
    });

    const groups: Record<
      string,
      {
        manualBookId: string;
        bookNo: number;
        userId: string;
        pageNos: number[];
        remarks?: string;
      }
    > = {};

    for (const p of pages) {
      const book = bookMap.get(p.manualBookId);
      if (!book) continue;
      const offset = Math.floor(
        (p.pageNo - book.mvNoFrom) / book.vouchersPerBook,
      );
      const bookNo = book.bookNoFrom + offset;
      const key = `${p.manualBookId}_${bookNo}`;

      if (!groups[key]) {
        groups[key] = {
          manualBookId: p.manualBookId,
          bookNo,
          userId: p.userId,
          pageNos: [],
          remarks: p.remarks,
        };
      }
      groups[key].pageNos.push(p.pageNo);
    }

    return Object.values(groups).map((g) => ({
      manualBookId: g.manualBookId,
      bookNo: g.bookNo,
      cashierId: g.userId,
      remarks: g.remarks,
    }));
  }

  async getPagesByBookNo(
    manualBookId: string,
    bookNo: number,
  ): Promise<ManualBookPageTracking[]> {
    const book = await this.manualBookRepository.findOne({
      where: { id: manualBookId },
    });
    if (!book) {
      throw new NotFoundException(`Manual Book not found`);
    }
    const offset = bookNo - book.bookNoFrom;
    const startPageNo = book.mvNoFrom + offset * book.vouchersPerBook;
    const endPageNo = startPageNo + book.vouchersPerBook - 1;

    return this.pageTrackingRepository.find({
      where: { pageNo: Between(startPageNo, endPageNo) },
      order: { pageNo: "ASC" },
    });
  }

  async transferPages(dto: TransferPagesDto, userId: string): Promise<any> {
    const { pageNos, targetUserId } = dto;
    const pages = await this.pageTrackingRepository.find({
      where: { pageNo: In(pageNos) },
    });

    const voidedPages = pages.filter((p) => p.isVoided);
    if (voidedPages.length > 0) {
      throw new ForbiddenException(
        `Cannot transfer pages that are voided: ${voidedPages.map((p) => p.pageNo).join(", ")}`,
      );
    }

    await this.pageTrackingRepository.update(
      { pageNo: In(pageNos) },
      {
        userId: targetUserId,
        updatedBy: userId,
      },
    );
    return { success: true };
  }

  async updatePagesStatus(
    dto: UpdatePageStatusDto,
    userId: string,
  ): Promise<any> {
    const { pageNos, remarks } = dto;
    await this.pageTrackingRepository.update(
      { pageNo: In(pageNos) },
      {
        isVoided: true,
        remarks,
        updatedBy: userId,
      },
    );
    return { success: true };
  }

  async returnPages(dto: ReturnPagesDto): Promise<any> {
    const { pageNos } = dto;
    await this.pageTrackingRepository.delete({
      pageNo: In(pageNos),
      isVoided: false,
    });
    return { success: true };
  }

  async searchPage(pageNo: number, branchId?: string): Promise<any> {
    const page = await this.pageTrackingRepository.findOne({
      where: { pageNo },
      relations: ["manualBook"],
    });
    if (!page) {
      throw new NotFoundException(
        `Bill leaf/page number ${pageNo} not found in tracking`,
      );
    }
    if (branchId && page.manualBook?.branchId !== branchId) {
      throw new NotFoundException(
        `Bill leaf/page number ${pageNo} not found in tracking`,
      );
    }
    const users = await this.branchRepository.manager.query(
      `
      SELECT id, name FROM users WHERE id = $1
    `,
      [page.userId],
    );
    return {
      ...page,
      assignedToUser: users[0] || null,
    };
  }

  async getSelectablePages(branchId?: string, userId?: string): Promise<any[]> {
    if (!branchId) {
      return [];
    }

    const query = this.pageTrackingRepository
      .createQueryBuilder("pt")
      .innerJoinAndSelect("pt.manualBook", "book")
      .where("pt.isVoided = :isVoided", { isVoided: false });

    query.andWhere("book.branchId = :branchId", { branchId });

    if (userId) {
      query.andWhere("pt.userId = :userId", {
        userId,
      });
    }

    query.andWhere(
      `NOT EXISTS (
        SELECT 1
        FROM transactions t
        WHERE t.manual_book_page_id = pt.id
      )`,
    );

    const pages = await query
      .orderBy("book.dispatchDate", "DESC")
      .addOrderBy("book.no", "DESC")
      .addOrderBy("book.bookNoFrom", "ASC")
      .addOrderBy("pt.pageNo", "ASC")
      .getMany();

    return pages.map((page) => ({
      id: page.id,
      manualBookId: page.manualBookId,
      userId: page.userId,
      pageNo: page.pageNo,
      remarks: page.remarks ?? null,
      manualBook: page.manualBook
        ? {
          id: page.manualBook.id,
          no: page.manualBook.no,
          bookNoFrom: page.manualBook.bookNoFrom,
          bookNoTo: page.manualBook.bookNoTo,
          vouchersPerBook: page.manualBook.vouchersPerBook,
          mvNoFrom: page.manualBook.mvNoFrom,
          mvNoTo: page.manualBook.mvNoTo,
          branchId: page.manualBook.branchId,
          transactionType: page.manualBook.transactionType,
        }
        : null,
    }));
  }

  async searchDPMapping(params: {
    branchId: string;
    currentUserId: string;
    transactionType: string;
    bookNo: number;
    mvNoFrom: number;
    mvNoTo: number;
    actionType: "MAP" | "UNMAP";
  }): Promise<any[]> {
    const {
      branchId,
      currentUserId,
      transactionType,
      bookNo,
      mvNoFrom,
      mvNoTo,
      actionType,
    } = params;

    // Get active delivery persons in the branch
    const deliveryPersons = await this.branchRepository.manager.query(
      `
      SELECT DISTINCT u.id, u.name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.branch_id = $1 
        AND u.is_active = true 
        AND r.is_delivery_boy = true
    `,
      [branchId],
    );
    const dpIds = deliveryPersons.map((u: any) => u.id);

    if (actionType === "UNMAP" && dpIds.length === 0) {
      return [];
    }

    // Find all manual books matching branch, transactionType (if not ALL), and book range containing bookNo
    const queryBooks = await this.manualBookRepository
      .createQueryBuilder("mb")
      .where("mb.branchId = :branchId", { branchId })
      .andWhere("mb.status = :status", { status: "Approved" })
      .andWhere("mb.bookNoFrom <= :bookNo", { bookNo })
      .andWhere("mb.bookNoTo >= :bookNo", { bookNo })
      .andWhere(
        transactionType === "ALL"
          ? "1=1"
          : "mb.transactionType = :transactionType",
        { transactionType },
      )
      .getMany();

    if (queryBooks.length === 0) {
      return [];
    }

    const matchedPages: ManualBookPageTracking[] = [];
    const bookMap = new Map<string, (typeof queryBooks)[0]>();

    for (const book of queryBooks) {
      bookMap.set(book.id, book);
      const offset = bookNo - book.bookNoFrom;
      const startPage = book.mvNoFrom + offset * book.vouchersPerBook;
      const endPage = startPage + book.vouchersPerBook - 1;

      const rangeStart = Math.max(mvNoFrom, startPage);
      const rangeEnd = Math.min(mvNoTo, endPage);

      if (rangeStart > rangeEnd) {
        continue;
      }

      const qb = this.pageTrackingRepository
        .createQueryBuilder("pt")
        .where("pt.manualBookId = :bookId", { bookId: book.id })
        .andWhere("pt.pageNo >= :rangeStart", { rangeStart })
        .andWhere("pt.pageNo <= :rangeEnd", { rangeEnd })
        .andWhere("pt.isVoided = :isVoided", { isVoided: false });

      if (actionType === "MAP") {
        qb.andWhere("pt.userId = :currentUserId", { currentUserId });
      } else {
        qb.andWhere("pt.userId IN (:...dpIds)", { dpIds });
      }

      const pages = await qb.getMany();
      matchedPages.push(...pages);
    }

    if (matchedPages.length === 0) {
      return [];
    }

    // Fetch transaction options from DB1
    const transactionTypeIds = Array.from(
      new Set(
        queryBooks
          .map((b) => b.transactionType)
          .filter((id) => id && isUuid(id)),
      ),
    );
    let selectOptions: SelectOption[] = [];
    if (transactionTypeIds.length > 0) {
      selectOptions = await this.branchRepository.manager.find(SelectOption, {
        where: { id: In(transactionTypeIds) },
      });
    }
    const optionMap = new Map(selectOptions.map((o) => [o.id, o]));

    // Map names to ids
    const userNamesMap: Record<string, string> = {};
    deliveryPersons.forEach((u: any) => {
      userNamesMap[u.id] = u.name;
    });
    const currentUser = await this.branchRepository.manager.query(
      `
      SELECT name FROM users WHERE id = $1
    `,
      [currentUserId],
    );
    if (currentUser[0]) {
      userNamesMap[currentUserId] = currentUser[0].name;
    }

    // Sort by pageNo
    matchedPages.sort((a, b) => a.pageNo - b.pageNo);

    // Group contiguous pages
    const groups: any[] = [];
    let currentGroup: any = null;

    for (const page of matchedPages) {
      const book = bookMap.get(page.manualBookId);
      if (!book) continue;

      const option = optionMap.get(book.transactionType);

      if (!currentGroup) {
        currentGroup = {
          manualBookId: page.manualBookId,
          bookNo: bookNo,
          transactionType: book.transactionType,
          transactionTypeLabel: option ? option.label : book.transactionType,
          mvNoFrom: page.pageNo,
          mvNoTo: page.pageNo,
          qty: 1,
          userId: page.userId,
          assignedToUserName: userNamesMap[page.userId] || "Unknown",
          pageIds: [page.id],
          remarks: page.remarks || "",
        };
      } else {
        const isContiguous = page.pageNo === currentGroup.mvNoTo + 1;
        const sameAssignee = page.userId === currentGroup.userId;
        const sameBook = page.manualBookId === currentGroup.manualBookId;
        if (isContiguous && sameAssignee && sameBook) {
          currentGroup.mvNoTo = page.pageNo;
          currentGroup.qty++;
          currentGroup.pageIds.push(page.id);
        } else {
          groups.push(currentGroup);
          currentGroup = {
            manualBookId: page.manualBookId,
            bookNo: bookNo,
            transactionType: book.transactionType,
            transactionTypeLabel: option ? option.label : book.transactionType,
            mvNoFrom: page.pageNo,
            mvNoTo: page.pageNo,
            qty: 1,
            userId: page.userId,
            assignedToUserName: userNamesMap[page.userId] || "Unknown",
            pageIds: [page.id],
            remarks: page.remarks || "",
          };
        }
      }
    }
    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }

  async allocateToDP(
    pageIds: string[],
    deliveryPersonId: string,
    updatedBy: string,
    remarks?: string,
  ): Promise<any> {
    if (pageIds.length === 0) return { success: true };
    await this.pageTrackingRepository.update(
      { id: In(pageIds) },
      {
        userId: deliveryPersonId,
        remarks: remarks || null,
        updatedBy,
      },
    );
    return { success: true };
  }

  async deallocateFromDP(
    pageIds: string[],
    cashierId: string,
    remarks?: string,
  ): Promise<any> {
    if (pageIds.length === 0) return { success: true };
    await this.pageTrackingRepository.update(
      { id: In(pageIds) },
      {
        userId: cashierId,
        remarks: remarks || null,
        updatedBy: cashierId,
      },
    );
    return { success: true };
  }

  async getDeliveryPersons(branchId: string): Promise<any[]> {
    return this.branchRepository.manager.query(
      `
      SELECT DISTINCT u.id, u.name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.branch_id = $1 
         AND u.is_active = true 
         AND r.is_delivery_boy = true
    `,
      [branchId],
    );
  }

  async validateBookRange(
    bookNoFrom: number,
    bookNoTo: number,
  ): Promise<{ valid: boolean; error?: string }> {
    const overlappingBookNo = await this.manualBookRepository
      .createQueryBuilder('book')
      .where('book.bookNoFrom <= :bookNoTo AND book.bookNoTo >= :bookNoFrom', {
        bookNoFrom,
        bookNoTo,
      })
      .getOne();

    if (overlappingBookNo) {
      return {
        valid: false,
        error: `Book number range [${bookNoFrom} - ${bookNoTo}] overlaps with existing book [${overlappingBookNo.no}]`,
      };
    }
    return { valid: true };
  }

  async validatePageRange(
    mvNoFrom: number,
    mvNoTo: number,
  ): Promise<{ valid: boolean; error?: string }> {
    const overlapping = await this.manualBookRepository
      .createQueryBuilder('book')
      .where('book.mv_no_from <= :mvNoTo AND book.mv_no_to >= :mvNoFrom', {
        mvNoFrom,
        mvNoTo,
      })
      .getOne();

    if (overlapping) {
      return {
        valid: false,
        error: `Page number range [${mvNoFrom} - ${mvNoTo}] overlaps with existing book [${overlapping.no}] with range [${overlapping.mvNoFrom} - ${overlapping.mvNoTo}]`,
      };
    }
    return { valid: true };
  }
}
