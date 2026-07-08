import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ExpenseIncomeBookingMaster } from './expense-income-booking-master.entity';
import { CreateExpenseIncomeBookingMasterDto, BookingMasterType } from './dto/create-expense-income-booking-master.dto';
import { ExpenseIncomeBookingMasterListQueryDto } from './dto/expense-income-booking-master-list-query.dto';
import { UpdateExpenseIncomeBookingMasterDto } from './dto/update-expense-income-booking-master.dto';
import { ExpenseIncomeBookingMasterResponseDto } from './dto/expense-income-booking-master-response.dto';

@Injectable()
export class ExpenseIncomeBookingMasterService {
  constructor(
    @InjectRepository(ExpenseIncomeBookingMaster)
    private readonly repository: Repository<ExpenseIncomeBookingMaster>,
  ) {}

  async findAll(query?: ExpenseIncomeBookingMasterListQueryDto): Promise<ExpenseIncomeBookingMasterResponseDto[]> {
    const qb = this.repository
      .createQueryBuilder('master')
      .leftJoinAndSelect('master.tdsAccount', 'tdsAccount')
      .orderBy('master.code', 'ASC');

    if (query?.type) {
      qb.andWhere('master.type = :type', { type: query.type });
    }

    const trimmedSearch = query?.search?.trim();
    if (trimmedSearch) {
      qb.andWhere(
        new Brackets(searchQb => {
          searchQb
            .where('master.code ILIKE :search', { search: `%${trimmedSearch}%` })
            .orWhere('master.description ILIKE :search', { search: `%${trimmedSearch}%` });
        }),
      );
    }

    const masters = await qb.getMany();

    return masters.map(ExpenseIncomeBookingMasterResponseDto.fromEntity);
  }

  async findById(id: string): Promise<ExpenseIncomeBookingMasterResponseDto> {
    const master = await this.repository.findOne({
      where: { id },
      relations: ['tdsAccount'],
    });

    if (!master) {
      throw new NotFoundException(`Expense/Income Booking Master with id ${id} not found`);
    }

    return ExpenseIncomeBookingMasterResponseDto.fromEntity(master);
  }

  async create(
    dto: CreateExpenseIncomeBookingMasterDto,
    userId: string,
  ): Promise<ExpenseIncomeBookingMasterResponseDto> {
    const code = dto.code.trim().toUpperCase();
    await this.ensureCodeIsUnique(code, dto.type);
    this.ensureValidDateRange(dto.from, dto.to);

    const master = this.repository.create({
      type: dto.type,
      code,
      description: dto.description?.trim() || null,
      applicableCustomer: dto.type === BookingMasterType.INCOME ? (dto.applicableCustomer ?? false) : false,
      applicableVendor: dto.type === BookingMasterType.EXPENSE ? (dto.applicableVendor ?? false) : false,
      applicableEmployee: dto.type === BookingMasterType.EXPENSE ? (dto.applicableEmployee ?? false) : false,
      applicableAgent: dto.type === BookingMasterType.EXPENSE ? (dto.applicableAgent ?? false) : false,
      applicableCardIssuer: dto.applicableCardIssuer ?? false,
      active: dto.active ?? true,
      allowRecPay: dto.type === BookingMasterType.INCOME ? (dto.allowRecPay ?? false) : false,
      totalGst: dto.totalGst ?? 0.00,
      tdsApplicable: dto.tdsApplicable ?? false,
      tdsValue: dto.tdsValue ?? 0.00,
      tdsAccountId: dto.tdsApplicable ? (dto.tdsAccountId || null) : null,
      from: dto.from ? new Date(dto.from) : null,
      to: dto.to ? new Date(dto.to) : null,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.repository.save(master);
    return this.findById(saved.id);
  }

  async update(
    id: string,
    dto: UpdateExpenseIncomeBookingMasterDto,
    userId: string,
  ): Promise<ExpenseIncomeBookingMasterResponseDto> {
    const master = await this.repository.findOne({
      where: { id },
    });

    if (!master) {
      throw new NotFoundException(`Expense/Income Booking Master with id ${id} not found`);
    }

    const { code: _code, ...updatableFields } = dto;
    const resolvedType = updatableFields.type ?? master.type;

    if (updatableFields.type !== undefined) {
      master.type = updatableFields.type;
    }

    if (updatableFields.description !== undefined) {
      master.description = updatableFields.description?.trim() || null;
    }

    if (updatableFields.applicableCustomer !== undefined) {
      master.applicableCustomer = updatableFields.applicableCustomer;
    }

    if (updatableFields.applicableVendor !== undefined) {
      master.applicableVendor = updatableFields.applicableVendor;
    }

    if (updatableFields.applicableEmployee !== undefined) {
      master.applicableEmployee = updatableFields.applicableEmployee;
    }

    if (updatableFields.applicableAgent !== undefined) {
      master.applicableAgent = updatableFields.applicableAgent;
    }

    if (updatableFields.applicableCardIssuer !== undefined) {
      master.applicableCardIssuer = updatableFields.applicableCardIssuer;
    }

    if (updatableFields.active !== undefined) {
      master.active = updatableFields.active;
    }

    if (updatableFields.allowRecPay !== undefined) {
      master.allowRecPay = updatableFields.allowRecPay;
    }

    if (updatableFields.totalGst !== undefined) {
      master.totalGst = updatableFields.totalGst;
    }

    if (updatableFields.tdsApplicable !== undefined) {
      master.tdsApplicable = updatableFields.tdsApplicable;
    }

    // Enforce business rules based on resolved type
    if (resolvedType === BookingMasterType.EXPENSE) {
      master.allowRecPay = false;
      master.applicableCustomer = false;
    } else if (resolvedType === BookingMasterType.INCOME) {
      master.applicableAgent = false;
      master.applicableVendor = false;
      master.applicableEmployee = false;
    }

    if (updatableFields.tdsValue !== undefined) {
      master.tdsValue = updatableFields.tdsValue;
    }

    if (updatableFields.tdsAccountId !== undefined) {
      master.tdsAccountId = updatableFields.tdsAccountId;
    }

    // Clear tds fields if tds is no longer applicable
    if (master.tdsApplicable === false) {
      master.tdsValue = 0.00;
      master.tdsAccountId = null;
    }

    if (updatableFields.from !== undefined || updatableFields.to !== undefined) {
      const nextFrom =
        updatableFields.from !== undefined
          ? (updatableFields.from ? new Date(updatableFields.from) : null)
          : master.from;
      const nextTo =
        updatableFields.to !== undefined
          ? (updatableFields.to ? new Date(updatableFields.to) : null)
          : master.to;
      this.ensureValidDateRange(
        nextFrom ? nextFrom.toISOString() : null,
        nextTo ? nextTo.toISOString() : null,
      );
      master.from = nextFrom;
      master.to = nextTo;
    }

    master.updatedBy = userId;
    this.ensureValidDateRange(
      master.from ? master.from.toISOString() : null,
      master.to ? master.to.toISOString() : null,
    );

    await this.repository.save(master);
    return this.findById(id);
  }

  async delete(id: string): Promise<{ message: string }> {
    const master = await this.repository.findOne({ where: { id } });

    if (!master) {
      throw new NotFoundException(`Expense/Income Booking Master with id ${id} not found`);
    }

    await this.repository.remove(master);
    return { message: `Expense/Income Booking Master with id ${id} deleted successfully` };
  }

  private async ensureCodeIsUnique(code: string, type: BookingMasterType, excludeId?: string) {
    const existing = await this.repository.findOne({
      where: { code, type },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`${type} Booking Master with code "${code}" already exists`);
    }
  }

  private ensureValidDateRange(from?: string | null, to?: string | null) {
    if (!from || !to) {
      return;
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid date range');
    }

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('"from" date cannot be later than "to" date');
    }
  }
}
