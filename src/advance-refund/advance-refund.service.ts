import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { Branch } from "../branches/branch.entity";
import { BranchCounter } from "../branches/entities/branch-counter.entity";
import { assertCounterBelongsToBranch } from "../branches/branch-counter.access";
import { SelectOption } from "../category-options/category-option.entity";
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
import { VoucherService, VoucherSession } from "../vouchers/voucher.service";
import {
  ADVANCE_REFUND_NUMBER_SERIES,
  AdvanceRefundPayoutSource,
  AdvanceRefundStatus,
  AdvanceRefundType,
} from "./advance-refund.enums";
import {
  AdvanceRefundQueryDto,
  AvailableAdvanceForRefundQueryDto,
} from "./dto/advance-refund-query.dto";
import {
  AdvanceRefundResponseDto,
} from "./dto/advance-refund-response.dto";
import { CreateAdvanceRefundDto } from "./dto/create-advance-refund.dto";
import { HonourAdvanceRefundDto } from "./dto/honour-advance-refund.dto";
import { AdvanceRefund } from "./entities/advance-refund.entity";
import { AdvanceRefundItem } from "./entities/advance-refund-item.entity";

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
export class AdvanceRefundService {
  constructor(
    @InjectDataSource() private readonly database1: DataSource,
    @InjectDataSource("database2") private readonly database2: DataSource,
    @InjectRepository(AdvanceRefund, "database2")
    private readonly advanceRefundRepository: Repository<AdvanceRefund>,
    @InjectRepository(AdvanceRefundItem, "database2")
    private readonly itemRepository: Repository<AdvanceRefundItem>,
    @InjectRepository(AccountProfile)
    private readonly accountRepository: Repository<AccountProfile>,
    @InjectRepository(PartyProfile)
    private readonly partyRepository: Repository<PartyProfile>,
    @InjectRepository(SelectOption)
    private readonly optionRepository: Repository<SelectOption>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    @InjectRepository(BranchCounter)
    private readonly branchCounterRepository: Repository<BranchCounter>,
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

  async create(
    dto: CreateAdvanceRefundDto,
    session: VoucherSession,
  ): Promise<AdvanceRefundResponseDto> {
    const actorId = this.getActor(session);

    // 1. Validate Transaction Date
    await this.dayPolicy.assertTransactionDateAllowed(
      dto.branchId,
      actorId,
      dto.transactionDate,
      dto.counterId,
    );

    // 2. Validate Branch & Counter
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

    // 3. Validate Party Profile & Branch Visibility
    const party = await this.partyRepository.findOne({
      where: { id: dto.partyProfileId, isActive: true },
      relations: ["entityType"],
    });
    if (!party)
      throw new NotFoundException("Party profile not found or inactive");

    const partyResult = await this.partyProfileService.findAll(
      {
        offset: 0,
        limit: 10,
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

    // 4. Determine PAN details
    const individual = isIndividualParty(party);
    let panNumber: string | null = null;
    let panName: string | null = null;
    let panDob: string | null = null;

    if (individual) {
      panNumber = normalize(dto.panNumber) || null;
      panName = normalize(dto.panName) || null;
      panDob = dto.panDob ? toDateOnly(dto.panDob) : null;
    } else {
      panNumber = normalize(party.panNo) || null;
      panName = normalize(party.panName) || normalize(party.name) || null;
      panDob = party.panDob ? toDateOnly(party.panDob) : null;
    }

    // 5. Remark Option validation if provided
    let remarkOption: SelectOption | null = null;
    if (dto.remarkOptionId) {
      remarkOption = await this.optionRepository.findOne({
        where: { id: dto.remarkOptionId, isActive: true },
      });
      if (!remarkOption)
        throw new NotFoundException("Remark category option not found");
    }

    // 6. Validate Knock Off vs Refund specific requirements
    let knockOffAccount: AccountProfile | null = null;
    let payingBankAccount: AccountProfile | null = null;

    if (dto.refundType === AdvanceRefundType.KNOCK_OFF) {
      if (!dto.knockOffAccountId) {
        throw new BadRequestException(
          "Knock-off account is required for Knock Off refunds",
        );
      }
      knockOffAccount = await this.accountRepository.findOne({
        where: { id: dto.knockOffAccountId, active: true },
        relations: ["branchLinks"],
      });
      if (!knockOffAccount) {
        throw new NotFoundException("Knock-off account not found or inactive");
      }
      if (!knockOffAccount.visibleDuringRefund) {
        throw new BadRequestException(
          "Selected account is not configured as visible during refund",
        );
      }
      if (
        knockOffAccount.branchLinks &&
        knockOffAccount.branchLinks.length > 0
      ) {
        const assigned = knockOffAccount.branchLinks.some(
          (b) => b.branchId === branch.id,
        );
        if (!assigned) {
          throw new BadRequestException(
            "Selected knock-off account is not assigned to this branch",
          );
        }
      }
    } else if (dto.refundType === AdvanceRefundType.REFUND) {
      if (!dto.payoutSource) {
        throw new BadRequestException("Payout source is required for refunds");
      }
      if (
        dto.payoutSource === AdvanceRefundPayoutSource.HO_PAYOUT &&
        branch.isHeadOffice
      ) {
        throw new BadRequestException(
          "Head Office cannot select HO Payout; please select Local Bank",
        );
      }
      if (dto.payoutSource === AdvanceRefundPayoutSource.LOCAL_BANK) {
        if (!dto.payingBankAccountId) {
          throw new BadRequestException(
            "Paying bank account is required for local refund",
          );
        }
        payingBankAccount = await this.accountRepository.findOne({
          where: { id: dto.payingBankAccountId, active: true },
        });
        if (!payingBankAccount) {
          throw new NotFoundException(
            "Paying bank account not found or inactive",
          );
        }
      }
    } else {
      throw new BadRequestException("Invalid refund type");
    }

    // 7. Validate Items
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException(
        "At least one advance receipt must be selected for refund",
      );
    }

    const receiptIds = dto.items.map((i) => i.receiptVoucherId);
    if (new Set(receiptIds).size !== receiptIds.length) {
      throw new BadRequestException("Duplicate receipt vouchers selected");
    }

    // Fetch real-time available advances for validation
    const availableAdvances =
      await this.voucherService.getAvailableAdvancesForRefund({
        partyProfileId: party.id,
        branchId: branch.id,
        asOnDate: dto.asOnDate,
      });

    const availableMap = new Map(availableAdvances.map((a) => [a.id, a]));

    let totalCents = 0;
    const validatedItems: Array<{
      receiptVoucherId: string;
      receiptNumber: string;
      receiptSnapshot: Record<string, any>;
      originalReceiptAmount: string;
      consumedAmount: string;
      availableAmount: string;
      refundAmount: string;
    }> = [];

    for (const item of dto.items) {
      const adv = availableMap.get(item.receiptVoucherId);
      if (!adv) {
        throw new BadRequestException(
          `Receipt voucher ${item.receiptVoucherId} has no available advance balance as of ${dto.asOnDate}`,
        );
      }
      const refundCents = cents(item.refundAmount);
      if (refundCents <= 0) {
        throw new BadRequestException("Refund amount must be greater than zero");
      }
      const availCents = cents(adv.availableAmount);
      if (refundCents > availCents) {
        throw new BadRequestException(
          `Refund amount ${item.refundAmount} exceeds available balance ${adv.availableAmount} for receipt ${adv.number}`,
        );
      }

      totalCents += refundCents;
      validatedItems.push({
        receiptVoucherId: adv.id,
        receiptNumber: adv.number,
        receiptSnapshot: {
          id: adv.id,
          number: adv.number,
          transactionDate: adv.transactionDate,
          partyProfileSnapshot: adv.partyProfileSnapshot,
        },
        originalReceiptAmount: adv.originalAmount,
        consumedAmount: adv.consumedAmount,
        availableAmount: adv.availableAmount,
        refundAmount: money(refundCents),
      });
    }

    const totalRefundAmount = money(totalCents);

    // Knock Off Limit Check
    if (
      dto.refundType === AdvanceRefundType.KNOCK_OFF &&
      knockOffAccount?.refundLimit
    ) {
      const limitCents = cents(knockOffAccount.refundLimit);
      if (totalCents > limitCents) {
        throw new BadRequestException(
          `Total refund amount ${totalRefundAmount} exceeds knock-off account refund limit of ${knockOffAccount.refundLimit}`,
        );
      }
    }

    // 8. Snapshots
    const [
      branchSnapshot,
      counterSnapshot,
      partyProfileSnapshot,
      remarkSnapshot,
      knockOffAccountSnapshot,
      payingBankAccountSnapshot,
    ] = await Promise.all([
      this.snapshot(this.branchRepository, branch.id),
      this.snapshot(this.counterRepository, counter.id),
      this.snapshot(this.partyRepository, party.id),
      remarkOption ? this.snapshot(this.optionRepository, remarkOption.id) : null,
      knockOffAccount
        ? this.snapshot(this.accountRepository, knockOffAccount.id)
        : null,
      payingBankAccount
        ? this.snapshot(this.accountRepository, payingBankAccount.id)
        : null,
    ]);

    // 9. Reserve Advance Refund Number
    const number = await this.additionalSettings.reserveTransactionNumber(
      ADVANCE_REFUND_NUMBER_SERIES,
      branch.code,
      new Date(dto.transactionDate),
    );

    // 10. Execute Transaction in DB2 & DB1
    const queryRunner2 = this.database2.createQueryRunner();
    await queryRunner2.connect();
    await queryRunner2.startTransaction();

    const queryRunner1 = this.database1.createQueryRunner();
    await queryRunner1.connect();
    await queryRunner1.startTransaction();

    try {
      const headerRepo2 = queryRunner2.manager.getRepository(AdvanceRefund);
      const itemRepo2 = queryRunner2.manager.getRepository(AdvanceRefundItem);

      const advanceRefund = headerRepo2.create({
        number,
        branchId: branch.id,
        branchSnapshot,
        counterId: counter.id,
        counterSnapshot,
        transactionDate: dto.transactionDate.slice(0, 10),
        asOnDate: dto.asOnDate.slice(0, 10),
        partyProfileId: party.id,
        partyProfileSnapshot,
        panNumber,
        panName,
        panDob,
        refundType: dto.refundType,
        status: AdvanceRefundStatus.DRAFT,
        totalRefundAmount,
        narration: normalize(dto.narration),
        remarkOptionId: remarkOption?.id || null,
        remarkSnapshot,
        knockOffAccountId: knockOffAccount?.id || null,
        knockOffAccountSnapshot,
        payoutSource: dto.payoutSource || null,
        payingBankAccountId: payingBankAccount?.id || null,
        payingBankAccountSnapshot,
        paymentMethod: normalize(dto.paymentMethod) || null,
        beneficiaryAccountNumber:
          normalize(dto.beneficiaryAccountNumber) || null,
        beneficiaryIfscCode: normalizeUpper(dto.beneficiaryIfscCode) || null,
        beneficiaryName: normalize(dto.beneficiaryName) || null,
        bankName: normalize(dto.bankName) || null,
        chequeNumber: normalize(dto.chequeNumber) || null,
        chequeDate: toDateOnly(dto.chequeDate),
        drawnOn: normalize(dto.drawnOn) || null,
        journalVoucherId: null,
        paymentVoucherId: null,
        adviceVoucherId: null,
        hoPaymentVoucherId: null,
      });

      const savedAdvanceRefund = await headerRepo2.save(advanceRefund);

      let lineNo = 1;
      const createdItems: AdvanceRefundItem[] = [];
      for (const vi of validatedItems) {
        const itemEntity = itemRepo2.create({
          advanceRefundId: savedAdvanceRefund.id,
          lineNo: lineNo++,
          receiptVoucherId: vi.receiptVoucherId,
          receiptVoucherSnapshot: vi.receiptSnapshot,
          originalReceiptAmount: vi.originalReceiptAmount,
          consumedAmount: vi.consumedAmount,
          availableAmount: vi.availableAmount,
          refundAmount: vi.refundAmount,
        });
        createdItems.push(await itemRepo2.save(itemEntity));
      }

      // Generate Accounting Vouchers in DB1
      if (dto.refundType === AdvanceRefundType.KNOCK_OFF) {
        const jv = await this.voucherService.createAdvanceRefundJournalVoucher(
          {
            branchId: branch.id,
            counterId: counter.id,
            transactionDate: dto.transactionDate,
            narration: dto.narration,
            party,
            pan: { panNumber, panName, panDob },
            knockOffAccount: knockOffAccount!,
            items: validatedItems.map((i) => ({
              receiptVoucherId: i.receiptVoucherId,
              amount: i.refundAmount,
              receiptNumber: i.receiptNumber,
            })),
            totalAmount: totalRefundAmount,
            actorId,
          },
          queryRunner1.manager,
        );

        savedAdvanceRefund.journalVoucherId = jv.id;
        savedAdvanceRefund.status = AdvanceRefundStatus.COMPLETED;
      } else if (
        dto.refundType === AdvanceRefundType.REFUND &&
        dto.payoutSource === AdvanceRefundPayoutSource.LOCAL_BANK
      ) {
        const pt = await this.voucherService.createAdvanceRefundPaymentVoucher(
          {
            branchId: branch.id,
            counterId: counter.id,
            transactionDate: dto.transactionDate,
            narration: dto.narration,
            party,
            pan: { panNumber, panName, panDob },
            payingBankAccount: payingBankAccount!,
            paymentDetails: {
              paymentMethod: dto.paymentMethod,
              beneficiaryAccountNumber: dto.beneficiaryAccountNumber,
              beneficiaryIfscCode: dto.beneficiaryIfscCode,
              beneficiaryName: dto.beneficiaryName,
              bankName: dto.bankName,
              chequeNumber: dto.chequeNumber,
              chequeDate: dto.chequeDate,
              drawnOn: dto.drawnOn,
            },
            items: validatedItems.map((i) => ({
              receiptVoucherId: i.receiptVoucherId,
              amount: i.refundAmount,
              receiptNumber: i.receiptNumber,
            })),
            totalAmount: totalRefundAmount,
            actorId,
          },
          queryRunner1.manager,
        );

        savedAdvanceRefund.paymentVoucherId = pt.id;
        savedAdvanceRefund.status = AdvanceRefundStatus.COMPLETED;
      } else if (
        dto.refundType === AdvanceRefundType.REFUND &&
        dto.payoutSource === AdvanceRefundPayoutSource.HO_PAYOUT
      ) {
        const hoBranch = await this.branchRepository.findOne({
          where: { isHeadOffice: true, isActive: true },
        });
        if (!hoBranch) {
          throw new NotFoundException("Active Head Office branch not found");
        }

        const ar = await this.voucherService.createAdvanceRefundAdviceVoucher(
          {
            sourceBranchId: branch.id,
            destinationBranchId: hoBranch.id,
            counterId: counter.id,
            transactionDate: dto.transactionDate,
            narration: dto.narration,
            party,
            pan: { panNumber, panName, panDob },
            items: validatedItems.map((i) => ({
              receiptVoucherId: i.receiptVoucherId,
              amount: i.refundAmount,
              receiptNumber: i.receiptNumber,
            })),
            totalAmount: totalRefundAmount,
            actorId,
          },
          queryRunner1.manager,
        );

        savedAdvanceRefund.adviceVoucherId = ar.id;
        savedAdvanceRefund.status = AdvanceRefundStatus.PENDING_HO_APPROVAL;
      }

      await headerRepo2.save(savedAdvanceRefund);

      await queryRunner1.commitTransaction();
      await queryRunner2.commitTransaction();

      savedAdvanceRefund.items = createdItems;
      return AdvanceRefundResponseDto.fromEntity(savedAdvanceRefund);
    } catch (err) {
      await queryRunner1.rollbackTransaction();
      await queryRunner2.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner1.release();
      await queryRunner2.release();
    }
  }

  async honour(
    id: string,
    dto: HonourAdvanceRefundDto,
    session: VoucherSession,
  ): Promise<AdvanceRefundResponseDto> {
    const actorId = this.getActor(session);
    const isHo = await this.isHoApprover(session);
    if (!isHo) {
      throw new ForbiddenException(
        "Only Head Office staff or administrators can honour advance refunds",
      );
    }

    const advanceRefund = await this.advanceRefundRepository.findOne({
      where: { id },
      relations: ["items"],
    });

    if (!advanceRefund) {
      throw new NotFoundException("Advance refund not found");
    }

    if (advanceRefund.status !== AdvanceRefundStatus.PENDING_HO_APPROVAL) {
      throw new BadRequestException(
        `Advance refund is not pending HO approval (current status: ${advanceRefund.status})`,
      );
    }

    if (!advanceRefund.adviceVoucherId) {
      throw new BadRequestException("Linked advice voucher ID missing");
    }

    // Resolve HO Branch
    const hoBranch = await this.branchRepository.findOne({
      where: { isHeadOffice: true, isActive: true },
    });
    if (!hoBranch) {
      throw new NotFoundException("Active Head Office branch not found");
    }

    // Resolve HO Counter
    let hoCounter: Counter | null = null;
    if (dto.counterId) {
      hoCounter = await this.counterRepository.findOne({
        where: { id: dto.counterId, isActive: true },
      });
    }
    if (!hoCounter) {
      // Find default counter for HO branch
      const branchCounters = await this.branchCounterRepository.find({
        where: { branchId: hoBranch.id },
        relations: ["counter"],
      });
      hoCounter = branchCounters[0]?.counter || null;
    }
    if (!hoCounter) {
      throw new NotFoundException("No active counter found for Head Office");
    }

    // Transaction Date
    const effectiveDate = dto.transactionDate || advanceRefund.transactionDate;
    await this.dayPolicy.assertTransactionDateAllowed(
      hoBranch.id,
      actorId,
      effectiveDate,
      hoCounter.id,
    );

    // HO Paying Bank Account
    const hoPayingBankAccount = await this.accountRepository.findOne({
      where: { id: dto.hoPayingBankAccountId, active: true },
    });
    if (!hoPayingBankAccount) {
      throw new NotFoundException(
        "HO Paying Bank Account not found or inactive",
      );
    }

    // Execute in DB1 & DB2
    const queryRunner2 = this.database2.createQueryRunner();
    await queryRunner2.connect();
    await queryRunner2.startTransaction();

    const queryRunner1 = this.database1.createQueryRunner();
    await queryRunner1.connect();
    await queryRunner1.startTransaction();

    try {
      const hoPt = await this.voucherService.honourAdvanceRefundAdvice(
        {
          adviceVoucherId: advanceRefund.adviceVoucherId,
          hoBranchId: hoBranch.id,
          hoCounterId: hoCounter.id,
          transactionDate: effectiveDate,
          hoPayingBankAccount,
          paymentDetails: {
            paymentMethod: advanceRefund.paymentMethod,
            beneficiaryAccountNumber: advanceRefund.beneficiaryAccountNumber,
            beneficiaryIfscCode: advanceRefund.beneficiaryIfscCode,
            beneficiaryName: advanceRefund.beneficiaryName,
            bankName: advanceRefund.bankName,
            chequeNumber: dto.chequeNumber || advanceRefund.chequeNumber,
            chequeDate: dto.chequeDate || advanceRefund.chequeDate,
            drawnOn: dto.drawnOn || advanceRefund.drawnOn,
          },
          narration: dto.narration || advanceRefund.narration,
          actorId,
        },
        queryRunner1.manager,
      );

      const headerRepo2 = queryRunner2.manager.getRepository(AdvanceRefund);
      advanceRefund.status = AdvanceRefundStatus.COMPLETED;
      advanceRefund.hoPaymentVoucherId = hoPt.id;
      if (dto.chequeNumber) advanceRefund.chequeNumber = dto.chequeNumber;
      if (dto.chequeDate) advanceRefund.chequeDate = toDateOnly(dto.chequeDate);
      if (dto.drawnOn) advanceRefund.drawnOn = dto.drawnOn;

      await headerRepo2.save(advanceRefund);

      await queryRunner1.commitTransaction();
      await queryRunner2.commitTransaction();

      return AdvanceRefundResponseDto.fromEntity(advanceRefund);
    } catch (err) {
      await queryRunner1.rollbackTransaction();
      await queryRunner2.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner1.release();
      await queryRunner2.release();
    }
  }

  async findAll(
    query: AdvanceRefundQueryDto,
    session: VoucherSession,
  ): Promise<PaginatedResponseDto<AdvanceRefundResponseDto>> {
    const isHo = await this.isHoApprover(session);
    const effectiveBranchId = isHo
      ? query.branchId
      : normalize(session.activeBranchId) || query.branchId;

    const qb = this.advanceRefundRepository
      .createQueryBuilder("ar")
      .leftJoinAndSelect("ar.items", "items")
      .orderBy("ar.createdAt", "DESC");

    if (effectiveBranchId) {
      qb.andWhere("ar.branchId = :branchId", { branchId: effectiveBranchId });
    }

    if (query.partyProfileId) {
      qb.andWhere("ar.partyProfileId = :partyProfileId", {
        partyProfileId: query.partyProfileId,
      });
    }

    if (query.refundType) {
      qb.andWhere("ar.refundType = :refundType", {
        refundType: query.refundType,
      });
    }

    if (query.status) {
      qb.andWhere("ar.status = :status", { status: query.status });
    }

    if (query.dateFrom) {
      qb.andWhere("ar.transactionDate >= :dateFrom", {
        dateFrom: query.dateFrom.slice(0, 10),
      });
    }

    if (query.dateTo) {
      qb.andWhere("ar.transactionDate <= :dateTo", {
        dateTo: query.dateTo.slice(0, 10),
      });
    }

    if (query.search) {
      const s = `%${query.search.toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(ar.number) LIKE :s OR LOWER(ar.partyProfileSnapshot->>'name') LIKE :s OR LOWER(ar.panNumber) LIKE :s)",
        { s },
      );
    }

    const { limit, offset } = normalizePagination(query);
    applyPagination(qb, { limit, offset });

    const [records, total] = await qb.getManyAndCount();

    return buildPaginatedResponse(
      records.map((r) => AdvanceRefundResponseDto.fromEntity(r)),
      total,
      { limit, offset },
    );
  }

  async findById(
    id: string,
    session: VoucherSession,
  ): Promise<AdvanceRefundResponseDto> {
    const advanceRefund = await this.advanceRefundRepository.findOne({
      where: { id },
      relations: ["items"],
    });

    if (!advanceRefund) {
      throw new NotFoundException("Advance refund not found");
    }

    const isHo = await this.isHoApprover(session);
    if (
      !isHo &&
      session.activeBranchId &&
      advanceRefund.branchId !== session.activeBranchId
    ) {
      throw new ForbiddenException(
        "You do not have access to advance refunds of other branches",
      );
    }

    return AdvanceRefundResponseDto.fromEntity(advanceRefund);
  }

  async getAvailableAdvances(
    query: AvailableAdvanceForRefundQueryDto,
    session: VoucherSession,
  ) {
    const isHo = await this.isHoApprover(session);
    const branchId = isHo
      ? query.branchId || normalize(session.activeBranchId)
      : normalize(session.activeBranchId) || query.branchId;

    if (!branchId) {
      throw new BadRequestException("Branch ID is required");
    }

    if (!query.partyProfileId) {
      throw new BadRequestException("Party profile ID is required");
    }

    return this.voucherService.getAvailableAdvancesForRefund({
      partyProfileId: query.partyProfileId,
      branchId,
      asOnDate: query.asOnDate || new Date().toISOString().slice(0, 10),
      search: query.search,
    });
  }
}
