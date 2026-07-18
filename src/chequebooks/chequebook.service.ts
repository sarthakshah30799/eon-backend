import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, In, Between } from "typeorm";
import { ChequeBook } from "./entities/cheque-book.entity";
import { WorkflowStatus } from "../common/enums/workflow-status.enum";
import { ChequeBookPageTracking } from "./entities/cheque-book-page-tracking.entity";
import { Branch } from "../branches/branch.entity";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { User } from "../users/user.entity";
import {
  CreateChequeBookDto,
  ApproveRejectChequeBookDto,
  BulkReviewChequeBooksDto,
  SaveChequeBookAssignmentsDto,
  UpdatePageStatusDto,
  ReturnPagesDto,
  ReassignChequeBookDto,
  AuthorizedUserRole,
} from "./dto/chequebook.dto";

const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

type UserLookup = {
  id: string;
  name: string;
};

@Injectable()
export class ChequeBookService {
  private readonly logger = new Logger(ChequeBookService.name);

  constructor(
    @InjectRepository(ChequeBook, "database2")
    private readonly checkBookRepository: Repository<ChequeBook>,

    @InjectRepository(ChequeBookPageTracking, "database2")
    private readonly pageTrackingRepository: Repository<ChequeBookPageTracking>,

    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,

    @InjectRepository(AccountProfile)
    private readonly accountProfileRepository: Repository<AccountProfile>,
  ) {}

  async create(
    dto: CreateChequeBookDto,
    userId: string,
    activeBranchId?: string,
  ): Promise<ChequeBook> {
    const {
      dispatchDate,
      bankAccountCode,
      bookNoFrom,
      bookNoTo,
      vouchersPerBook,
      mvNoFrom,
      assignedTo,
      remarks,
    } = dto;

    const branchId = activeBranchId;
    if (!branchId) {
      throw new BadRequestException("Current branch is required");
    }

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

    // Check for overlapping book number ranges (global, exclude REJECTED books)
    const overlappingBookNo = await this.checkBookRepository
      .createQueryBuilder('book')
      .where('book.bookNoFrom <= :bookNoTo AND book.bookNoTo >= :bookNoFrom', {
        bookNoFrom,
        bookNoTo,
      })
      .andWhere('book.status != :rejected', { rejected: WorkflowStatus.REJECT })
      .getOne();

    if (overlappingBookNo) {
      throw new BadRequestException(
        `Book number range [${bookNoFrom} - ${bookNoTo}] overlaps with existing book [${overlappingBookNo.no}]`
      );
    }

    // Check for overlapping page number ranges (exclude REJECTED books)
    const overlapping = await this.checkBookRepository
      .createQueryBuilder('book')
      .where('book.mv_no_from <= :mvNoTo AND book.mv_no_to >= :mvNoFrom', {
        mvNoFrom,
        mvNoTo,
      })
      .andWhere('book.status != :rejected', { rejected: WorkflowStatus.REJECT })
      .getOne();

    if (overlapping) {
      throw new BadRequestException(
        `Page number range [${mvNoFrom} - ${mvNoTo}] overlaps with existing book [${overlapping.no}] with range [${overlapping.mvNoFrom} - ${overlapping.mvNoTo}]`
      );
    }

    // Auto-generate branch-specific sequence number (no) e.g., CBYY00001
    const year = new Date(dispatchDate).getFullYear().toString().slice(-2); // e.g. "26"
    const prefix = `CB${year}`;

    const lastRecord = await this.checkBookRepository.findOne({
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

    const book = this.checkBookRepository.create({
      dispatchDate,
      no,
      branchId,
      bankAccountCode,
      bookNoFrom,
      bookNoTo,
      vouchersPerBook,
      mvNoFrom,
      mvNoTo,
      assignedTo,
      remarks,
      status: WorkflowStatus.PENDING,
      createdBy: userId,
      updatedBy: userId,
    });

    return this.checkBookRepository.save(book);
  }

  async getNextNumber(
    branchId: string,
    dispatchDate: string,
  ): Promise<{ nextNumber: string }> {
    if (!branchId || !dispatchDate) {
      return { nextNumber: "" };
    }
    const year = new Date(dispatchDate).getFullYear().toString().slice(-2);
    const prefix = `CB${year}`;

    const lastRecord = await this.checkBookRepository.findOne({
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
    bankAccountCode?: string,
    assignedTo?: string,
  ): Promise<any[]> {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
    if (bankAccountCode && bankAccountCode !== "ALL")
      where.bankAccountCode = bankAccountCode;
    if (assignedTo) where.assignedTo = assignedTo;

    const books = await this.checkBookRepository.find({
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

    // Fetch account profiles from DB1 in a single query
    const accountIds = Array.from(
      new Set(books.map((b) => b.bankAccountCode).filter(Boolean)),
    );
    const accounts =
      accountIds.length > 0
        ? await this.accountProfileRepository.find({
            where: { id: In(accountIds) },
          })
        : [];
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

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
      const account = accountMap.get(book.bankAccountCode);
      const assignedUser = userMap.get(book.assignedTo);
      return {
        ...book,
        branchName: branch ? branch.name : "Unknown Branch",
        branchCode: branch ? branch.code : "",
        bankAccountCodeLabel: account
          ? `${account.accountCode} - ${account.accountName}`
          : "Unknown Bank Account",
        bankAccountCodeName: account ? account.accountCode : "",
        assignedTo: {
          id: assignedUser ? assignedUser.id : book.assignedTo,
          name: assignedUser ? assignedUser.name : book.assignedTo,
        },
      };
    });
  }

  async approveOrReject(
    id: string,
    dto: ApproveRejectChequeBookDto,
    userId: string,
  ): Promise<ChequeBook> {
    const book = await this.checkBookRepository.findOne({ where: { id } });
    if (!book) {
      throw new NotFoundException(`Check Book entry with ID ${id} not found`);
    }

    book.status = dto.status;
    book.approvalRemarks = dto.approvalRemarks;
    book.approvedAt = new Date();
    book.approvedBy = userId;
    book.updatedBy = userId;

    return this.checkBookRepository.save(book);
  }

  async bulkReview(
    dto: BulkReviewChequeBooksDto,
    userId: string,
  ): Promise<any[]> {
    const results = [];
    for (const item of dto.reviews) {
      const book = await this.checkBookRepository.findOne({
        where: { id: item.id },
      });
      if (!book) continue;
      book.status = item.status;
      book.approvalRemarks = item.approvalRemarks;
      book.approvedAt = new Date();
      book.approvedBy = userId;
      book.updatedBy = userId;
      const saved = await this.checkBookRepository.save(book);
      results.push(saved);
    }
    return results;
  }

  async getAuthorizedUsers(branchId: string, role?: AuthorizedUserRole): Promise<any[]> {
    const allowedColumns = Object.values(AuthorizedUserRole) as string[];
    const roleFilter = role && allowedColumns.includes(role)
      ? `r.${role} = true`
      : `r.${AuthorizedUserRole.CASHIER} = true`;

    return this.branchRepository.manager.query(
      `
      SELECT DISTINCT u.id, u.name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.branch_id = $1
        AND u.is_active = true
        AND ${roleFilter}
    `,
      [branchId],
    );
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

  async saveAssignments(
    dto: SaveChequeBookAssignmentsDto,
    userId: string,
  ): Promise<any[]> {
    const results = [];
    for (const item of dto.assignments) {
      const book = await this.checkBookRepository.findOne({
        where: { id: item.checkBookId },
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
            checkBookId: item.checkBookId,
            userId: item.userId,
            assignedBy: userId,
            pageNo: p,
            isVoided: false,
            remarks: item.remarks,
            updatedBy: userId,
          });
        } else {
          const existing = existingPages.find((ep) => ep.pageNo === p);
          if (existing && !existing.isVoided) {
            existing.userId = item.userId;
            existing.assignedBy = userId;
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
        checkBookId: item.checkBookId,
        bookNo: item.bookNo,
        userId: item.userId,
      });
    }
    return results;
  }

  async getAssignmentsByBookIds(checkBookIds: string[]): Promise<any[]> {
    if (checkBookIds.length === 0) return [];
    const books = await this.checkBookRepository.find({
      where: { id: In(checkBookIds) },
    });
    const bookMap = new Map(books.map((b) => [b.id, b]));

    const pages = await this.pageTrackingRepository.find({
      where: { checkBookId: In(checkBookIds) },
      order: { pageNo: "ASC" },
    });

    const groups: Record<
      string,
      {
        checkBookId: string;
        bookNo: number;
        userId: string;
        pageNos: number[];
        remarks?: string;
      }
    > = {};

    for (const p of pages) {
      const book = bookMap.get(p.checkBookId);
      if (!book) continue;
      const offset = Math.floor(
        (p.pageNo - book.mvNoFrom) / book.vouchersPerBook,
      );
      const bookNo = book.bookNoFrom + offset;
      const key = `${p.checkBookId}_${bookNo}`;

      if (!groups[key]) {
        groups[key] = {
          checkBookId: p.checkBookId,
          bookNo,
          userId: p.userId,
          pageNos: [],
          remarks: p.remarks,
        };
      }
      groups[key].pageNos.push(p.pageNo);
    }

    return Object.values(groups).map((g) => ({
      checkBookId: g.checkBookId,
      bookNo: g.bookNo,
      cashierId: g.userId,
      remarks: g.remarks,
    }));
  }

  async getPagesByBookNo(
    checkBookId: string,
    bookNo: number,
  ): Promise<ChequeBookPageTracking[]> {
    const book = await this.checkBookRepository.findOne({
      where: { id: checkBookId },
    });
    if (!book) {
      throw new NotFoundException(`Cheque Book not found`);
    }
    const offset = bookNo - book.bookNoFrom;
    const startPageNo = book.mvNoFrom + offset * book.vouchersPerBook;
    const endPageNo = startPageNo + book.vouchersPerBook - 1;

    return this.pageTrackingRepository.find({
      where: { pageNo: Between(startPageNo, endPageNo) },
      order: { pageNo: "ASC" },
    });
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
      relations: ["checkBook"],
    });
    if (!page) {
      throw new NotFoundException(
        `Cheque leaf/page number ${pageNo} not found in tracking`,
      );
    }
    if (branchId && page.checkBook?.branchId !== branchId) {
      throw new NotFoundException(
        `Cheque leaf/page number ${pageNo} not found in tracking`,
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

  async getSelectablePages(
    branchId?: string,
    accountId?: string,
    userId?: string,
  ): Promise<any[]> {
    const query = this.pageTrackingRepository
      .createQueryBuilder("pt")
      .innerJoinAndSelect("pt.checkBook", "book")
      .where("pt.isVoided = :isVoided", { isVoided: false });

    if (branchId) {
      query.andWhere("book.branchId = :branchId", { branchId });
    }

    if (accountId) {
      query.andWhere("book.bankAccountCode = :accountId", { accountId });
    }

    if (userId) {
      query.andWhere("pt.userId = :userId", { userId });
    }

    query.andWhere(
      `NOT EXISTS (
        SELECT 1
        FROM transaction_payments tp
        WHERE tp.cheque_page_id = pt.id
      )`,
    );

    const pages = await query
      .orderBy("book.dispatchDate", "DESC")
      .addOrderBy("book.no", "DESC")
      .addOrderBy("book.bookNoFrom", "ASC")
      .addOrderBy("pt.pageNo", "ASC")
      .getMany();

    // Resolve assignedBy names
    const assignedByIds = Array.from(
      new Set(pages.map((p) => p.assignedBy).filter((id): id is string => !!id && isUuid(id)))
    );
    let assignedByUsers: Array<{ id: string; name: string }> = [];
    if (assignedByIds.length > 0) {
      assignedByUsers = await this.branchRepository.manager.query(
        `SELECT id, name FROM users WHERE id = ANY($1)`,
        [assignedByIds],
      );
    }
    const assignedByMap = new Map(assignedByUsers.map((u) => [u.id, u.name]));

    // Resolve bank account labels
    const bankAccountIds = Array.from(
      new Set(
        pages
          .map((p) => p.checkBook?.bankAccountCode)
          .filter((id): id is string => !!id && isUuid(id)),
      ),
    );
    const accounts =
      bankAccountIds.length > 0
        ? await this.accountProfileRepository.find({
            where: { id: In(bankAccountIds) },
          })
        : [];
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    return pages.map((page) => ({
      id: page.id,
      checkBookId: page.checkBookId,
      userId: page.userId,
      assignedBy: page.assignedBy ?? null,
      assignedByName: page.assignedBy ? (assignedByMap.get(page.assignedBy) ?? null) : null,
      pageNo: page.pageNo,
      remarks: page.remarks ?? null,
      checkBook: page.checkBook
        ? {
            id: page.checkBook.id,
            no: page.checkBook.no,
            bookNoFrom: page.checkBook.bookNoFrom,
            bookNoTo: page.checkBook.bookNoTo,
            vouchersPerBook: page.checkBook.vouchersPerBook,
            mvNoFrom: page.checkBook.mvNoFrom,
            mvNoTo: page.checkBook.mvNoTo,
            branchId: page.checkBook.branchId,
            bankAccountCode: page.checkBook.bankAccountCode ?? null,
            bankAccountCodeLabel: page.checkBook.bankAccountCode
              ? (() => {
                  const account = accountMap.get(page.checkBook!.bankAccountCode!);
                  return account
                    ? `${account.accountCode} - ${account.accountName}`
                    : page.checkBook!.bankAccountCode;
                })()
              : null,
          }
        : null,
    }));
  }

  async searchCashierReturn(params: {
    branchId?: string;
    currentUserId: string;
    bankAccountCode: string;
    bookNo: number;
    chequeNoFrom: number;
    chequeNoTo: number;
  }): Promise<any[]> {
    const {
      branchId,
      currentUserId,
      bankAccountCode,
      bookNo,
      chequeNoFrom,
      chequeNoTo,
    } = params;

    const queryBooks = await this.checkBookRepository
      .createQueryBuilder("cb")
      .where("cb.branchId = :branchId", { branchId })
      .andWhere("cb.status = :status", { status: WorkflowStatus.APPROVE })
      .andWhere("cb.bookNoFrom <= :bookNo", { bookNo })
      .andWhere("cb.bookNoTo >= :bookNo", { bookNo })
      .andWhere(
        bankAccountCode === "ALL"
          ? "1=1"
          : "cb.bankAccountCode = :bankAccountCode",
        { bankAccountCode },
      )
      .getMany();

    if (queryBooks.length === 0) {
      return [];
    }

    const matchedPages: ChequeBookPageTracking[] = [];
    const bookMap = new Map<string, (typeof queryBooks)[0]>();

    for (const book of queryBooks) {
      bookMap.set(book.id, book);
      const offset = bookNo - book.bookNoFrom;
      const startPage = book.mvNoFrom + offset * book.vouchersPerBook;
      const endPage = startPage + book.vouchersPerBook - 1;

      const rangeStart = Math.max(chequeNoFrom, startPage);
      const rangeEnd = Math.min(chequeNoTo, endPage);

      if (rangeStart > rangeEnd) {
        continue;
      }

      const pages = await this.pageTrackingRepository
        .createQueryBuilder("pt")
        .where("pt.checkBookId = :bookId", { bookId: book.id })
        .andWhere("pt.pageNo >= :rangeStart", { rangeStart })
        .andWhere("pt.pageNo <= :rangeEnd", { rangeEnd })
        .andWhere("pt.isVoided = :isVoided", { isVoided: false })
        .andWhere("pt.userId = :currentUserId", { currentUserId })
        .getMany();

      matchedPages.push(...pages);
    }

    if (matchedPages.length === 0) {
      return [];
    }

    // Sort by pageNo
    matchedPages.sort((a, b) => a.pageNo - b.pageNo);

    // Group contiguous pages
    const groups: any[] = [];
    let currentGroup: any = null;

    for (const page of matchedPages) {
      const book = bookMap.get(page.checkBookId);
      if (!book) continue;

      if (!currentGroup) {
        currentGroup = {
          checkBookId: page.checkBookId,
          bookNo: bookNo,
          bankAccountCode: book.bankAccountCode,
          mvNoFrom: page.pageNo,
          mvNoTo: page.pageNo,
          qty: 1,
          pageIds: [page.id],
          pageNos: [page.pageNo],
          remarks: page.remarks || "",
        };
      } else {
        const isContiguous = page.pageNo === currentGroup.mvNoTo + 1;
        const sameBook = page.checkBookId === currentGroup.checkBookId;
        if (isContiguous && sameBook) {
          currentGroup.mvNoTo = page.pageNo;
          currentGroup.qty++;
          currentGroup.pageIds.push(page.id);
          currentGroup.pageNos.push(page.pageNo);
        } else {
          groups.push(currentGroup);
          currentGroup = {
            checkBookId: page.checkBookId,
            bookNo: bookNo,
            bankAccountCode: book.bankAccountCode,
            mvNoFrom: page.pageNo,
            mvNoTo: page.pageNo,
            qty: 1,
            pageIds: [page.id],
            pageNos: [page.pageNo],
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

  async validateBookRange(
    bookNoFrom: number,
    bookNoTo: number,
  ): Promise<{ valid: boolean; error?: string }> {
    const overlappingBookNo = await this.checkBookRepository
      .createQueryBuilder('book')
      .where('book.bookNoFrom <= :bookNoTo AND book.bookNoTo >= :bookNoFrom', {
        bookNoFrom,
        bookNoTo,
      })
      .andWhere('book.status != :rejected', { rejected: WorkflowStatus.REJECT })
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
    const overlapping = await this.checkBookRepository
      .createQueryBuilder('book')
      .where('book.mv_no_from <= :mvNoTo AND book.mv_no_to >= :mvNoFrom', {
        mvNoFrom,
        mvNoTo,
      })
      .andWhere('book.status != :rejected', { rejected: WorkflowStatus.REJECT })
      .getOne();

    if (overlapping) {
      return {
        valid: false,
        error: `Page number range [${mvNoFrom} - ${mvNoTo}] overlaps with existing book [${overlapping.no}] with range [${overlapping.mvNoFrom} - ${overlapping.mvNoTo}]`,
      };
    }
    return { valid: true };
  }

  async findOne(id: string): Promise<ChequeBook> {
    const book = await this.checkBookRepository.findOne({ where: { id } });
    if (!book) {
      throw new NotFoundException(`Check Book entry with ID ${id} not found`);
    }
    return book;
  }

  async reassignDispatch(id: string, dto: ReassignChequeBookDto, userId: string): Promise<ChequeBook> {
    const book = await this.checkBookRepository.findOne({ where: { id } });
    if (!book) {
      throw new NotFoundException(`Check Book entry with ID ${id} not found`);
    }

    book.assignedTo = dto.assignedTo;
    if (dto.dispatchDate !== undefined) book.dispatchDate = dto.dispatchDate;
    if (dto.bankAccountCode !== undefined) book.bankAccountCode = dto.bankAccountCode;
    if (dto.bookNoFrom !== undefined) book.bookNoFrom = dto.bookNoFrom;
    if (dto.bookNoTo !== undefined) book.bookNoTo = dto.bookNoTo;
    if (dto.vouchersPerBook !== undefined) book.vouchersPerBook = dto.vouchersPerBook;
    if (dto.mvNoFrom !== undefined) book.mvNoFrom = dto.mvNoFrom;
    if (dto.mvNoTo !== undefined) book.mvNoTo = dto.mvNoTo;
    if (dto.remarks !== undefined) book.remarks = dto.remarks;

    // Reset to PENDING for re-approval
    book.status = WorkflowStatus.PENDING;
    book.updatedBy = userId;

    return this.checkBookRepository.save(book);
  }
}
