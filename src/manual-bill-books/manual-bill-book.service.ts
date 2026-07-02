import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, Between } from 'typeorm';
import { ManualBook } from './entities/manual-book.entity';
import { ManualBookAllocation } from './entities/manual-book-allocation.entity';
import { Branch } from '../branches/branch.entity';
import { CreateManualBookDto, ApproveRejectManualBookDto, BulkReviewManualBooksDto, SaveAllocationsDto } from './dto/manual-bill-book.dto';

@Injectable()
export class ManualBillBookService {
  constructor(
    @InjectRepository(ManualBook, 'database2')
    private readonly manualBookRepository: Repository<ManualBook>,

    @InjectRepository(ManualBookAllocation, 'database2')
    private readonly allocationRepository: Repository<ManualBookAllocation>,

    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
  ) {}

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
    const branch = await this.branchRepository.findOne({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${branchId} not found`);
    }

    // Auto-calculate mvNoTo: mvNoFrom + (numBooks * vouchersPerBook) - 1
    const numBooks = bookNoTo - bookNoFrom + 1;
    const mvNoTo = mvNoFrom + (numBooks * vouchersPerBook) - 1;

    // Auto-generate branch-specific sequence number (no) e.g., MBYY00001
    const year = new Date(dispatchDate).getFullYear().toString().slice(-2); // e.g. "26"
    const prefix = `MB${year}`;

    const lastRecord = await this.manualBookRepository.findOne({
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
      status: 'Pending',
      createdBy: userId,
      updatedBy: userId,
    });

    return this.manualBookRepository.save(book);
  }

  async getNextNumber(branchId: string, dispatchDate: string): Promise<{ nextNumber: string }> {
    if (!branchId || !dispatchDate) {
      return { nextNumber: '' };
    }
    const year = new Date(dispatchDate).getFullYear().toString().slice(-2);
    const prefix = `MB${year}`;

    const lastRecord = await this.manualBookRepository.findOne({
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
    transactionType?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<any[]> {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
    if (transactionType && transactionType !== 'ALL') where.transactionType = transactionType;
    if (fromDate && toDate) {
      where.dispatchDate = Between(fromDate, toDate);
    }

    const books = await this.manualBookRepository.find({
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

    return books.map((book) => {
      const branch = branchMap.get(book.branchId);
      return {
        ...book,
        branchName: branch ? branch.name : 'Unknown Branch',
        branchCode: branch ? branch.code : '',
      };
    });
  }

  async approveOrReject(id: string, dto: ApproveRejectManualBookDto, userId: string): Promise<ManualBook> {
    const book = await this.manualBookRepository.findOne({ where: { id } });
    if (!book) {
      throw new NotFoundException(`Manual Book entry with ID ${id} not found`);
    }

    book.status = dto.status;
    book.approvalRemarks = dto.approvalRemarks;
    if (dto.fromDate) book.fromDate = dto.fromDate;
    if (dto.toDate) book.toDate = dto.toDate;
    book.approvedAt = new Date();
    book.approvedBy = userId;
    book.updatedBy = userId;

    return this.manualBookRepository.save(book);
  }

  async bulkReview(dto: BulkReviewManualBooksDto, userId: string): Promise<any[]> {
    const results = [];
    for (const item of dto.reviews) {
      const book = await this.manualBookRepository.findOne({ where: { id: item.id } });
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

  async getCashiers(branchId: string): Promise<any[]> {
    return this.manualBookRepository.manager.query(`
      SELECT u.id, u.name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.branch_id = $1 AND r.code = 'CASHIER' AND u.is_active = true
    `, [branchId]);
  }

  async saveAllocations(dto: SaveAllocationsDto, userId: string): Promise<any[]> {
    const results = [];
    for (const item of dto.allocations) {
      let allocation = await this.allocationRepository.findOne({
        where: {
          manualBookId: item.manualBookId,
          bookNo: item.bookNo,
        }
      });
      if (!allocation) {
        allocation = this.allocationRepository.create({
          manualBookId: item.manualBookId,
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
    }
    return results;
  }

  async getAllocationsByBookIds(manualBookIds: string[]): Promise<ManualBookAllocation[]> {
    if (manualBookIds.length === 0) return [];
    return this.allocationRepository.find({
      where: {
        manualBookId: In(manualBookIds),
      }
    });
  }
}
