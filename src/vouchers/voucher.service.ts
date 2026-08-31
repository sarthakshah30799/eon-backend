import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { createHash } from "crypto";
import { Brackets, DataSource, EntityManager, Repository } from "typeorm";
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
import { TransactionReferenceSnapshotValue } from "../transactions/types/transaction-snapshot.types";
import {
  TransactionStatus,
  TransactionType,
  TransactionPaymentMethod,
} from "../transactions/transactions.enums";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionPayment } from "../transactions/entities/transaction-payment.entity";
import {
  AdvanceApplicationPayloadDto,
  AvailableAdvanceQueryDto,
  CreateJournalVoucherDto,
  CreatePartyVoucherDto,
  CreateVoucherItemDto,
  VoucherListQueryDto,
} from "./dto/voucher.dto";
import {
  AccountingVoucher,
  AccountingVoucherItem,
  VoucherAdvanceApplication,
} from "./entities";
import {
  VoucherAccountMode,
  VoucherAdvanceApplicationState,
  VoucherEntryDirection,
  VoucherType,
  VOUCHER_NUMBER_SERIES,
} from "./voucher.enums";
import {
  applyPagination,
  buildPaginatedResponse,
  normalizePagination,
} from "../common/pagination";

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
const REQUIRED_OPTIONS = [
  { code: "VOUCHER_ACCOUNT_TYPE", value: "CASH", label: "Cash", sortOrder: 1 },
  {
    code: "VOUCHER_ACCOUNT_TYPE",
    value: "BANK_CHEQUE",
    label: "Bank / Cheque",
    sortOrder: 2,
  },
  {
    code: "VOUCHER_ACCOUNT_TYPE",
    value: "PETTY_CASH",
    label: "Petty Cash",
    sortOrder: 3,
  },
  {
    code: "VOUCHER_ACCOUNT_TYPE",
    value: "CREDIT_CARD",
    label: "Credit Card",
    sortOrder: 4,
  },
  {
    code: "VOUCHER_ITEM_TYPE",
    value: "ACCOUNT",
    label: "Account",
    sortOrder: 1,
  },
] as const;

const normalize = (value: unknown) => String(value ?? "").trim();
const normalizeUpper = (value: unknown) =>
  normalize(value)
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
const isInrCurrencyCode = (value: unknown) => normalizeUpper(value) === "INR";
const isIndividualToken = (value: unknown) =>
  normalizeUpper(value) === "INDIVIDUAL";
const normalizePan = (value: unknown) => normalize(value).toUpperCase();
const toDateOnly = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = normalize(value);
  return raw ? raw.slice(0, 10) : null;
};
const isIndividualVoucherParty = (
  party: PartyProfile,
  entityType: SelectOption,
) =>
  Boolean(party.isIndividual) ||
  isIndividualToken(entityType.value) ||
  isIndividualToken(entityType.label) ||
  isIndividualToken(party.entityType?.value) ||
  isIndividualToken(party.entityType?.label);
const resolveVoucherPan = (
  party: PartyProfile,
  entityType: SelectOption,
  dto: CreatePartyVoucherDto,
) => {
  if (!isIndividualVoucherParty(party, entityType)) {
    return {
      panNumber: party.panNo ?? null,
      panName: party.panName ?? null,
      panDob: toDateOnly(party.panDob),
    };
  }

  return {
    panNumber: normalizePan(dto.panNumber) || party.panNo || null,
    panName: normalize(dto.panName) || party.panName || null,
    panDob: toDateOnly(dto.panDob) || toDateOnly(party.panDob),
  };
};
const money = (cents: number) => (cents / 100).toFixed(2);
const cents = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric))
    throw new BadRequestException("Amount is invalid");
  return Math.round(numeric * 100);
};

export interface VoucherSession {
  userId?: string | null;
  activeBranchId?: string | null;
  activeCounterId?: string | null;
  isAdmin?: boolean;
  isHo?: boolean;
  isHoStaff?: boolean;
}

@Injectable()
export class VoucherService implements OnModuleInit {
  constructor(
    @InjectDataSource("database2") private readonly database2: DataSource,
    @InjectRepository(AccountingVoucher, "database2")
    private readonly voucherRepository: Repository<AccountingVoucher>,
    @InjectRepository(VoucherAdvanceApplication, "database2")
    private readonly applicationRepository: Repository<VoucherAdvanceApplication>,
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
  ) {}

  async onModuleInit() {
    for (const definition of REQUIRED_OPTIONS) {
      const existing = await this.optionRepository.findOne({
        where: { code: definition.code, value: definition.value },
      });
      if (existing) continue;
      try {
        await this.optionRepository.save(
          this.optionRepository.create({
            ...definition,
            isActive: true,
            createdBy: SYSTEM_USER_ID,
            updatedBy: SYSTEM_USER_ID,
          }),
        );
      } catch (error: any) {
        if (error?.code !== "23505") throw error;
      }
    }
  }

  private getActor(session: VoucherSession) {
    const userId = normalize(session.userId);
    if (!userId) throw new BadRequestException("User session not found");
    return userId;
  }

  private async resolveWorkplace(
    dto: { branchId?: string; counterId?: string },
    session: VoucherSession,
  ) {
    const privileged = Boolean(
      session.isAdmin || session.isHo || session.isHoStaff,
    );
    const branchId = normalize(
      privileged
        ? dto.branchId || session.activeBranchId
        : session.activeBranchId,
    );
    const counterId = normalize(
      privileged
        ? dto.counterId || session.activeCounterId
        : session.activeCounterId,
    );
    if (!branchId || !counterId)
      throw new BadRequestException("Branch and counter are required");
    const [branch, counter] = await Promise.all([
      this.branchRepository.findOne({
        where: { id: branchId, isActive: true },
      }),
      this.counterRepository.findOne({
        where: { id: counterId, isActive: true },
      }),
    ]);
    if (!branch) throw new NotFoundException("Active branch not found");
    if (!counter) throw new NotFoundException("Active counter not found");
    await assertCounterBelongsToBranch(
      this.branchCounterRepository,
      branch.id,
      counter.id,
    );
    return { branch, counter };
  }

  private async option(id: string, code: string) {
    const option = await this.optionRepository.findOne({
      where: { id, isActive: true },
    });
    if (!option || normalizeUpper(option.code) !== normalizeUpper(code))
      throw new BadRequestException(`Invalid ${code} option`);
    return option;
  }

  private async accountCurrencyCode(accountId: string) {
    const rows = (await this.accountRepository.query(
      `SELECT c.currency_code AS "currencyCode"
       FROM account_profiles ap
       INNER JOIN currencies c ON c.id = ap.currency_id
       WHERE ap.id = $1
         AND ap.deleted_at IS NULL
         AND c.deleted_at IS NULL`,
      [accountId],
    )) as Array<{ currencyCode?: string }>;
    return rows[0]?.currencyCode ?? null;
  }

  private async account(
    id: string,
    usage?: VoucherType,
    role: "header" | "item" | "advance" = "item",
  ) {
    const account = await this.accountRepository.findOne({
      where: { id, active: true },
      relations: ["accountType"],
    });
    if (!account)
      throw new NotFoundException(`Active Account Profile ${id} not found`);
    const currencyCode = await this.accountCurrencyCode(account.id);
    if (!isInrCurrencyCode(currencyCode)) {
      if (role === "advance") {
        throw new BadRequestException(
          "ADVANCE_CONTROL_ACCOUNT additional setting must point to an INR Account Profile",
        );
      }
      throw new BadRequestException(
        `Voucher account ${account.accountCode} must use INR currency`,
      );
    }
    if (usage === VoucherType.RECEIPT && !account.receipt)
      throw new BadRequestException(
        "Item account is not enabled for Receipt vouchers",
      );
    if (usage === VoucherType.PAYMENT && !account.payment)
      throw new BadRequestException(
        "Item account is not enabled for Payment vouchers",
      );
    if (usage === VoucherType.JOURNAL && !account.journalVoucher)
      throw new BadRequestException(
        "Item account is not enabled for Journal vouchers",
      );
    return account;
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

  private async assertPartyVisible(
    party: PartyProfile,
    actorId: string,
    branchId: string,
  ) {
    const result = await this.partyProfileService.findAll(
      {
        offset: 0,
        limit: 10,
        search: party.code,
        type: [party.type],
        branchIds: [branchId],
        activeOnly: true,
        status: WorkflowStatus.APPROVE,
      },
      actorId,
      branchId,
    );
    if (!result.data.some((item) => item.id === party.id))
      throw new ForbiddenException(
        "Party Profile is not visible in the selected workplace or profile permissions",
      );
  }

  private async snapshot(repository: Repository<any>, id: string) {
    const value = await loadEntitySnapshot(repository, id);
    if (!value) throw new NotFoundException(`Reference ${id} not found`);
    return value as TransactionReferenceSnapshotValue;
  }

  private payloadHash(type: VoucherType, dto: unknown) {
    return createHash("sha256")
      .update(JSON.stringify({ type, dto }))
      .digest("hex");
  }

  private async findIdempotent(key: string, hash: string) {
    const existing = await this.voucherRepository.findOne({
      where: { idempotencyKey: key },
      relations: ["items"],
    });
    if (!existing) return null;
    if (existing.payloadHash !== hash)
      throw new ConflictException(
        "Idempotency key was already used with a different payload",
      );
    return existing;
  }

  private async resolveAdvanceAccount() {
    const id = normalize(
      await this.additionalSettings.getSettingTextValue(
        "TRANSACTION_ACCOUNTING",
        "ADVANCE_CONTROL_ACCOUNT",
      ),
    );
    if (!id)
      throw new BadRequestException(
        "Missing ADVANCE_CONTROL_ACCOUNT additional setting",
      );
    return this.account(id, undefined, "advance");
  }

  private calculate(type: VoucherType, items: CreateVoucherItemDto[]) {
    let debit = 0;
    let credit = 0;
    for (const row of items) {
      const amount = cents(row.amount);
      if (amount <= 0)
        throw new BadRequestException(
          "Voucher item amount must be greater than zero",
        );
      if (row.direction === VoucherEntryDirection.DEBIT) debit += amount;
      else credit += amount;
    }
    if (type === VoucherType.RECEIPT && credit - debit <= 0)
      throw new BadRequestException(
        "Receipt final amount must be greater than zero",
      );
    if (type === VoucherType.PAYMENT && debit - credit <= 0)
      throw new BadRequestException(
        "Payment final amount must be greater than zero",
      );
    if (
      type === VoucherType.JOURNAL &&
      (debit <= 0 || credit <= 0 || debit !== credit)
    )
      throw new BadRequestException(
        "Journal voucher debit and credit totals must be positive and equal",
      );
    return {
      totalDebit: money(debit),
      totalCredit: money(credit),
      finalAmount: money(
        type === VoucherType.RECEIPT
          ? credit - debit
          : type === VoucherType.PAYMENT
            ? debit - credit
            : 0,
      ),
    };
  }

  async create(
    type: VoucherType,
    dto: CreatePartyVoucherDto | CreateJournalVoucherDto,
    session: VoucherSession,
  ) {
    const actorId = this.getActor(session);
    const narration = normalize(dto.narration);
    if (!narration) throw new BadRequestException("Narration is required");
    const hash = this.payloadHash(type, dto);
    const repeated = await this.findIdempotent(dto.idempotencyKey, hash);
    if (repeated) return repeated;
    const workplace = await this.resolveWorkplace(dto, session);
    await this.dayPolicy.assertTransactionDateAllowed(
      workplace.branch.id,
      actorId,
      dto.transactionDate,
      workplace.counter.id,
    );
    const totals = this.calculate(type, dto.items);
    const [branchSnapshot, counterSnapshot, remark] = await Promise.all([
      this.snapshot(this.branchRepository, workplace.branch.id),
      this.snapshot(this.counterRepository, workplace.counter.id),
      dto.remarkOptionId
        ? this.option(dto.remarkOptionId, "VOUCHER_REMARK")
        : Promise.resolve(null),
    ]);

    let party: PartyProfile | null = null;
    let accountMode: VoucherAccountMode | null = null;
    let accountType: SelectOption | null = null;
    let headerAccount: AccountProfile | null = null;
    let entityType: SelectOption | null = null;
    let advanceAccount: AccountProfile | null = null;
    if (type !== VoucherType.JOURNAL) {
      const partyDto = dto as CreatePartyVoucherDto;
      [accountType, entityType, party, advanceAccount] = await Promise.all([
        this.option(partyDto.accountTypeOptionId, "VOUCHER_ACCOUNT_TYPE"),
        this.option(partyDto.entityTypeOptionId, "ENTITYTYPE"),
        this.party(partyDto.partyProfileId),
        this.resolveAdvanceAccount(),
      ]);
      accountMode = normalizeUpper(accountType.value) as VoucherAccountMode;
      if (!Object.values(VoucherAccountMode).includes(accountMode))
        throw new BadRequestException("Unsupported voucher A/C Type");
      if (party.entityType?.id !== entityType.id)
        throw new BadRequestException(
          "Party Profile does not match selected Entity Type",
        );
      await this.assertPartyVisible(party, actorId, workplace.branch.id);
      headerAccount = await this.account(
        partyDto.headerAccountId,
        undefined,
        "header",
      );
      const headerLedgerTypes = [
        headerAccount.accountType?.value,
        headerAccount.accountType?.label,
      ].map(normalizeUpper);
      if (
        accountMode === VoucherAccountMode.CASH &&
        !headerLedgerTypes.includes("CASH_LEDGER")
      )
        throw new BadRequestException(
          "Cash vouchers require a CASH LEDGER account",
        );
      if (
        accountMode === VoucherAccountMode.BANK_CHEQUE &&
        !headerLedgerTypes.includes("BANK_LEDGER")
      )
        throw new BadRequestException(
          "Bank / Cheque vouchers require a BANK LEDGER account",
        );
      const hasCheque = [
        partyDto.chequeNumber,
        partyDto.chequeDate,
        partyDto.chequeBranch,
        partyDto.drawnOn,
      ].every((value) => normalize(value));
      if (accountMode === VoucherAccountMode.BANK_CHEQUE && !hasCheque)
        throw new BadRequestException(
          "Cheque Number, Cheque Date, Branch, and Drawn On are required",
        );
      if (
        accountMode !== VoucherAccountMode.BANK_CHEQUE &&
        [
          partyDto.chequeNumber,
          partyDto.chequeDate,
          partyDto.chequeBranch,
          partyDto.drawnOn,
        ].some((value) => normalize(value))
      )
        throw new BadRequestException(
          "Cheque fields are only allowed for Bank / Cheque vouchers",
        );
    }

    const resolvedItems = [] as Array<{
      dto: CreateVoucherItemDto;
      type: SelectOption;
      account: AccountProfile;
      subledger: PartyProfile | null;
    }>;
    for (const item of dto.items) {
      const [itemType, itemAccount, subledger] = await Promise.all([
        this.option(item.itemTypeOptionId, "VOUCHER_ITEM_TYPE"),
        this.account(item.accountId, type, "item"),
        item.subledgerPartyProfileId
          ? this.party(item.subledgerPartyProfileId)
          : Promise.resolve(null),
      ]);
      if (type !== VoucherType.JOURNAL) {
        if (!subledger)
          throw new BadRequestException(
            "Sub Ledger is required for Receipt and Payment items",
          );
        if (party!.group?.id) {
          if (
            subledger.group?.id !== party!.group.id ||
            subledger.entityType?.id !== party!.entityType?.id
          )
            throw new BadRequestException(
              "Sub Ledger must match the header Party Group and Entity Type",
            );
        } else if (subledger.id !== party!.id)
          throw new BadRequestException(
            "Without a Party Group, the header Party must be used as Sub Ledger",
          );
      }
      if (subledger)
        await this.assertPartyVisible(subledger, actorId, workplace.branch.id);
      resolvedItems.push({
        dto: item,
        type: itemType,
        account: itemAccount,
        subledger,
      });
    }

    const number = await this.additionalSettings.reserveTransactionNumber(
      VOUCHER_NUMBER_SERIES[type],
      workplace.branch.code,
      new Date(),
    );
    return this.database2
      .transaction(async (manager) => {
        const voucherRepo = manager.getRepository(AccountingVoucher);
        const itemRepo = manager.getRepository(AccountingVoucherItem);
        const partyDto =
          type === VoucherType.JOURNAL ? null : (dto as CreatePartyVoucherDto);
        const voucher = await voucherRepo.save(
          voucherRepo.create({
            voucherType: type,
            number,
            idempotencyKey: dto.idempotencyKey,
            payloadHash: hash,
            transactionDate: dto.transactionDate.slice(0, 10),
            branchId: workplace.branch.id,
            branchSnapshot,
            counterId: workplace.counter.id,
            counterSnapshot,
            accountTypeOptionId: accountType?.id ?? null,
            accountTypeSnapshot: accountType
              ? await this.snapshot(this.optionRepository, accountType.id)
              : null,
            accountMode,
            headerAccountId: headerAccount?.id ?? null,
            headerAccountSnapshot: headerAccount
              ? await this.snapshot(this.accountRepository, headerAccount.id)
              : null,
            entityTypeOptionId: entityType?.id ?? null,
            entityTypeSnapshot: entityType
              ? await this.snapshot(this.optionRepository, entityType.id)
              : null,
            partyProfileId: party?.id ?? null,
            partyProfileSnapshot: party
              ? await this.snapshot(this.partyRepository, party.id)
              : null,
            ...(party && entityType && partyDto
              ? resolveVoucherPan(party, entityType, partyDto)
              : { panNumber: null, panName: null, panDob: null }),
            chequeNumber:
              accountMode === VoucherAccountMode.BANK_CHEQUE
                ? normalize(partyDto?.chequeNumber)
                : null,
            normalizedChequeNumber:
              accountMode === VoucherAccountMode.BANK_CHEQUE
                ? normalizeUpper(partyDto?.chequeNumber)
                : null,
            chequeDate:
              accountMode === VoucherAccountMode.BANK_CHEQUE
                ? normalize(partyDto?.chequeDate).slice(0, 10)
                : null,
            chequeBranch:
              accountMode === VoucherAccountMode.BANK_CHEQUE
                ? normalize(partyDto?.chequeBranch)
                : null,
            drawnOn:
              accountMode === VoucherAccountMode.BANK_CHEQUE
                ? normalize(partyDto?.drawnOn)
                : null,
            remarkOptionId: remark?.id ?? null,
            remarkSnapshot: remark
              ? await this.snapshot(this.optionRepository, remark.id)
              : null,
            narration,
            ...totals,
            advanceControlAccountId: advanceAccount?.id ?? null,
            advanceControlAccountSnapshot: advanceAccount
              ? await this.snapshot(this.accountRepository, advanceAccount.id)
              : null,
            createdBy: actorId,
            updatedBy: actorId,
          }),
        );
        for (let index = 0; index < resolvedItems.length; index++) {
          const row = resolvedItems[index];
          await itemRepo.save(
            itemRepo.create({
              voucherId: voucher.id,
              voucher,
              lineNo: index + 1,
              itemTypeOptionId: row.type.id,
              itemTypeSnapshot: await this.snapshot(
                this.optionRepository,
                row.type.id,
              ),
              subledgerPartyProfileId: row.subledger?.id ?? null,
              subledgerPartyProfileSnapshot: row.subledger
                ? await this.snapshot(this.partyRepository, row.subledger.id)
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
        return voucherRepo.findOneOrFail({
          where: { id: voucher.id },
          relations: ["items"],
        });
      })
      .catch(async (error) => {
        if (
          error?.code === "23505" &&
          String(error?.constraint ?? "").includes("idempotency")
        ) {
          const existing = await this.findIdempotent(dto.idempotencyKey, hash);
          if (existing) return existing;
        }
        if (
          error?.code === "23505" &&
          String(error?.constraint ?? "").includes("cheque")
        )
          throw new ConflictException(
            "Cheque Number already exists for this voucher type and account",
          );
        throw error;
      });
  }

  async list(
    type: VoucherType,
    query: VoucherListQueryDto,
    session: VoucherSession,
  ) {
    this.getActor(session);
    const pagination = normalizePagination(query);
    const qb = this.voucherRepository
      .createQueryBuilder("voucher")
      .leftJoinAndSelect("voucher.items", "items")
      .where("voucher.voucherType = :type", { type });
    if (!(session.isAdmin || session.isHo || session.isHoStaff)) {
      if (!session.activeBranchId)
        return buildPaginatedResponse([], 0, pagination);
      qb.andWhere("voucher.branchId = :branchId", {
        branchId: session.activeBranchId,
      });
    } else if (query.branchId)
      qb.andWhere("voucher.branchId = :branchId", { branchId: query.branchId });
    if (query.partyProfileId)
      qb.andWhere("voucher.partyProfileId = :partyProfileId", {
        partyProfileId: query.partyProfileId,
      });
    if (query.dateFrom)
      qb.andWhere("voucher.transactionDate >= :dateFrom", {
        dateFrom: query.dateFrom.slice(0, 10),
      });
    if (query.dateTo)
      qb.andWhere("voucher.transactionDate <= :dateTo", {
        dateTo: query.dateTo.slice(0, 10),
      });
    if (query.search)
      qb.andWhere(
        new Brackets((b) =>
          b
            .where("voucher.number ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("voucher.narration ILIKE :search", {
              search: `%${query.search}%`,
            }),
        ),
      );
    qb.orderBy("voucher.transactionDate", "DESC").addOrderBy(
      "voucher.createdAt",
      "DESC",
    );
    applyPagination(qb, pagination);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResponse(data, total, pagination);
  }

  async findById(type: VoucherType, id: string, session: VoucherSession) {
    this.getActor(session);
    const voucher = await this.voucherRepository.findOne({
      where: { id, voucherType: type },
      relations: ["items"],
    });
    if (!voucher) throw new NotFoundException("Voucher not found");
    if (
      !(session.isAdmin || session.isHo || session.isHoStaff) &&
      voucher.branchId !== session.activeBranchId
    )
      throw new ForbiddenException("Voucher is outside the active branch");
    return voucher;
  }

  async nextNumber(
    type: VoucherType,
    branchId: string,
    session: VoucherSession,
  ) {
    this.getActor(session);
    const effectiveBranchId =
      session.isAdmin || session.isHo || session.isHoStaff
        ? branchId
        : normalize(session.activeBranchId);
    const branch = await this.branchRepository.findOne({
      where: { id: effectiveBranchId },
    });
    if (!branch) throw new NotFoundException("Branch not found");
    return this.additionalSettings.getTransactionNumberPreview(
      VOUCHER_NUMBER_SERIES[type],
      branch.code,
      new Date(),
    );
  }

  async available(
    type: VoucherType.RECEIPT | VoucherType.PAYMENT,
    query: AvailableAdvanceQueryDto,
    session: VoucherSession,
  ) {
    const actorId = this.getActor(session);
    const workplace = await this.resolveWorkplace(
      { branchId: query.branchId, counterId: query.counterId },
      session,
    );
    if (
      workplace.branch.id !== query.branchId ||
      workplace.counter.id !== query.counterId
    )
      throw new ForbiddenException(
        "Advance lookup is outside the active workplace",
      );
    await this.dayPolicy.assertTransactionDateAllowed(
      workplace.branch.id,
      actorId,
      query.transactionDate,
      workplace.counter.id,
    );
    const effectiveBranch = workplace.branch.id;
    const party = await this.party(query.partyProfileId);
    await this.assertPartyVisible(party, actorId, effectiveBranch);
    const expectedMode =
      query.paymentMethod === TransactionPaymentMethod.CASH
        ? VoucherAccountMode.CASH
        : VoucherAccountMode.BANK_CHEQUE;
    const availableQuery = this.voucherRepository
      .createQueryBuilder("voucher")
      .leftJoin(
        "voucher.applications",
        "application",
        `application.state IN (:...states)`,
        {
          states: [
            VoucherAdvanceApplicationState.RESERVED,
            VoucherAdvanceApplicationState.APPLIED,
          ],
        },
      )
      .leftJoin("application.transaction", "applicationTransaction")
      .select("voucher")
      .addSelect(
        `COALESCE(SUM(CASE WHEN application.state = 'APPLIED' OR (application.state = 'RESERVED' AND "applicationTransaction"."status" = 'DRAFT' AND "applicationTransaction"."is_latest" = true AND (:excludeId::uuid IS NULL OR "applicationTransaction"."id" <> :excludeId)) THEN application.amount ELSE 0 END), 0)`,
        "consumed",
      )
      .where("voucher.voucherType = :type", { type })
      .andWhere("voucher.partyProfileId = :partyId", { partyId: party.id })
      .andWhere("voucher.branchId = :branchId", { branchId: effectiveBranch })
      .andWhere("voucher.transactionDate <= :transactionDate", {
        transactionDate: query.transactionDate.slice(0, 10),
      })
      .andWhere("voucher.accountMode = :mode", { mode: expectedMode })
      .setParameter("excludeId", query.excludeTransactionId ?? null)
      .groupBy("voucher.id")
      .having(
        'voucher.finalAmount > COALESCE(SUM(CASE WHEN application.state = \'APPLIED\' OR (application.state = \'RESERVED\' AND "applicationTransaction"."status" = \'DRAFT\' AND "applicationTransaction"."is_latest" = true AND (:excludeId::uuid IS NULL OR "applicationTransaction"."id" <> :excludeId)) THEN application.amount ELSE 0 END), 0)',
      );
    if (query.search)
      availableQuery.andWhere("voucher.number ILIKE :advanceSearch", {
        advanceSearch: `%${query.search.trim()}%`,
      });
    const rows = await availableQuery
      .orderBy("voucher.transactionDate", "ASC")
      .addOrderBy("voucher.number", "ASC")
      .getRawAndEntities();
    return rows.entities.map((voucher, index) => ({
      ...voucher,
      items: undefined,
      applications: undefined,
      availableAmount: money(
        cents(voucher.finalAmount) - cents(rows.raw[index]?.consumed ?? 0),
      ),
    }));
  }

  async prepareAdvancePayment(input: {
    voucherId: string;
    amount: string | number;
    transactionType: TransactionType;
    paymentMethod: TransactionPaymentMethod;
    partyProfileId: string;
    branchId: string;
    transactionDate: string | Date | null;
  }) {
    const voucher = await this.voucherRepository.findOne({
      where: { id: input.voucherId },
    });
    if (!voucher) throw new NotFoundException("Advance voucher not found");
    const expectedType =
      input.transactionType === TransactionType.SALE
        ? VoucherType.RECEIPT
        : VoucherType.PAYMENT;
    const expectedMode =
      input.paymentMethod === TransactionPaymentMethod.CASH
        ? VoucherAccountMode.CASH
        : VoucherAccountMode.BANK_CHEQUE;
    if (
      voucher.voucherType !== expectedType ||
      voucher.accountMode !== expectedMode
    )
      throw new BadRequestException(
        "Advance voucher does not match transaction direction and settlement mode",
      );
    if (
      voucher.partyProfileId !== input.partyProfileId ||
      voucher.branchId !== input.branchId
    )
      throw new BadRequestException(
        "Advance voucher does not match transaction party and branch",
      );
    if (
      voucher.transactionDate > String(input.transactionDate ?? "").slice(0, 10)
    )
      throw new BadRequestException(
        "Advance voucher date cannot be after transaction date",
      );
    await this.party(input.partyProfileId);
    const amount = cents(input.amount);
    if (amount <= 0 || amount > cents(voucher.finalAmount))
      throw new BadRequestException("Advance applied amount is invalid");
    if (
      !voucher.advanceControlAccountId ||
      !voucher.advanceControlAccountSnapshot
    )
      throw new BadRequestException(
        "Advance voucher has no frozen control account",
      );
    return { voucher, amount: money(amount) };
  }

  async reserveApplications(
    manager: EntityManager,
    transaction: Transaction,
    paymentRows: TransactionPayment[],
    applications: Array<AdvanceApplicationPayloadDto | null>,
    actorId: string,
  ) {
    const applicationRepo = manager.getRepository(VoucherAdvanceApplication);
    const voucherRepo = manager.getRepository(AccountingVoucher);
    const seen = new Set<string>();
    for (let index = 0; index < applications.length; index++) {
      const request = applications[index];
      if (!request) continue;
      if (seen.has(request.voucherId))
        throw new BadRequestException(
          "The same advance voucher cannot be selected twice in one transaction",
        );
      seen.add(request.voucherId);
      const voucher = await voucherRepo
        .createQueryBuilder("voucher")
        .where("voucher.id = :id", { id: request.voucherId })
        .setLock("pessimistic_write")
        .getOne();
      if (!voucher) throw new NotFoundException("Advance voucher not found");
      const expectedType =
        transaction.transactionType === TransactionType.SALE
          ? VoucherType.RECEIPT
          : VoucherType.PAYMENT;
      if (
        voucher.voucherType !== expectedType ||
        voucher.partyProfileId !== transaction.partyProfileId ||
        voucher.branchId !== transaction.branchId
      )
        throw new BadRequestException(
          "Advance voucher is not eligible for this transaction",
        );
      if (
        voucher.transactionDate >
        String(transaction.transactionDate).slice(0, 10)
      )
        throw new BadRequestException(
          "Advance voucher date cannot be after transaction date",
        );
      const requested = cents(request.amount);
      if (requested <= 0)
        throw new BadRequestException(
          "Advance applied amount must be greater than zero",
        );
      const consumed = await applicationRepo
        .createQueryBuilder("application")
        .leftJoin("application.transaction", "tx")
        .select("COALESCE(SUM(application.amount), 0)", "amount")
        .where("application.voucherId = :voucherId", { voucherId: voucher.id })
        .andWhere(
          `application.state = 'APPLIED' OR (application.state = 'RESERVED' AND "tx"."status" = 'DRAFT' AND "tx"."is_latest" = true AND "tx"."id" <> :transactionId)`,
          { transactionId: transaction.id },
        )
        .getRawOne();
      if (requested > cents(voucher.finalAmount) - cents(consumed?.amount ?? 0))
        throw new ConflictException(
          `Advance ${voucher.number} no longer has sufficient available balance`,
        );
      const payment = paymentRows[index];
      if (!payment)
        throw new BadRequestException("Advance payment row was not persisted");
      await applicationRepo.save(
        applicationRepo.create({
          voucherId: voucher.id,
          voucher,
          transactionId: transaction.id,
          transaction,
          transactionPaymentId: payment.id,
          transactionPayment: payment,
          amount: money(requested),
          state:
            transaction.status === TransactionStatus.APPROVED
              ? VoucherAdvanceApplicationState.APPLIED
              : VoucherAdvanceApplicationState.RESERVED,
          reservedAt:
            transaction.status === TransactionStatus.DRAFT ? new Date() : null,
          appliedAt:
            transaction.status === TransactionStatus.APPROVED
              ? new Date()
              : null,
          releasedAt: null,
          createdBy: actorId,
          updatedBy: actorId,
        }),
      );
    }
  }

  async applyReservations(
    manager: EntityManager,
    transactionId: string,
    actorId: string,
  ) {
    const repo = manager.getRepository(VoucherAdvanceApplication);
    const rows = await repo
      .createQueryBuilder("application")
      .where("application.transactionId = :transactionId", { transactionId })
      .setLock("pessimistic_write")
      .getMany();
    for (const row of rows) {
      if (row.state === VoucherAdvanceApplicationState.APPLIED) continue;
      if (row.state !== VoucherAdvanceApplicationState.RESERVED)
        throw new ConflictException("Advance reservation is no longer active");
      const voucher = await manager
        .getRepository(AccountingVoucher)
        .createQueryBuilder("voucher")
        .where("voucher.id = :voucherId", { voucherId: row.voucherId })
        .setLock("pessimistic_write")
        .getOne();
      if (!voucher)
        throw new NotFoundException(
          "Advance voucher not found during approval",
        );
      const consumption = await repo
        .createQueryBuilder("application")
        .leftJoin("application.transaction", "tx")
        .select("COALESCE(SUM(application.amount), 0)", "amount")
        .where("application.voucherId = :voucherId", { voucherId: voucher.id })
        .andWhere(
          `application.state = 'APPLIED' OR (application.state = 'RESERVED' AND (("tx"."status" = 'DRAFT' AND "tx"."is_latest" = true) OR application.id = :applicationId))`,
          { applicationId: row.id },
        )
        .getRawOne();
      if (cents(consumption?.amount ?? 0) > cents(voucher.finalAmount))
        throw new ConflictException(
          `Advance ${voucher.number} no longer has sufficient available balance`,
        );
      row.state = VoucherAdvanceApplicationState.APPLIED;
      row.appliedAt = new Date();
      row.updatedBy = actorId;
      await repo.save(row);
    }
  }
}
