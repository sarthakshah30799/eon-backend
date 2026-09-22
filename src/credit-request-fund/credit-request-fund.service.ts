import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { createHash } from "crypto";
import { Brackets, DataSource, Repository } from "typeorm";
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
} from "../common/pagination";
import {
  TransactionPaymentMethod,
  isNonChequeBankPaymentMethod,
  isTransactionPaymentMethod,
} from "../transactions/transactions.enums";
import {
  VoucherAccountMode,
  VoucherEntryDirection,
  isVoucherAccountItemType,
} from "../vouchers/voucher.enums";
import { VoucherService, VoucherSession } from "../vouchers/voucher.service";
import { VoucherType } from "../vouchers/voucher.enums";
import {
  CREDIT_REQUEST_FUND_NUMBER_SERIES,
  CreditRequestFundStatus,
} from "./credit-request-fund.enums";
import {
  ApproveCreditRequestFundDto,
  CreateCreditRequestFundDto,
  CreateCreditRequestFundItemDto,
  CreditRequestFundListQueryDto,
  RejectCreditRequestFundDto,
  UpdateCreditRequestFundDto,
} from "./dto/credit-request-fund.dto";
import { CreditRequestFund } from "./entities/credit-request-fund.entity";
import { CreditRequestFundItem } from "./entities/credit-request-fund-item.entity";

const normalize = (value: unknown) => String(value ?? "").trim();
const normalizeUpper = (value: unknown) =>
  normalize(value)
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
const normalizePan = (value: unknown) => normalize(value).toUpperCase();
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
const isIndividualParty = (party: PartyProfile, entityType: SelectOption) =>
  Boolean(party.isIndividual) ||
  isIndividualToken(entityType.value) ||
  isIndividualToken(entityType.label) ||
  isIndividualToken(party.entityType?.value) ||
  isIndividualToken(party.entityType?.label);
const isSelfRelation = (option: SelectOption | null) =>
  Boolean(
    option &&
      (normalizeUpper(option.value) === "SELF" ||
        normalizeUpper(option.label) === "SELF"),
  );

@Injectable()
export class CreditRequestFundService {
  constructor(
    @InjectDataSource("database2") private readonly database2: DataSource,
    @InjectRepository(CreditRequestFund, "database2")
    private readonly headerRepository: Repository<CreditRequestFund>,
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
    return value as import("../transactions/types/transaction-snapshot.types").TransactionReferenceSnapshotValue;
  }

  private async option(id: string, code: string) {
    const option = await this.optionRepository.findOne({
      where: { id, isActive: true },
    });
    if (!option || normalizeUpper(option.code) !== normalizeUpper(code))
      throw new BadRequestException(`Invalid ${code} option`);
    return option;
  }

  private async party(id: string) {
    const party = await this.partyRepository.findOne({
      where: { id, active: true, status: WorkflowStatus.APPROVE },
      relations: ["group", "entityType"],
    });
    if (!party)
      throw new NotFoundException(
        `Active approved Party Profile ${id} not found`,
      );
    return party;
  }

  private async account(id: string, role: "header" | "item" = "item") {
    const account = await this.accountRepository.findOne({
      where: { id, active: true },
      relations: ["accountType", "subLedger"],
    });
    if (!account)
      throw new NotFoundException(`Active Account Profile ${id} not found`);
    const rows = (await this.accountRepository.query(
      `SELECT c.currency_code AS "currencyCode"
       FROM account_profiles ap
       INNER JOIN currencies c ON c.id = ap.currency_id
       WHERE ap.id = $1 AND ap.deleted_at IS NULL AND c.deleted_at IS NULL`,
      [account.id],
    )) as Array<{ currencyCode?: string }>;
    if (normalizeUpper(rows[0]?.currencyCode) !== "INR")
      throw new BadRequestException(
        `Account ${account.accountCode} must use INR currency`,
      );
    if (role === "item" && !account.receipt && !account.payment) {
      // Free-entry request items: allow any active INR account (mirrors journal flexibility)
    }
    return account;
  }

  private async resolveWorkplace(
    dto: { branchId?: string; counterId?: string },
    session: VoucherSession,
  ) {
    const privileged = this.isPrivileged(session);
    const branchId = privileged
      ? normalize(dto.branchId) || normalize(session.activeBranchId)
      : normalize(session.activeBranchId);
    const counterId = privileged
      ? normalize(dto.counterId) || normalize(session.activeCounterId)
      : normalize(session.activeCounterId);
    if (!branchId || !counterId)
      throw new BadRequestException("Branch and Counter are required");
    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
    });
    if (!branch) throw new NotFoundException("Branch not found");
    const counter = await this.counterRepository.findOne({
      where: { id: counterId },
    });
    if (!counter) throw new NotFoundException("Counter not found");
    await assertCounterBelongsToBranch(
      this.branchCounterRepository,
      branch.id,
      counter.id,
    );
    return { branch, counter };
  }

  private async assertPartyVisible(
    party: PartyProfile,
    actorId: string,
    branchId: string,
    session: VoucherSession,
  ) {
    const privileged = this.isPrivileged(session);
    const result = await this.partyProfileService.findAll(
      {
        offset: 0,
        limit: 10,
        search: party.code,
        type: [party.type],
        ...(privileged ? {} : { branchIds: [branchId] }),
        activeOnly: true,
        status: WorkflowStatus.APPROVE,
      },
      actorId,
      privileged ? undefined : branchId,
    );
    if (!result.data.some((item) => item.id === party.id))
      throw new ForbiddenException(
        "Party Profile is not visible in the selected workplace or profile permissions",
      );
  }

  private resolveSubledgerKind(account: AccountProfile): "NONE" | "PARTY" | "BRANCH" {
    const accountType = normalizeUpper(
      account.accountType?.value ?? account.accountType?.label,
    );
    const subNature = normalizeUpper(
      account.subLedger?.value ?? account.subLedger?.label,
    );
    if (
      accountType.includes("GENERAL") ||
      (!account.subLedger && accountType.includes("GENERAL_LEDGER"))
    ) {
      if (!account.subLedger) return "NONE";
    }
    if (!account.subLedger) return "PARTY";
    if (subNature === "B" || subNature.includes("BRANCH")) return "BRANCH";
    return "PARTY";
  }

  private calculateTotals(items: CreateCreditRequestFundItemDto[]) {
    let debit = 0;
    let credit = 0;
    for (const row of items) {
      const amount = cents(row.amount);
      if (amount <= 0)
        throw new BadRequestException(
          "Item amount must be greater than zero",
        );
      if (row.direction === VoucherEntryDirection.DEBIT) debit += amount;
      else credit += amount;
    }
    if (credit - debit <= 0)
      throw new BadRequestException(
        "Credit Request Fund final amount must be greater than zero (credit − debit)",
      );
    return {
      totalDebit: money(debit),
      totalCredit: money(credit),
      finalAmount: money(credit - debit),
    };
  }

  private validateChequeFields(
    accountMode: VoucherAccountMode,
    paymentMethod: TransactionPaymentMethod | null,
    dto: CreateCreditRequestFundDto,
  ) {
    const isBankNonCheque = isNonChequeBankPaymentMethod(paymentMethod);
    const isCashMethod = paymentMethod === TransactionPaymentMethod.CASH;
    const hasCheque = [
      dto.chequeNumber,
      dto.chequeDate,
      dto.chequeBranch,
      dto.drawnOn,
    ].every((value) => normalize(value));
    if (accountMode === VoucherAccountMode.BANK_CHEQUE) {
      if (isBankNonCheque) {
        if (normalize(dto.chequeNumber))
          throw new BadRequestException(
            "Cheque number must be empty for this payment mode",
          );
        if (!normalize(dto.chequeDate))
          throw new BadRequestException("Cheque date is required");
      } else if (isCashMethod) {
        if (
          [
            dto.chequeNumber,
            dto.chequeDate,
            dto.chequeBranch,
            dto.drawnOn,
          ].some((value) => normalize(value))
        )
          throw new BadRequestException(
            "Cheque fields are not allowed for cash payment mode",
          );
      } else if (!hasCheque) {
        throw new BadRequestException(
          "Cheque Number, Cheque Date, Branch, and Drawn On are required",
        );
      }
    }
    if (
      accountMode !== VoucherAccountMode.BANK_CHEQUE &&
      [dto.chequeNumber, dto.chequeDate, dto.chequeBranch, dto.drawnOn].some(
        (value) => normalize(value),
      )
    )
      throw new BadRequestException(
        "Cheque fields are only allowed for Bank / Cheque vouchers",
      );
  }

  private async validatePayload(
    dto: CreateCreditRequestFundDto,
    session: VoucherSession,
  ) {
    const actorId = this.getActor(session);
    const workplace = await this.resolveWorkplace(dto, session);
    await this.dayPolicy.assertTransactionDateAllowed(
      workplace.branch.id,
      actorId,
      dto.transactionDate,
      workplace.counter.id,
    );

    if (dto.destinationBranchId === workplace.branch.id)
      throw new BadRequestException(
        "Destination branch must differ from requesting branch",
      );
    const destinationBranch = await this.branchRepository.findOne({
      where: { id: dto.destinationBranchId },
    });
    if (!destinationBranch)
      throw new NotFoundException("Destination branch not found");

    const [accountType, entityType, party, headerAccount, remark] =
      await Promise.all([
        this.option(dto.accountTypeOptionId, "VOUCHER_ACCOUNT_TYPE"),
        this.option(dto.entityTypeOptionId, "ENTITYTYPE"),
        this.party(dto.partyProfileId),
        this.account(dto.headerAccountId, "header"),
        dto.remarkOptionId
          ? this.option(dto.remarkOptionId, "VOUCHER_REMARK")
          : Promise.resolve(null),
      ]);

    const accountMode = normalizeUpper(accountType.value) as VoucherAccountMode;
    if (!Object.values(VoucherAccountMode).includes(accountMode))
      throw new BadRequestException("Unsupported A/C Type");
    if (party.entityType?.id !== entityType.id)
      throw new BadRequestException(
        "Party Profile does not match selected Entity Type",
      );
    await this.assertPartyVisible(party, actorId, workplace.branch.id, session);

    const headerLedgerTypes = [
      headerAccount.accountType?.value,
      headerAccount.accountType?.label,
    ].map(normalizeUpper);
    if (
      accountMode === VoucherAccountMode.CASH &&
      !headerLedgerTypes.includes("CASH_LEDGER")
    )
      throw new BadRequestException(
        "Cash requests require a CASH LEDGER account",
      );
    if (
      accountMode === VoucherAccountMode.BANK_CHEQUE &&
      !headerLedgerTypes.includes("BANK_LEDGER")
    )
      throw new BadRequestException(
        "Bank / Cheque requests require a BANK LEDGER account",
      );

    let resolvedPaymentMethod: TransactionPaymentMethod | null = null;
    if (
      accountMode === VoucherAccountMode.CASH ||
      accountMode === VoucherAccountMode.PETTY_CASH
    ) {
      if (
        dto.paymentMethod &&
        normalizeUpper(dto.paymentMethod) !== TransactionPaymentMethod.CASH
      )
        throw new BadRequestException(
          "Cash / Petty Cash require payment mode CASH",
        );
      resolvedPaymentMethod = TransactionPaymentMethod.CASH;
    } else if (accountMode === VoucherAccountMode.CREDIT_CARD) {
      if (
        dto.paymentMethod &&
        normalizeUpper(dto.paymentMethod) !== TransactionPaymentMethod.CARD
      )
        throw new BadRequestException(
          "Credit Card requires payment mode CARD",
        );
      resolvedPaymentMethod = TransactionPaymentMethod.CARD;
    } else if (accountMode === VoucherAccountMode.BANK_CHEQUE) {
      if (dto.paymentMethod) {
        if (!isTransactionPaymentMethod(dto.paymentMethod))
          throw new BadRequestException("Invalid payment mode");
        resolvedPaymentMethod = normalizeUpper(
          dto.paymentMethod,
        ) as TransactionPaymentMethod;
      } else {
        resolvedPaymentMethod = TransactionPaymentMethod.CHEQUE;
      }
    }
    this.validateChequeFields(accountMode, resolvedPaymentMethod, dto);

    const individual = isIndividualParty(party, entityType);
    let relation: SelectOption | null = null;
    if (individual) {
      if (!normalize(dto.paidByPanNumber))
        throw new BadRequestException("Paid by PAN is required for individual");
      if (!normalize(dto.paidByPanName))
        throw new BadRequestException(
          "Paid by PAN holder name is required for individual",
        );
      if (!toDateOnly(dto.paidByPanDob))
        throw new BadRequestException("Paid by DOB is required for individual");
      if (!dto.panHolderRelationOptionId)
        throw new BadRequestException(
          "PAN holder relation is required for individual",
        );
      relation = await this.option(
        dto.panHolderRelationOptionId,
        "RELATION",
      );
      if (!isSelfRelation(relation)) {
        if (!normalize(dto.travelerPanNumber))
          throw new BadRequestException("Traveler PAN is required");
        if (!normalize(dto.travelerPanName))
          throw new BadRequestException("Traveler name is required");
        if (!toDateOnly(dto.travelerPanDob))
          throw new BadRequestException("Traveler DOB is required");
      }
    }

    const resolvedItems: Array<{
      dto: CreateCreditRequestFundItemDto;
      type: SelectOption;
      account: AccountProfile;
      subledgerParty: PartyProfile | null;
      subledgerBranch: Branch | null;
    }> = [];

    for (const item of dto.items) {
      const itemType = await this.option(item.itemTypeOptionId, "VOUCHER_ITEM_TYPE");
      if (!isVoucherAccountItemType(itemType.value))
        throw new BadRequestException(
          "Credit Request Fund items must use Account item type",
        );
      const account = await this.account(item.accountId, "item");
      const kind = this.resolveSubledgerKind(account);
      let subledgerParty: PartyProfile | null = null;
      let subledgerBranch: Branch | null = null;

      if (kind === "NONE") {
        if (item.subledgerPartyProfileId || item.subledgerBranchId)
          throw new BadRequestException(
            `Account ${account.accountCode} does not allow a subledger`,
          );
      } else if (kind === "BRANCH") {
        if (!item.subledgerBranchId)
          throw new BadRequestException(
            `Branch subledger is required for account ${account.accountCode}`,
          );
        if (item.subledgerPartyProfileId)
          throw new BadRequestException(
            `Party subledger is not allowed for account ${account.accountCode}`,
          );
        subledgerBranch = await this.branchRepository.findOne({
          where: { id: item.subledgerBranchId },
        });
        if (!subledgerBranch)
          throw new NotFoundException("Sub ledger branch not found");
      } else {
        if (!item.subledgerPartyProfileId)
          throw new BadRequestException(
            `Party subledger is required for account ${account.accountCode}`,
          );
        if (item.subledgerBranchId)
          throw new BadRequestException(
            `Branch subledger is not allowed for account ${account.accountCode}`,
          );
        subledgerParty = await this.party(item.subledgerPartyProfileId);
        if (party.group?.id) {
          if (
            subledgerParty.group?.id !== party.group.id ||
            subledgerParty.entityType?.id !== party.entityType?.id
          )
            throw new BadRequestException(
              "Sub Ledger must match the header Party Group and Entity Type",
            );
        } else if (subledgerParty.id !== party.id) {
          throw new BadRequestException(
            "Without a Party Group, the header Party must be used as Sub Ledger",
          );
        }
        await this.assertPartyVisible(
          subledgerParty,
          actorId,
          workplace.branch.id,
          session,
        );
      }

      resolvedItems.push({
        dto: item,
        type: itemType,
        account,
        subledgerParty,
        subledgerBranch,
      });
    }

    const totals = this.calculateTotals(dto.items);
    const paidByPanNumber = individual
      ? normalizePan(dto.paidByPanNumber)
      : party.panNo ?? null;
    const paidByPanName = individual
      ? normalize(dto.paidByPanName) || null
      : party.panName ?? null;
    const paidByPanDob = individual
      ? toDateOnly(dto.paidByPanDob)
      : toDateOnly(party.panDob);
    const self = isSelfRelation(relation);

    return {
      actorId,
      workplace,
      destinationBranch,
      accountType,
      accountMode,
      entityType,
      party,
      headerAccount,
      remark,
      relation,
      resolvedPaymentMethod,
      resolvedItems,
      totals,
      paidByPanNumber,
      paidByPanName,
      paidByPanDob,
      travelerPanNumber: individual
        ? self
          ? paidByPanNumber
          : normalizePan(dto.travelerPanNumber)
        : null,
      travelerPanName: individual
        ? self
          ? paidByPanName
          : normalize(dto.travelerPanName) || null
        : null,
      travelerPanDob: individual
        ? self
          ? paidByPanDob
          : toDateOnly(dto.travelerPanDob)
        : null,
    };
  }

  private payloadHash(dto: CreateCreditRequestFundDto) {
    return createHash("sha256").update(JSON.stringify(dto)).digest("hex");
  }

  async nextNumber(branchId: string, session: VoucherSession) {
    this.getActor(session);
    const effectiveBranchId = this.isPrivileged(session)
      ? branchId
      : normalize(session.activeBranchId);
    const branch = await this.branchRepository.findOne({
      where: { id: effectiveBranchId },
    });
    if (!branch) throw new NotFoundException("Branch not found");
    return this.additionalSettings.getTransactionNumberPreview(
      CREDIT_REQUEST_FUND_NUMBER_SERIES,
      branch.code,
      new Date(),
    );
  }

  async create(dto: CreateCreditRequestFundDto, session: VoucherSession) {
    const hash = this.payloadHash(dto);
    const existing = await this.headerRepository.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
      relations: ["items"],
    });
    if (existing) {
      if (existing.payloadHash !== hash)
        throw new ConflictException(
          "Idempotency key already used with a different payload",
        );
      return existing;
    }

    const resolved = await this.validatePayload(dto, session);
    const number = await this.additionalSettings.reserveTransactionNumber(
      CREDIT_REQUEST_FUND_NUMBER_SERIES,
      resolved.workplace.branch.code,
      new Date(dto.transactionDate),
    );

    return this.database2.transaction(async (manager) => {
      const headerRepo = manager.getRepository(CreditRequestFund);
      const itemRepo = manager.getRepository(CreditRequestFundItem);
      const header = await headerRepo.save(
        headerRepo.create({
          number,
          numberSeriesCode: CREDIT_REQUEST_FUND_NUMBER_SERIES,
          idempotencyKey: dto.idempotencyKey,
          payloadHash: hash,
          status: CreditRequestFundStatus.PENDING,
          transactionDate: dto.transactionDate.slice(0, 10),
          branchId: resolved.workplace.branch.id,
          branchSnapshot: await this.snapshot(
            this.branchRepository,
            resolved.workplace.branch.id,
          ),
          counterId: resolved.workplace.counter.id,
          counterSnapshot: await this.snapshot(
            this.counterRepository,
            resolved.workplace.counter.id,
          ),
          destinationBranchId: resolved.destinationBranch.id,
          destinationBranchSnapshot: await this.snapshot(
            this.branchRepository,
            resolved.destinationBranch.id,
          ),
          accountTypeOptionId: resolved.accountType.id,
          accountTypeSnapshot: await this.snapshot(
            this.optionRepository,
            resolved.accountType.id,
          ),
          accountMode: resolved.accountMode,
          headerAccountId: resolved.headerAccount.id,
          headerAccountSnapshot: await this.snapshot(
            this.accountRepository,
            resolved.headerAccount.id,
          ),
          entityTypeOptionId: resolved.entityType.id,
          entityTypeSnapshot: await this.snapshot(
            this.optionRepository,
            resolved.entityType.id,
          ),
          partyProfileId: resolved.party.id,
          partyProfileSnapshot: await this.snapshot(
            this.partyRepository,
            resolved.party.id,
          ),
          paymentMethod: resolved.resolvedPaymentMethod,
          chequeNumber:
            resolved.accountMode === VoucherAccountMode.BANK_CHEQUE &&
            !isNonChequeBankPaymentMethod(resolved.resolvedPaymentMethod) &&
            resolved.resolvedPaymentMethod !== TransactionPaymentMethod.CASH
              ? normalize(dto.chequeNumber) || null
              : null,
          normalizedChequeNumber:
            resolved.accountMode === VoucherAccountMode.BANK_CHEQUE &&
            !isNonChequeBankPaymentMethod(resolved.resolvedPaymentMethod) &&
            resolved.resolvedPaymentMethod !== TransactionPaymentMethod.CASH
              ? normalizeUpper(dto.chequeNumber) || null
              : null,
          chequeDate:
            resolved.accountMode === VoucherAccountMode.BANK_CHEQUE &&
            resolved.resolvedPaymentMethod !== TransactionPaymentMethod.CASH
              ? toDateOnly(dto.chequeDate)
              : null,
          chequeBranch:
            resolved.accountMode === VoucherAccountMode.BANK_CHEQUE &&
            resolved.resolvedPaymentMethod !== TransactionPaymentMethod.CASH
              ? normalize(dto.chequeBranch) || null
              : null,
          drawnOn:
            resolved.accountMode === VoucherAccountMode.BANK_CHEQUE &&
            resolved.resolvedPaymentMethod !== TransactionPaymentMethod.CASH
              ? normalize(dto.drawnOn) || null
              : null,
          remarkOptionId: resolved.remark?.id ?? null,
          remarkSnapshot: resolved.remark
            ? await this.snapshot(this.optionRepository, resolved.remark.id)
            : null,
          narration: normalize(dto.narration),
          paidByPanNumber: resolved.paidByPanNumber,
          paidByPanName: resolved.paidByPanName,
          paidByPanDob: resolved.paidByPanDob,
          panHolderRelationOptionId: resolved.relation?.id ?? null,
          panHolderRelationSnapshot: resolved.relation
            ? await this.snapshot(this.optionRepository, resolved.relation.id)
            : null,
          travelerPanNumber: resolved.travelerPanNumber,
          travelerPanName: resolved.travelerPanName,
          travelerPanDob: resolved.travelerPanDob,
          ...resolved.totals,
          createdBy: resolved.actorId,
          updatedBy: resolved.actorId,
        }),
      );

      for (let index = 0; index < resolved.resolvedItems.length; index++) {
        const row = resolved.resolvedItems[index];
        await itemRepo.save(
          itemRepo.create({
            creditRequestFundId: header.id,
            lineNo: index + 1,
            itemTypeOptionId: row.type.id,
            itemTypeSnapshot: await this.snapshot(
              this.optionRepository,
              row.type.id,
            ),
            subledgerPartyProfileId: row.subledgerParty?.id ?? null,
            subledgerPartyProfileSnapshot: row.subledgerParty
              ? await this.snapshot(this.partyRepository, row.subledgerParty.id)
              : null,
            subledgerBranchId: row.subledgerBranch?.id ?? null,
            subledgerBranchSnapshot: row.subledgerBranch
              ? await this.snapshot(this.branchRepository, row.subledgerBranch.id)
              : null,
            accountId: row.account.id,
            accountSnapshot: await this.snapshot(
              this.accountRepository,
              row.account.id,
            ),
            direction: row.dto.direction,
            amount: money(cents(row.dto.amount)),
            createdBy: resolved.actorId,
            updatedBy: resolved.actorId,
          }),
        );
      }

      return headerRepo.findOneOrFail({
        where: { id: header.id },
        relations: ["items"],
      });
    });
  }

  async update(
    id: string,
    dto: UpdateCreditRequestFundDto,
    session: VoucherSession,
  ) {
    const actorId = this.getActor(session);
    const existing = await this.findEntity(id, session);
    if (existing.status !== CreditRequestFundStatus.PENDING)
      throw new BadRequestException("Only pending requests can be edited");
    if (
      !this.isPrivileged(session) &&
      existing.branchId !== session.activeBranchId
    )
      throw new ForbiddenException(
        "Only the requesting branch can edit this request",
      );

    const resolved = await this.validatePayload(dto, session);
    if (resolved.workplace.branch.id !== existing.branchId)
      throw new BadRequestException(
        "Requesting branch cannot be changed after create",
      );

    return this.database2.transaction(async (manager) => {
      const headerRepo = manager.getRepository(CreditRequestFund);
      const itemRepo = manager.getRepository(CreditRequestFundItem);
      await itemRepo.delete({ creditRequestFundId: existing.id });

      existing.payloadHash = this.payloadHash(dto);
      existing.transactionDate = dto.transactionDate.slice(0, 10);
      existing.counterId = resolved.workplace.counter.id;
      existing.counterSnapshot = await this.snapshot(
        this.counterRepository,
        resolved.workplace.counter.id,
      );
      existing.destinationBranchId = resolved.destinationBranch.id;
      existing.destinationBranchSnapshot = await this.snapshot(
        this.branchRepository,
        resolved.destinationBranch.id,
      );
      existing.accountTypeOptionId = resolved.accountType.id;
      existing.accountTypeSnapshot = await this.snapshot(
        this.optionRepository,
        resolved.accountType.id,
      );
      existing.accountMode = resolved.accountMode;
      existing.headerAccountId = resolved.headerAccount.id;
      existing.headerAccountSnapshot = await this.snapshot(
        this.accountRepository,
        resolved.headerAccount.id,
      );
      existing.entityTypeOptionId = resolved.entityType.id;
      existing.entityTypeSnapshot = await this.snapshot(
        this.optionRepository,
        resolved.entityType.id,
      );
      existing.partyProfileId = resolved.party.id;
      existing.partyProfileSnapshot = await this.snapshot(
        this.partyRepository,
        resolved.party.id,
      );
      existing.paymentMethod = resolved.resolvedPaymentMethod;
      existing.chequeNumber = normalize(dto.chequeNumber) || null;
      existing.normalizedChequeNumber = normalizeUpper(dto.chequeNumber) || null;
      existing.chequeDate = toDateOnly(dto.chequeDate);
      existing.chequeBranch = normalize(dto.chequeBranch) || null;
      existing.drawnOn = normalize(dto.drawnOn) || null;
      existing.remarkOptionId = resolved.remark?.id ?? null;
      existing.remarkSnapshot = resolved.remark
        ? await this.snapshot(this.optionRepository, resolved.remark.id)
        : null;
      existing.narration = normalize(dto.narration);
      existing.paidByPanNumber = resolved.paidByPanNumber;
      existing.paidByPanName = resolved.paidByPanName;
      existing.paidByPanDob = resolved.paidByPanDob;
      existing.panHolderRelationOptionId = resolved.relation?.id ?? null;
      existing.panHolderRelationSnapshot = resolved.relation
        ? await this.snapshot(this.optionRepository, resolved.relation.id)
        : null;
      existing.travelerPanNumber = resolved.travelerPanNumber;
      existing.travelerPanName = resolved.travelerPanName;
      existing.travelerPanDob = resolved.travelerPanDob;
      existing.totalDebit = resolved.totals.totalDebit;
      existing.totalCredit = resolved.totals.totalCredit;
      existing.finalAmount = resolved.totals.finalAmount;
      existing.updatedBy = actorId;
      await headerRepo.save(existing);

      for (let index = 0; index < resolved.resolvedItems.length; index++) {
        const row = resolved.resolvedItems[index];
        await itemRepo.save(
          itemRepo.create({
            creditRequestFundId: existing.id,
            lineNo: index + 1,
            itemTypeOptionId: row.type.id,
            itemTypeSnapshot: await this.snapshot(
              this.optionRepository,
              row.type.id,
            ),
            subledgerPartyProfileId: row.subledgerParty?.id ?? null,
            subledgerPartyProfileSnapshot: row.subledgerParty
              ? await this.snapshot(this.partyRepository, row.subledgerParty.id)
              : null,
            subledgerBranchId: row.subledgerBranch?.id ?? null,
            subledgerBranchSnapshot: row.subledgerBranch
              ? await this.snapshot(this.branchRepository, row.subledgerBranch.id)
              : null,
            accountId: row.account.id,
            accountSnapshot: await this.snapshot(
              this.accountRepository,
              row.account.id,
            ),
            direction: row.dto.direction,
            amount: money(cents(row.dto.amount)),
            createdBy: actorId,
            updatedBy: actorId,
          }),
        );
      }

      return headerRepo.findOneOrFail({
        where: { id: existing.id },
        relations: ["items"],
      });
    });
  }

  private async findEntity(id: string, session: VoucherSession) {
    const header = await this.headerRepository.findOne({
      where: { id },
      relations: ["items"],
    });
    if (!header) throw new NotFoundException("Credit Request Fund not found");
    if (!this.isPrivileged(session)) {
      if (
        header.branchId !== session.activeBranchId &&
        header.destinationBranchId !== session.activeBranchId
      )
        throw new ForbiddenException("Credit Request Fund not visible");
    }
    return header;
  }

  async findById(id: string, session: VoucherSession) {
    this.getActor(session);
    return this.findEntity(id, session);
  }

  async list(query: CreditRequestFundListQueryDto, session: VoucherSession) {
    this.getActor(session);
    const pagination = normalizePagination(query);
    const qb = this.headerRepository
      .createQueryBuilder("header")
      .leftJoinAndSelect("header.items", "items")
      .orderBy("header.transactionDate", "DESC")
      .addOrderBy("header.createdAt", "DESC");

    if (!this.isPrivileged(session)) {
      if (!session.activeBranchId)
        return buildPaginatedResponse([], 0, pagination);
      qb.andWhere(
        "(header.branchId = :branchId OR header.destinationBranchId = :branchId)",
        { branchId: session.activeBranchId },
      );
    } else if (query.branchId) {
      qb.andWhere("header.branchId = :branchId", { branchId: query.branchId });
    }
    if (query.destinationBranchId)
      qb.andWhere("header.destinationBranchId = :destinationBranchId", {
        destinationBranchId: query.destinationBranchId,
      });
    if (query.partyProfileId)
      qb.andWhere("header.partyProfileId = :partyProfileId", {
        partyProfileId: query.partyProfileId,
      });
    if (query.status)
      qb.andWhere("header.status = :status", { status: query.status });
    if (query.dateFrom)
      qb.andWhere("header.transactionDate >= :dateFrom", {
        dateFrom: query.dateFrom.slice(0, 10),
      });
    if (query.dateTo)
      qb.andWhere("header.transactionDate <= :dateTo", {
        dateTo: query.dateTo.slice(0, 10),
      });
    if (query.search)
      qb.andWhere(
        new Brackets((b) =>
          b
            .where("header.number ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("header.narration ILIKE :search", {
              search: `%${query.search}%`,
            }),
        ),
      );

    applyPagination(qb, pagination);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResponse(data, total, pagination);
  }

  async cancel(id: string, session: VoucherSession) {
    const actorId = this.getActor(session);
    const header = await this.findEntity(id, session);
    if (header.status !== CreditRequestFundStatus.PENDING)
      throw new BadRequestException("Only pending requests can be cancelled");
    if (
      !this.isPrivileged(session) &&
      header.branchId !== session.activeBranchId
    )
      throw new ForbiddenException(
        "Only the requesting branch can cancel this request",
      );
    header.status = CreditRequestFundStatus.CANCELLED;
    header.cancelledBy = actorId;
    header.cancelledAt = new Date();
    header.updatedBy = actorId;
    return this.headerRepository.save(header);
  }

  async reject(
    id: string,
    dto: RejectCreditRequestFundDto,
    session: VoucherSession,
  ) {
    const actorId = this.getActor(session);
    if (!(await this.isHoApprover(session)))
      throw new ForbiddenException(
        "Only HO / Admin can reject Credit Request Fund",
      );
    const header = await this.findEntity(id, session);
    if (header.status !== CreditRequestFundStatus.PENDING)
      throw new BadRequestException("Only pending requests can be rejected");
    header.status = CreditRequestFundStatus.REJECT;
    header.rejectedBy = actorId;
    header.rejectedAt = new Date();
    header.rejectionRemarks = normalize(dto.remarks);
    header.updatedBy = actorId;
    return this.headerRepository.save(header);
  }

  async approve(
    id: string,
    dto: ApproveCreditRequestFundDto,
    session: VoucherSession,
  ) {
    const actorId = this.getActor(session);
    if (!(await this.isHoApprover(session)))
      throw new ForbiddenException(
        "Only HO / Admin can approve Credit Request Fund",
      );

    return this.database2.transaction(async (manager) => {
      const headerRepo = manager.getRepository(CreditRequestFund);
      const header = await headerRepo
        .createQueryBuilder("header")
        .setLock("pessimistic_write")
        .where("header.id = :id", { id })
        .getOne();
      if (!header)
        throw new NotFoundException("Credit Request Fund not found");
      if (header.status !== CreditRequestFundStatus.PENDING)
        throw new BadRequestException("Only pending requests can be approved");

      const [branchControl, advanceControl, destBranch, reqBranch] =
        await Promise.all([
          this.voucherService.getBranchControlAccount(),
          this.voucherService.getAdvanceControlAccount(),
          this.branchRepository.findOne({
            where: { id: header.destinationBranchId },
          }),
          this.branchRepository.findOne({ where: { id: header.branchId } }),
        ]);
      if (!destBranch || !reqBranch)
        throw new NotFoundException("Branch not found for approval");

      const destCounterId = await this.resolveBranchCounterId(
        destBranch.id,
        session,
      );
      const approvedDate =
        toDateOnly(dto.transactionDate) ||
        (await this.resolveApprovalDate(destBranch.id, destCounterId, actorId));

      const baseIdempotency = `crf-approve:${header.id}`;
      const common = {
        transactionDate: approvedDate,
        accountTypeOptionId: header.accountTypeOptionId,
        accountMode: header.accountMode,
        headerAccountId: header.headerAccountId,
        entityTypeOptionId: header.entityTypeOptionId,
        partyProfileId: header.partyProfileId,
        panNumber: header.paidByPanNumber,
        panName: header.paidByPanName,
        panDob: header.paidByPanDob,
        paymentMethod: header.paymentMethod,
        chequeNumber: header.chequeNumber,
        chequeDate: header.chequeDate,
        chequeBranch: header.chequeBranch,
        drawnOn: header.drawnOn,
        remarkOptionId: header.remarkOptionId,
        narration: header.narration,
      };

      const destReceipt = await this.voucherService.createSystemVoucher(
        {
          ...common,
          voucherType: VoucherType.RECEIPT,
          branchId: destBranch.id,
          counterId: destCounterId,
          idempotencyKey: `${baseIdempotency}:dest-receipt`,
          itemAccountId: branchControl.id,
          itemDirection: VoucherEntryDirection.CREDIT,
          itemAmount: header.finalAmount,
          subledgerBranchId: reqBranch.id,
        },
        session,
        manager,
      );

      const reqReceipt = await this.voucherService.createSystemVoucher(
        {
          ...common,
          voucherType: VoucherType.RECEIPT,
          branchId: reqBranch.id,
          counterId: header.counterId,
          idempotencyKey: `${baseIdempotency}:req-receipt`,
          itemAccountId: advanceControl.id,
          itemDirection: VoucherEntryDirection.CREDIT,
          itemAmount: header.finalAmount,
          subledgerPartyProfileId: header.partyProfileId,
        },
        session,
        manager,
      );

      const reqPayment = await this.voucherService.createSystemVoucher(
        {
          ...common,
          voucherType: VoucherType.PAYMENT,
          branchId: reqBranch.id,
          counterId: header.counterId,
          idempotencyKey: `${baseIdempotency}:req-payment`,
          itemAccountId: branchControl.id,
          itemDirection: VoucherEntryDirection.DEBIT,
          itemAmount: header.finalAmount,
          subledgerBranchId: destBranch.id,
        },
        session,
        manager,
      );

      header.status = CreditRequestFundStatus.APPROVE;
      header.approvedBy = actorId;
      header.approvedAt = new Date();
      header.approvedTransactionDate = approvedDate;
      header.destinationReceiptVoucherId = destReceipt.id;
      header.destinationReceiptVoucherSnapshot = {
        id: destReceipt.id,
        code: destReceipt.number,
        name: destReceipt.number,
      };
      header.requestingReceiptVoucherId = reqReceipt.id;
      header.requestingReceiptVoucherSnapshot = {
        id: reqReceipt.id,
        code: reqReceipt.number,
        name: reqReceipt.number,
      };
      header.requestingPaymentVoucherId = reqPayment.id;
      header.requestingPaymentVoucherSnapshot = {
        id: reqPayment.id,
        code: reqPayment.number,
        name: reqPayment.number,
      };
      header.updatedBy = actorId;
      await headerRepo.save(header);

      return headerRepo.findOneOrFail({
        where: { id: header.id },
        relations: ["items"],
      });
    });
  }

  private async resolveBranchCounterId(
    branchId: string,
    session: VoucherSession,
  ) {
    if (
      session.activeBranchId === branchId &&
      normalize(session.activeCounterId)
    )
      return session.activeCounterId as string;
    const link = await this.branchCounterRepository
      .createQueryBuilder("link")
      .innerJoin("link.counter", "counter")
      .where("link.branchId = :branchId", { branchId })
      .andWhere("counter.isActive = true")
      .orderBy("counter.counterNo", "ASC")
      .addOrderBy("counter.name", "ASC")
      .select("link.counterId", "counterId")
      .getRawOne<{ counterId?: string }>();
    if (!normalize(link?.counterId))
      throw new BadRequestException(
        "Destination branch has no counter for voucher creation",
      );
    return link!.counterId as string;
  }

  private async resolveApprovalDate(
    branchId: string,
    counterId: string,
    actorId: string,
  ) {
    const { allowedDate } = await this.dayPolicy.assertTransactionDateAllowed(
      branchId,
      actorId,
      undefined,
      counterId,
    );
    return allowedDate;
  }
}
