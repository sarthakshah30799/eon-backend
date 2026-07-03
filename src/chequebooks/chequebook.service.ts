import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, Between } from 'typeorm';
import { ChequeBook } from './entities/cheque-book.entity';
import { ChequeBookAllocation } from './entities/cheque-book-allocation.entity';
import { ChequeBookPageTracking } from './entities/cheque-book-page-tracking.entity';
import { Branch } from '../branches/branch.entity';
import { AccountProfile } from '../account-profiles/account-profile.entity';
import { CreateChequeBookDto, ApproveRejectChequeBookDto, BulkReviewChequeBooksDto, SaveChequeBookAllocationsDto, UpdatePageStatusDto, ReturnPagesDto } from './dto/chequebook.dto';

@Injectable()
export class ChequeBookService {
  constructor(
    @InjectRepository(ChequeBook, 'database2')
    private readonly checkBookRepository: Repository<ChequeBook>,

    @InjectRepository(ChequeBookAllocation, 'database2')
    private readonly allocationRepository: Repository<ChequeBookAllocation>,

    @InjectRepository(ChequeBookPageTracking, 'database2')
    private readonly pageTrackingRepository: Repository<ChequeBookPageTracking>,

    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,

    @InjectRepository(AccountProfile)
    private readonly accountProfileRepository: Repository<AccountProfile>,
  ) {}

  async create(dto: CreateChequeBookDto, userId: string): Promise<ChequeBook> {
    const {
      dispatchDate,
      branchId,
      bankAccountCode,
      bookNoFrom,
      bookNoTo,
      vouchersPerBook,
      mvNoFrom,
      assignedTo,
      remarks,
    } = dto;

    // Verify branch exists in primary DB
    const branch = await this.branchRepository.findOne({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${branchId} not found`);
    }

    // Auto-calculate mvNoTo: mvNoFrom + (numBooks * vouchersPerBook) - 1
    const numBooks = bookNoTo - bookNoFrom + 1;
    const mvNoTo = mvNoFrom + (numBooks * vouchersPerBook) - 1;

    // Auto-generate branch-specific sequence number (no) e.g., CBYY00001
    const year = new Date(dispatchDate).getFullYear().toString().slice(-2); // e.g. "26"
    const prefix = `CB${year}`;

    const lastRecord = await this.checkBookRepository.findOne({
      where: {
        branchId,
        no: Like(`${prefix}%`),
      },
      order: { no: 'DESC' },
    });

    let nextSeq = 1;
    if (lastRecord) {
      const lastSeqStr = lastRecord.no.slice(prefix.length);
      const lastSeq = parseInt(lastSeqStr, 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    const no = `${prefix}${String(nextSeq).padStart(5, '0')}`;

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
      status: 'Pending',
      createdBy: userId,
      updatedBy: userId,
    });

    return this.checkBookRepository.save(book);
  }

  async getNextNumber(branchId: string, dispatchDate: string): Promise<{ nextNumber: string }> {
    if (!branchId || !dispatchDate) {
      return { nextNumber: '' };
    }
    const year = new Date(dispatchDate).getFullYear().toString().slice(-2);
    const prefix = `CB${year}`;

    const lastRecord = await this.checkBookRepository.findOne({
      where: {
        branchId,
        no: Like(`${prefix}%`),
      },
      order: { no: 'DESC' },
    });

    let nextSeq = 1;
    if (lastRecord) {
      const lastSeqStr = lastRecord.no.slice(prefix.length);
      const lastSeq = parseInt(lastSeqStr, 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    const nextNumber = `${prefix}${String(nextSeq).padStart(5, '0')}`;
    return { nextNumber };
  }

  async findAll(
    branchId?: string,
    status?: string,
    bankAccountCode?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<any[]> {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
    if (bankAccountCode && bankAccountCode !== 'ALL') where.bankAccountCode = bankAccountCode;
    if (fromDate && toDate) {
      where.dispatchDate = Between(fromDate, toDate);
    }

    const books = await this.checkBookRepository.find({
      where,
      order: { createdAt: 'DESC' },
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
    const accountIds = Array.from(new Set(books.map((b) => b.bankAccountCode).filter(Boolean)));
    const accounts = accountIds.length > 0
      ? await this.accountProfileRepository.find({ where: { id: In(accountIds) } })
      : [];
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    return books.map((book) => {
      const branch = branchMap.get(book.branchId);
      const account = accountMap.get(book.bankAccountCode);
      return {
        ...book,
        branchName: branch ? branch.name : 'Unknown Branch',
        branchCode: branch ? branch.code : '',
        bankAccountCodeLabel: account ? `${account.accountCode} - ${account.accountName}` : 'Unknown Bank Account',
        bankAccountCodeName: account ? account.accountCode : '',
      };
    });
  }

  async approveOrReject(id: string, dto: ApproveRejectChequeBookDto, userId: string): Promise<ChequeBook> {
    const book = await this.checkBookRepository.findOne({ where: { id } });
    if (!book) {
      throw new NotFoundException(`Check Book entry with ID ${id} not found`);
    }

    book.status = dto.status;
    book.approvalRemarks = dto.approvalRemarks;
    if (dto.fromDate) book.fromDate = dto.fromDate;
    if (dto.toDate) book.toDate = dto.toDate;
    book.approvedAt = new Date();
    book.approvedBy = userId;
    book.updatedBy = userId;

    return this.checkBookRepository.save(book);
  }

  async bulkReview(dto: BulkReviewChequeBooksDto, userId: string): Promise<any[]> {
    const results = [];
    for (const item of dto.reviews) {
      const book = await this.checkBookRepository.findOne({ where: { id: item.id } });
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

  async saveAllocations(dto: SaveChequeBookAllocationsDto, userId: string): Promise<any[]> {
    const results = [];
    for (const item of dto.allocations) {
      let allocation = await this.allocationRepository.findOne({
        where: {
          checkBookId: item.checkBookId,
          bookNo: item.bookNo,
        }
      });
      if (!allocation) {
        allocation = this.allocationRepository.create({
          checkBookId: item.checkBookId,
          bookNo: item.bookNo,
          cashierId: item.cashierId,
          remarks: item.remarks,
          allocatedBy: userId,
        });
      } else {
        allocation.cashierId = item.cashierId;
        allocation.remarks = item.remarks;
        allocation.allocatedBy = userId;
      }
      const saved = await this.allocationRepository.save(allocation);
      results.push(saved);

      // Initialize page tracking for every page in the allocated book
      const book = await this.checkBookRepository.findOne({ where: { id: saved.checkBookId } });
      if (book) {
        const offset = saved.bookNo - book.bookNoFrom;
        const startPageNo = book.mvNoFrom + offset * book.vouchersPerBook;
        const endPageNo = startPageNo + book.vouchersPerBook - 1;

        const existingPages = await this.pageTrackingRepository.find({
          where: { pageNo: Between(startPageNo, endPageNo) },
        });
        const existingPageNos = new Set(existingPages.map(p => p.pageNo));

        const pagesToInsert = [];
        for (let p = startPageNo; p <= endPageNo; p++) {
          if (!existingPageNos.has(p)) {
            pagesToInsert.push({
              checkBookId: saved.checkBookId,
              allocationId: saved.id,
              pageNo: p,
              status: 'Allocated',
            });
          } else {
            const existing = existingPages.find(ep => ep.pageNo === p);
            if (existing && existing.status === 'Allocated') {
              existing.allocationId = saved.id;
              await this.pageTrackingRepository.save(existing);
            }
          }
        }
        if (pagesToInsert.length > 0) {
          await this.pageTrackingRepository.insert(pagesToInsert);
        }
      }
    }
    return results;
  }

  async getAllocationsByBookIds(checkBookIds: string[]): Promise<ChequeBookAllocation[]> {
    if (checkBookIds.length === 0) return [];
    return this.allocationRepository.find({
      where: {
        checkBookId: In(checkBookIds),
      }
    });
  }

  async getPagesByAllocationId(allocationId: string): Promise<ChequeBookPageTracking[]> {
    return this.pageTrackingRepository.find({
      where: { allocationId },
      order: { pageNo: 'ASC' },
    });
  }

  async updatePagesStatus(dto: UpdatePageStatusDto, userId: string): Promise<any> {
    const { pageNos, status, remarks } = dto;
    await this.pageTrackingRepository.update(
      { pageNo: In(pageNos) },
      {
        status,
        remarks,
        updatedBy: userId,
      }
    );
    return { success: true };
  }

  async returnPages(dto: ReturnPagesDto): Promise<any> {
    const { pageNos } = dto;
    await this.pageTrackingRepository.delete({
      pageNo: In(pageNos),
      status: 'Allocated',
    });
    return { success: true };
  }

  async searchPage(pageNo: number): Promise<any> {
    const page = await this.pageTrackingRepository.findOne({
      where: { pageNo },
      relations: ['checkBook', 'allocation'],
    });
    if (!page) {
      throw new NotFoundException(`Cheque leaf/page number ${pageNo} not found in tracking`);
    }
    return page;
  }
}
