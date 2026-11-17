import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { DataSource, Repository } from "typeorm";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { Branch } from "../branches/branch.entity";
import { BranchCounter } from "../branches/entities/branch-counter.entity";
import { assertCounterBelongsToBranch } from "../branches/branch-counter.access";
import { Counter } from "../counters/counter.entity";
import { DayEndStartProcessService } from "../day-end-start-process/day-end-start-process.service";
import { PartyProfile } from "../party-profiles/party-profile.entity";
import { PartyProfileService } from "../party-profiles/party-profile.service";
import { WorkflowStatus } from "../common/enums/workflow-status.enum";
import { loadEntitySnapshot } from "../common/snapshot/entity-snapshot.util";
import {
  applyPagination,
  buildPaginatedResponse,
  normalizePagination,
  PaginatedResponseDto,
} from "../common/pagination";
import { Transaction } from "../transactions/entities/transaction.entity";
import {
  TransactionStatus,
  TransactionType,
} from "../transactions/transactions.enums";
import { User } from "../users/user.entity";
import { AccountingVoucher } from "../vouchers/entities/accounting-voucher.entity";
import { VoucherType } from "../vouchers/voucher.enums";
import { VoucherService, VoucherSession } from "../vouchers/voucher.service";
import {
  ADVANCE_ADJUSTMENT_NUMBER_SERIES,
  AdvanceAdjustmentLogAction,
  AdvanceAdjustmentPrintCopyType,
  AdvanceAdjustmentStatus,
} from "./advance-adjustment.enums";
import {
  AdvanceAdjustmentQueryDto,
  AvailableAdvanceForAdjustmentQueryDto,
  OutstandingSalesForAdjustmentQueryDto,
} from "./dto/advance-adjustment-query.dto";
import {
  AdvanceAdjustmentResponseDto,
  OutstandingSaleForAdjustmentDto,
} from "./dto/advance-adjustment-response.dto";
import { CreateAdvanceAdjustmentDto } from "./dto/create-advance-adjustment.dto";
import { RecordAdvanceAdjustmentPrintDto } from "./dto/record-advance-adjustment-print.dto";
import { AdvanceAdjustment } from "./entities/advance-adjustment.entity";
import { AdvanceAdjustmentItem } from "./entities/advance-adjustment-item.entity";
import { AdvanceAdjustmentLog } from "./entities/advance-adjustment-log.entity";

const normalize = (value: unknown) => String(value ?? "").trim();
const normalizeUpper = (value: unknown) =>
  normalize(value)
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
const toDateOnly = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = normalize(value);
  return raw ? raw.slice(0, 10) : null;
};
const money = (centsValue: number) => (centsValue / 100).toFixed(2);
const cents = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric))
    throw new BadRequestException("Amount is invalid");
  return Math.round(numeric * 100);
};

const isIndividualToken = (value: unknown) =>
  normalizeUpper(value) === "INDIVIDUAL";
const isIndividualParty = (party: PartyProfile) =>
  Boolean(party.isIndividual) ||
  isIndividualToken(party.entityType?.value) ||
  isIndividualToken(party.entityType?.label);

@Injectable()
export class AdvanceAdjustmentService {
  constructor(
    @InjectDataSource("database2") private readonly database2: DataSource,
    @InjectRepository(AdvanceAdjustment, "database2")
    private readonly advanceAdjustmentRepository: Repository<AdvanceAdjustment>,
    @InjectRepository(AdvanceAdjustmentLog, "database2")
    private readonly logRepository: Repository<AdvanceAdjustmentLog>,
    @InjectRepository(Transaction, "database2")
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(PartyProfile)
    private readonly partyRepository: Repository<PartyProfile>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    @InjectRepository(BranchCounter)
    private readonly branchCounterRepository: Repository<BranchCounter>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly additionalSettings: AdditionalSettingService,
    private readonly dayPolicy: DayEndStartProcessService,
    private readonly partyProfileService: PartyProfileService,
    private readonly voucherService: VoucherService,
  ) {}

  private getActor(session: VoucherSession) {
    const actorId = normalize(session.userId);
    if (!actorId) throw new ForbiddenException("Authenticated user required");
    return actorId;
  }

  private async resolveActorName(actorId: string) {
    const user = await this.userRepository.findOne({
      where: { id: actorId },
      select: { id: true, name: true, email: true },
    });
    return normalize(user?.name) || normalize(user?.email) || null;
  }

  private isPrivileged(session: VoucherSession) {
    return Boolean(session.isAdmin || session.isHo || session.isHoStaff);
  }

  private async isHoApprover(session: VoucherSession) {
    if (this.isPrivileged(session)) return true;
    const branchId = normalize(session.activeBranchId);
    if (!branchId) return false;
    const branch = await this.branchRepository.findOne({
      where: { id: branchId, isActive: true },
    });
    return Boolean(branch?.isHeadOffice);
  }

  private async snapshot(repository: Repository<any>, id: string) {
    const value = await loadEntitySnapshot(repository, id);
    if (!value) throw new NotFoundException(`Reference ${id} not found`);
    return value as Record<string, any>;
  }

  private billOutstandingCents(transaction: Transaction) {
    return (
      cents(transaction.finalAmount) -
      cents(transaction.byCash ?? 0) -
      cents(transaction.byCheque ?? 0) -
      cents(transaction.byCard ?? 0) -
      cents(transaction.byTransfer ?? 0) -
      cents(transaction.byOther ?? 0)
    );
  }

  async create(
    dto: CreateAdvanceAdjustmentDto,
    session: VoucherSession,
  ): Promise<AdvanceAdjustmentResponseDto> {
    const actorId = this.getActor(session);

    await this.dayPolicy.assertTransactionDateAllowed(
      dto.branchId,
      actorId,
      dto.transactionDate,
      dto.counterId,
    );

    const branch = await this.branchRepository.findOne({
      where: { id: dto.branchId, isActive: true },
    });
    if (!branch) throw new NotFoundException("Branch not found or inactive");

    const counter = await this.counterRepository.findOne({
      where: { id: dto.counterId, isActive: true },
    });
    if (!counter) throw new NotFoundException("Counter not found or inactive");

    await assertCounterBelongsToBranch(
      this.branchCounterRepository,
      branch.id,
      counter.id,
    );

    const party = await this.partyRepository.findOne({
      where: { id: dto.partyProfileId, active: true },
      relations: ["entityType", "group"],
    });
    if (!party)
      throw new NotFoundException("Party profile not found or inactive");
    if (party.status !== WorkflowStatus.APPROVE)
      throw new BadRequestException("Party profile is not approved");

    const partyResult = await this.partyProfileService.findAll(
      {
        offset: 0,
        limit: 100,
        search: party.code,
        type: [party.type],
        branchIds: [branch.id],
        activeOnly: true,
        status: WorkflowStatus.APPROVE,
      },
      actorId,
      branch.id,
    );
    if (!partyResult.data.some((item) => item.id === party.id)) {
      throw new ForbiddenException(
        `Party profile ${party.code} is not visible to branch ${branch.code}`,
      );
    }

    const individual = isIndividualParty(party);
    let panNumber: string | null = null;
    let panName: string | null = null;
    let panDob: string | null = null;

    if (individual) {
      panNumber = normalize(dto.panNumber) || null;
      panName = normalize(dto.panName) || null;
      panDob = dto.panDob ? toDateOnly(dto.panDob) : null;
    } else {
      panNumber = normalize(party.panNo) || normalize(dto.panNumber) || null;
      panName =
        normalize(party.panName) ||
        normalize(party.name) ||
        normalize(dto.panName) ||
        null;
      panDob = party.panDob
        ? toDateOnly(party.panDob)
        : dto.panDob
          ? toDateOnly(dto.panDob)
          : null;
    }

    if (individual && !panNumber) {
      throw new BadRequestException(
        "PAN card number is required for individual advance adjustment",
      );
    }

    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException(
        "At least one outstanding sale must be selected for adjustment",
      );
    }

    const transactionIds = dto.items.map((i) => i.transactionId);
    if (new Set(transactionIds).size !== transactionIds.length) {
      throw new BadRequestException("Duplicate sale transactions selected");
    }

    const asOnDate = dto.asOnDate.slice(0, 10);
    const transactionDate = dto.transactionDate.slice(0, 10);
    const narration = normalize(dto.narration);
    if (!narration) {
      throw new BadRequestException("Narration is required");
    }

    const [branchSnapshot, counterSnapshot, partyProfileSnapshot] =
      await Promise.all([
        this.snapshot(this.branchRepository, branch.id),
        this.snapshot(this.counterRepository, counter.id),
        this.snapshot(this.partyRepository, party.id),
      ]);

    const number = await this.additionalSettings.reserveTransactionNumber(
      ADVANCE_ADJUSTMENT_NUMBER_SERIES,
      branch.code,
      new Date(dto.transactionDate),
    );

    const headerId = randomUUID();
    const queryRunner2 = this.database2.createQueryRunner();
    await queryRunner2.connect();
    await queryRunner2.startTransaction();

    try {
      const headerRepo2 = queryRunner2.manager.getRepository(AdvanceAdjustment);
      const itemRepo2 =
        queryRunner2.manager.getRepository(AdvanceAdjustmentItem);
      const logRepo2 = queryRunner2.manager.getRepository(AdvanceAdjustmentLog);
      const txRepo2 = queryRunner2.manager.getRepository(Transaction);
      const voucherRepo2 =
        queryRunner2.manager.getRepository(AccountingVoucher);

      const receipt = await voucherRepo2.findOne({
        where: { id: dto.receiptVoucherId },
        lock: { mode: "pessimistic_write" },
      });
      if (!receipt) {
        throw new NotFoundException("Advance receipt voucher not found");
      }
      if (receipt.voucherType !== VoucherType.RECEIPT) {
        throw new BadRequestException(
          "Selected voucher is not a receipt voucher",
        );
      }
      if (receipt.branchId !== branch.id) {
        throw new BadRequestException(
          "Advance receipt branch does not match selected branch",
        );
      }
      if (receipt.partyProfileId && receipt.partyProfileId !== party.id) {
        throw new BadRequestException(
          "Advance receipt party does not match selected party",
        );
      }

      const receiptDate = toDateOnly(receipt.transactionDate) ?? "";
      if (transactionDate < receiptDate) {
        throw new BadRequestException(
          `Adjustment date ${transactionDate} cannot be before receipt date ${receiptDate}`,
        );
      }

      const availableRows =
        await this.voucherService.getAvailableAdvancesForRefund({
          panNumber: panNumber || normalize(receipt.panNumber),
          partyProfileId: party.id,
          branchId: branch.id,
          asOnDate,
        });
      const availableRow = availableRows.find((row) => row.id === receipt.id);
      const availableCents = cents(availableRow?.availableAmount ?? 0);
      if (availableCents <= 0) {
        throw new BadRequestException(
          `Advance receipt ${receipt.number} has no available balance`,
        );
      }

      const receiptVoucherSnapshot = {
        id: receipt.id,
        number: receipt.number,
        finalAmount: receipt.finalAmount,
        transactionDate: toDateOnly(receipt.transactionDate),
      };

      let totalCents = 0;
      let lineNo = 1;
      const preparedItems: Array<{
        locked: Transaction;
        outstandingCents: number;
        adjustmentCents: number;
        lineNo: number;
      }> = [];

      for (const item of dto.items) {
        const locked = await txRepo2.findOne({
          where: { id: item.transactionId },
          lock: { mode: "pessimistic_write" },
        });

        if (!locked) {
          throw new BadRequestException(
            `Sale transaction ${item.transactionId} not found`,
          );
        }
        if (locked.transactionType !== TransactionType.SALE) {
          throw new BadRequestException(
            `Transaction ${locked.number} is not a sale`,
          );
        }
        if (locked.status !== TransactionStatus.APPROVED) {
          throw new BadRequestException(
            `Sale ${locked.number} must be approved`,
          );
        }
        if (!locked.isLatest) {
          throw new BadRequestException(
            `Sale ${locked.number} must be the latest revision`,
          );
        }
        if (locked.partyProfileId !== party.id) {
          throw new BadRequestException(
            `Sale ${locked.number} party does not match selected party`,
          );
        }
        if (locked.branchId !== branch.id) {
          throw new BadRequestException(
            `Sale ${locked.number} branch does not match selected branch`,
          );
        }
        const saleDate = toDateOnly(locked.transactionDate) ?? "";
        if (saleDate > asOnDate) {
          throw new BadRequestException(
            `Sale ${locked.number} date ${saleDate} is after as-on date ${asOnDate}`,
          );
        }
        if (transactionDate < saleDate) {
          throw new BadRequestException(
            `Adjustment date ${transactionDate} cannot be before sale date ${saleDate}`,
          );
        }

        const outstandingCents = this.billOutstandingCents(locked);
        if (outstandingCents <= 0) {
          throw new BadRequestException(
            `Sale ${locked.number} has no outstanding balance`,
          );
        }

        const adjustmentCents = cents(item.adjustmentAmount);
        if (adjustmentCents <= 0) {
          throw new BadRequestException(
            "Adjustment amount must be greater than zero",
          );
        }
        if (adjustmentCents > outstandingCents) {
          throw new BadRequestException(
            `Adjustment amount ${item.adjustmentAmount} exceeds outstanding ${money(outstandingCents)} for sale ${locked.number}`,
          );
        }

        totalCents += adjustmentCents;
        preparedItems.push({
          locked,
          outstandingCents,
          adjustmentCents,
          lineNo: lineNo++,
        });
      }

      if (totalCents > availableCents) {
        throw new BadRequestException(
          `Total adjustment ${money(totalCents)} exceeds available advance ${money(availableCents)} on receipt ${receipt.number}`,
        );
      }

      const totalAdjustmentAmount = money(totalCents);
      const jv = await this.voucherService.createAdvanceAdjustmentJournalVoucher(
        {
          advanceAdjustmentId: headerId,
          branchId: branch.id,
          counterId: counter.id,
          transactionDate,
          narration,
          party,
          pan: { panNumber, panName, panDob },
          items: preparedItems.map((row) => ({
            transactionId: row.locked.id,
            amount: money(row.adjustmentCents),
            transactionNumber: row.locked.number,
            transactionSnapshot: {
              id: row.locked.id,
              number: row.locked.number,
              transactionDate: toDateOnly(row.locked.transactionDate),
              transactionType: row.locked.transactionType,
              slug: row.locked.slug,
              finalAmount: row.locked.finalAmount,
            },
          })),
          totalAmount: totalAdjustmentAmount,
          actorId,
        },
        queryRunner2.manager,
      );

      const header = headerRepo2.create({
        id: headerId,
        createdBy: actorId,
        updatedBy: actorId,
        number,
        branchId: branch.id,
        branchSnapshot,
        counterId: counter.id,
        counterSnapshot,
        transactionDate,
        asOnDate,
        partyProfileId: party.id,
        partyProfileSnapshot,
        panNumber,
        panName,
        panDob,
        status: AdvanceAdjustmentStatus.COMPLETED,
        totalAdjustmentAmount,
        narration,
        receiptVoucherId: receipt.id,
        receiptVoucherSnapshot,
        journalVoucherId: jv.id,
      });
      const savedHeader = await headerRepo2.save(header);

      const createdItems: AdvanceAdjustmentItem[] = [];
      for (const row of preparedItems) {
        row.locked.byOther = money(
          cents(row.locked.byOther ?? 0) + row.adjustmentCents,
        );
        row.locked.updatedBy = actorId;
        await txRepo2.save(row.locked);

        createdItems.push(
          await itemRepo2.save(
            itemRepo2.create({
              createdBy: actorId,
              updatedBy: actorId,
              advanceAdjustmentId: savedHeader.id,
              lineNo: row.lineNo,
              transactionId: row.locked.id,
              transactionSnapshot: {
                id: row.locked.id,
                number: row.locked.number,
                transactionDate: toDateOnly(row.locked.transactionDate),
                transactionType: row.locked.transactionType,
                slug: row.locked.slug,
                finalAmount: row.locked.finalAmount,
                partyProfileId: row.locked.partyProfileId,
                partyProfileSnapshot: row.locked.partyProfileSnapshot ?? null,
                agentProfileSnapshot: row.locked.agentProfileSnapshot ?? null,
                passengerSnapshot: row.locked.passengerSnapshot ?? null,
              },
              finalAmount: money(cents(row.locked.finalAmount)),
              outstandingAmount: money(row.outstandingCents),
              adjustmentAmount: money(row.adjustmentCents),
            }),
          ),
        );
      }

      const performedByName = await this.resolveActorName(actorId);
      await logRepo2.save(
        logRepo2.create({
          advanceAdjustmentId: savedHeader.id,
          action: AdvanceAdjustmentLogAction.CREATE,
          message: "Advance adjustment created",
          afterSnapshot: {
            id: savedHeader.id,
            number: savedHeader.number,
            status: savedHeader.status,
            totalAdjustmentAmount: savedHeader.totalAdjustmentAmount,
            receiptVoucherId: savedHeader.receiptVoucherId,
            journalVoucherId: savedHeader.journalVoucherId,
          },
          metadata: {
            itemCount: createdItems.length,
            receiptVoucherNumber: receipt.number,
            journalVoucherNumber: jv.number,
          },
          performedById: actorId,
          performedByName,
          createdBy: actorId,
          updatedBy: actorId,
        }),
      );

      await queryRunner2.commitTransaction();

      savedHeader.items = createdItems;
      return AdvanceAdjustmentResponseDto.fromEntity(savedHeader);
    } catch (err) {
      await queryRunner2.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner2.release();
    }
  }

  async findAll(
    query: AdvanceAdjustmentQueryDto,
    session: VoucherSession,
  ): Promise<PaginatedResponseDto<AdvanceAdjustmentResponseDto>> {
    const isHo = await this.isHoApprover(session);
    const effectiveBranchId = isHo
      ? query.branchId
      : normalize(session.activeBranchId) || query.branchId;

    const qb = this.advanceAdjustmentRepository
      .createQueryBuilder("aa")
      .leftJoinAndSelect("aa.items", "items")
      .orderBy("aa.createdAt", "DESC");

    if (effectiveBranchId) {
      qb.andWhere("aa.branchId = :branchId", { branchId: effectiveBranchId });
    }

    if (query.partyProfileId) {
      qb.andWhere("aa.partyProfileId = :partyProfileId", {
        partyProfileId: query.partyProfileId,
      });
    }

    if (query.status) {
      qb.andWhere("aa.status = :status", { status: query.status });
    }

    if (query.dateFrom) {
      qb.andWhere("aa.transactionDate >= :dateFrom", {
        dateFrom: query.dateFrom.slice(0, 10),
      });
    }

    if (query.dateTo) {
      qb.andWhere("aa.transactionDate <= :dateTo", {
        dateTo: query.dateTo.slice(0, 10),
      });
    }

    if (query.search) {
      const s = `%${query.search.toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(aa.number) LIKE :s OR LOWER(aa.partyProfileSnapshot->>'name') LIKE :s OR LOWER(aa.panNumber) LIKE :s)",
        { s },
      );
    }

    const { limit, offset } = normalizePagination(query);
    applyPagination(qb, { limit, offset });

    const [records, total] = await qb.getManyAndCount();

    return buildPaginatedResponse(
      records.map((r) => AdvanceAdjustmentResponseDto.fromEntity(r)),
      total,
      { limit, offset },
    );
  }

  async findById(
    id: string,
    session: VoucherSession,
  ): Promise<AdvanceAdjustmentResponseDto> {
    const record = await this.advanceAdjustmentRepository.findOne({
      where: { id },
      relations: ["items", "logs"],
      order: { logs: { performedAt: "DESC" } },
    });

    if (!record) {
      throw new NotFoundException("Advance adjustment not found");
    }

    const isHo = await this.isHoApprover(session);
    if (
      !isHo &&
      session.activeBranchId &&
      record.branchId !== session.activeBranchId
    ) {
      throw new ForbiddenException(
        "You do not have access to advance adjustments of other branches",
      );
    }

    return AdvanceAdjustmentResponseDto.fromEntity(record);
  }

  async recordPrint(
    id: string,
    dto: RecordAdvanceAdjustmentPrintDto,
    session: VoucherSession,
  ): Promise<{
    message: string;
    copyType: AdvanceAdjustmentPrintCopyType;
    printCount: number;
  }> {
    const actorId = this.getActor(session);
    const record = await this.advanceAdjustmentRepository.findOne({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException("Advance adjustment not found");
    }

    const isHo = await this.isHoApprover(session);
    if (
      !isHo &&
      session.activeBranchId &&
      record.branchId !== session.activeBranchId
    ) {
      throw new ForbiddenException(
        "You do not have access to advance adjustments of other branches",
      );
    }

    if (record.status !== AdvanceAdjustmentStatus.COMPLETED) {
      throw new BadRequestException(
        "Only completed advance adjustments can be printed",
      );
    }

    if (dto.sendEmail) {
      throw new BadRequestException(
        "Email delivery for advance adjustment print is not enabled yet",
      );
    }

    const existingPrintCount = await this.logRepository.count({
      where: {
        advanceAdjustmentId: id,
        action: AdvanceAdjustmentLogAction.PRINT,
      },
    });
    const copyType =
      existingPrintCount === 0
        ? AdvanceAdjustmentPrintCopyType.CUSTOMER_COPY
        : AdvanceAdjustmentPrintCopyType.DUPLICATE_COPY;
    const message =
      copyType === AdvanceAdjustmentPrintCopyType.DUPLICATE_COPY
        ? "Duplicate copy printed"
        : "Original copy printed";
    const performedByName = await this.resolveActorName(actorId);

    await this.logRepository.save(
      this.logRepository.create({
        advanceAdjustmentId: id,
        action: AdvanceAdjustmentLogAction.PRINT,
        message,
        metadata: {
          copyType,
          requestedCopyType: dto.copyType ?? null,
          sendEmail: Boolean(dto.sendEmail),
          subject: dto.subject || null,
        },
        performedById: actorId,
        performedByName,
        createdBy: actorId,
        updatedBy: actorId,
      }),
    );

    return {
      message,
      copyType,
      printCount: existingPrintCount + 1,
    };
  }

  async getAvailableAdvances(
    query: AvailableAdvanceForAdjustmentQueryDto,
    session: VoucherSession,
  ) {
    const isHo = await this.isHoApprover(session);
    const branchId = isHo
      ? query.branchId || normalize(session.activeBranchId)
      : normalize(session.activeBranchId) || query.branchId;

    if (!branchId) {
      throw new BadRequestException("Branch ID is required");
    }

    const normalizedPan = normalizeUpper(query.panNumber);
    if (!normalizedPan) {
      throw new BadRequestException(
        "PAN card number is required to find available advances",
      );
    }

    return this.voucherService.getAvailableAdvancesForRefund({
      panNumber: normalizedPan,
      partyProfileId: query.partyProfileId,
      branchId,
      asOnDate: query.asOnDate || new Date().toISOString().slice(0, 10),
      search: query.search,
    });
  }

  async getOutstandingSales(
    query: OutstandingSalesForAdjustmentQueryDto,
    session: VoucherSession,
  ): Promise<PaginatedResponseDto<OutstandingSaleForAdjustmentDto>> {
    const isHo = await this.isHoApprover(session);
    const branchId = isHo
      ? query.branchId
      : normalize(session.activeBranchId) || query.branchId;

    if (!branchId) {
      throw new BadRequestException("Branch ID is required");
    }
    if (!isHo && branchId !== query.branchId) {
      throw new ForbiddenException(
        "Outstanding sales lookup is outside the active workplace branch",
      );
    }

    const branch = await this.branchRepository.findOne({
      where: { id: branchId, isActive: true },
    });
    if (!branch) throw new NotFoundException("Branch not found or inactive");

    const counter = await this.counterRepository.findOne({
      where: { id: query.counterId, isActive: true },
    });
    if (!counter) throw new NotFoundException("Counter not found or inactive");

    await assertCounterBelongsToBranch(
      this.branchCounterRepository,
      branch.id,
      counter.id,
    );

    const party = await this.partyRepository.findOne({
      where: { id: query.partyProfileId, active: true },
    });
    if (!party)
      throw new NotFoundException("Party profile not found or inactive");

    const asOnDate = query.asOnDate.slice(0, 10);
    const pagination = normalizePagination(query);

    const qb = this.transactionRepository
      .createQueryBuilder("tx")
      .where("tx.partyProfileId = :partyProfileId", {
        partyProfileId: party.id,
      })
      .andWhere("tx.transactionType = :transactionType", {
        transactionType: TransactionType.SALE,
      })
      .andWhere("tx.branchId = :branchId", { branchId: branch.id })
      .andWhere("tx.status = :status", { status: TransactionStatus.APPROVED })
      .andWhere("tx.isLatest = true")
      .andWhere("tx.transactionDate <= :asOnDate", { asOnDate })
      .andWhere(
        `(tx.final_amount - COALESCE(tx.by_cash, 0) - COALESCE(tx.by_cheque, 0) - COALESCE(tx.by_card, 0) - COALESCE(tx.by_transfer, 0) - COALESCE(tx.by_other, 0)) > 0`,
      );

    if (query.search) {
      qb.andWhere("tx.number ILIKE :search", {
        search: `%${query.search.trim()}%`,
      });
    }

    qb.orderBy("tx.transactionDate", "ASC").addOrderBy("tx.number", "ASC");
    applyPagination(qb, pagination);

    const [transactions, total] = await qb.getManyAndCount();
    const data: OutstandingSaleForAdjustmentDto[] = transactions.map(
      (transaction) => ({
        id: transaction.id,
        number: transaction.number,
        transactionDate: String(
          toDateOnly(transaction.transactionDate) ??
            transaction.transactionDate,
        ),
        transactionType: transaction.transactionType,
        slug: transaction.slug,
        partyProfileId: transaction.partyProfileId,
        partyProfileSnapshot: transaction.partyProfileSnapshot as Record<
          string,
          any
        > | null,
        finalAmount: transaction.finalAmount,
        byCash: transaction.byCash,
        byCheque: transaction.byCheque,
        byCard: transaction.byCard,
        byTransfer: transaction.byTransfer,
        byOther: transaction.byOther,
        outstanding: money(this.billOutstandingCents(transaction)),
        branchId: transaction.branchId,
      }),
    );

    return buildPaginatedResponse(data, total, pagination);
  }
}
