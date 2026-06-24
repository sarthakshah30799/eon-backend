import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseIncomeBookingMaster } from './expense-income-booking-master.entity';
import { CreateExpenseIncomeBookingMasterDto, BookingMasterType } from './dto/create-expense-income-booking-master.dto';
import { UpdateExpenseIncomeBookingMasterDto } from './dto/update-expense-income-booking-master.dto';
import { ExpenseIncomeBookingMasterResponseDto } from './dto/expense-income-booking-master-response.dto';

@Injectable()
export class ExpenseIncomeBookingMasterService {
  constructor(
    @InjectRepository(ExpenseIncomeBookingMaster)
    private readonly repository: Repository<ExpenseIncomeBookingMaster>,
  ) {}

  async findAll(type?: BookingMasterType): Promise<ExpenseIncomeBookingMasterResponseDto[]> {
    const whereClause = type ? { type } : {};
    const masters = await this.repository.find({
      where: whereClause,
      relations: ['tdsAccount'],
      order: {
        code: 'ASC',
      },
    });

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
      interstateTransaction: dto.interstateTransaction ?? false,
      code,
      description: dto.description?.trim() || null,
      applicableCustomer: dto.applicableCustomer ?? false,
      applicableVendor: dto.applicableVendor ?? false,
      applicableEmployee: dto.applicableEmployee ?? false,
      applicableAgent: dto.applicableAgent ?? false,
      applicableTcIssuer: dto.applicableTcIssuer ?? false,
      active: dto.active ?? true,
      allowRecPay: dto.allowRecPay ?? false,
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

    const type = dto.type ?? (master.type as BookingMasterType);

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      await this.ensureCodeIsUnique(code, type, id);
      master.code = code;
    }

    if (dto.type !== undefined) {
      master.type = dto.type;
    }

    if (dto.interstateTransaction !== undefined) {
      master.interstateTransaction = dto.interstateTransaction;
    }

    if (dto.description !== undefined) {
      master.description = dto.description?.trim() || null;
    }

    if (dto.applicableCustomer !== undefined) {
      master.applicableCustomer = dto.applicableCustomer;
    }

    if (dto.applicableVendor !== undefined) {
      master.applicableVendor = dto.applicableVendor;
    }

    if (dto.applicableEmployee !== undefined) {
      master.applicableEmployee = dto.applicableEmployee;
    }

    if (dto.applicableAgent !== undefined) {
      master.applicableAgent = dto.applicableAgent;
    }

    if (dto.applicableTcIssuer !== undefined) {
      master.applicableTcIssuer = dto.applicableTcIssuer;
    }

    if (dto.active !== undefined) {
      master.active = dto.active;
    }

    if (dto.allowRecPay !== undefined) {
      master.allowRecPay = dto.allowRecPay;
    }

    if (dto.totalGst !== undefined) {
      master.totalGst = dto.totalGst;
    }

    if (dto.tdsApplicable !== undefined) {
      master.tdsApplicable = dto.tdsApplicable;
    }

    if (dto.tdsValue !== undefined) {
      master.tdsValue = dto.tdsValue;
    }

    if (dto.tdsAccountId !== undefined) {
      master.tdsAccountId = dto.tdsAccountId;
    }

    // Clear tds fields if tds is no longer applicable
    if (master.tdsApplicable === false) {
      master.tdsValue = 0.00;
      master.tdsAccountId = null;
    }

    if (dto.from !== undefined || dto.to !== undefined) {
      const nextFrom =
        dto.from !== undefined ? (dto.from ? new Date(dto.from) : null) : master.from;
      const nextTo =
        dto.to !== undefined ? (dto.to ? new Date(dto.to) : null) : master.to;
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
