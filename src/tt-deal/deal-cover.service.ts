import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { Brackets, DataSource, EntityManager, Repository } from "typeorm";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { AuthenticatedSession } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import { CategoryOptionCodeEnum } from "../category-options/category-option-code.enum";
import { SelectOption } from "../category-options/category-option.entity";
import { SelectOptionService } from "../category-options/category-option.service";
import {
  toDateOnlyString,
  toUtcDateOnly,
  toUtcNextDate,
} from "../common/date/date.util";
import {
  applyPagination,
  buildPaginatedResponse,
  normalizePagination,
} from "../common/pagination";
import { loadEntitySnapshot } from "../common/snapshot/entity-snapshot.util";
import { Currency } from "../currencies/currency.entity";
import { CurrencyRatesService } from "../currency-rates/currency-rates.service";
import { DayEndStartProcessService } from "../day-end-start-process/day-end-start-process.service";
import { MailService } from "../mail/mail.service";
import { Passenger } from "../passengers/passenger.entity";
import {
  ClientType,
  PartyProfile,
} from "../party-profiles/party-profile.entity";
import { ProductIssuer } from "../products/entities/product-issuer.entity";
import { Product } from "../products/product.entity";
import { PurposeSubpurpose } from "../purpose/purpose-subpurpose.entity";
import { Purpose } from "../purpose/purpose.entity";
import { TransactionTypeProfileEnum } from "../transactions/transactions.enums";
import { User } from "../users/user.entity";
import { UserRole } from "../user-roles/user-role.entity";
import {
  ApproveDealCoverDto,
  CreateDealCoverDto,
  RejectDealCoverDto,
  DealCoverAckListQueryDto,
  DealCoverListQueryDto,
  UpdateDealCoverDto,
} from "./dto/deal-cover.dto";
import {
  DealCoverResponseDto,
} from "./dto/deal-cover-response.dto";
import { DealCover } from "./entities/deal-cover.entity";
import { DealCoverStatus } from "./deal-cover.enums";

@Injectable()
export class DealCoverService {
  constructor(
    @InjectDataSource("database2") private readonly database2: DataSource,
    @InjectRepository(DealCover, "database2")
    private readonly coverRepository: Repository<DealCover>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(AccountProfile)
    private readonly accountProfileRepository: Repository<AccountProfile>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductIssuer)
    private readonly productIssuerRepository: Repository<ProductIssuer>,
    @InjectRepository(PartyProfile)
    private readonly partyProfileRepository: Repository<PartyProfile>,
    @InjectRepository(Passenger)
    private readonly passengerRepository: Repository<Passenger>,
    @InjectRepository(Purpose)
    private readonly purposeRepository: Repository<Purpose>,
    @InjectRepository(PurposeSubpurpose)
    private readonly purposeSubpurposeRepository: Repository<PurposeSubpurpose>,
    @InjectRepository(SelectOption)
    private readonly selectOptionRepository: Repository<SelectOption>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    private readonly selectOptionService: SelectOptionService,
    private readonly dayEndStartProcessService: DayEndStartProcessService,
    private readonly currencyRatesService: CurrencyRatesService,
    private readonly additionalSettingService: AdditionalSettingService,
    private readonly mailService: MailService,
  ) {}

  private isHo(session: AuthenticatedSession) {
    return Boolean(session?.isAdmin || session?.isHo || session?.isHoStaff);
  }

  private clean(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private parsePositiveAmount(value: string, message: string) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(message);
    }
    return amount;
  }

  private parseNonNegativeAmount(value: string | undefined, message: string) {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException(message);
    }
    return amount;
  }

  private parsePositiveRate(value: string, message: string) {
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new BadRequestException(message);
    }
    return rate;
  }

  private async requireActiveBranch(branchId: string) {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId, isActive: true },
    });
    if (!branch) {
      throw new NotFoundException(`Active branch ${branchId} was not found`);
    }
    return branch;
  }

  private resolveBranchId(
    dtoBranchId: string | undefined,
    session: AuthenticatedSession,
  ) {
    const canSelectBranch = this.isHo(session);
    const effectiveBranchId = canSelectBranch
      ? dtoBranchId || session.activeBranchId
      : session.activeBranchId;
    if (
      !effectiveBranchId ||
      (!canSelectBranch && dtoBranchId && dtoBranchId !== effectiveBranchId)
    ) {
      throw new BadRequestException(
        "Deal cover must use the current workplace branch",
      );
    }
    return effectiveBranchId;
  }

  private assertPending(cover: DealCover) {
    if (cover.status !== DealCoverStatus.PENDING) {
      throw new BadRequestException(
        "Only PENDING deal covers can be modified or cancelled",
      );
    }
  }

  private assertBranchAccess(cover: DealCover, session: AuthenticatedSession) {
    if (!this.isHo(session) && cover.branchId !== session.activeBranchId) {
      throw new ForbiddenException("Deal cover is outside your branch");
    }
  }

  private async resolveDealRate(productId: string, currencyId: string) {
    const latestRates =
      await this.currencyRatesService.findLatestRates(currencyId);
    const latest = latestRates[0];
    if (!latest?.baseSaleRate || !latest?.baseBuyRate) {
      throw new BadRequestException(
        "No active currency rate is available to resolve the deal rate",
      );
    }
    const quote = await this.currencyRatesService.previewQuote({
      productId,
      currencyId,
      provider: latest.provider,
      baseBuyRate: latest.baseBuyRate,
      baseSaleRate: latest.baseSaleRate,
    });
    if (!quote.sale?.isValid || !quote.sale.finalRate) {
      throw new BadRequestException(
        quote.sale?.reason ||
          "Sale margin rate could not be resolved for this product and currency",
      );
    }
    return {
      dealRate: quote.sale.finalRate,
      snapshot: {
        source: quote.effectiveSource,
        groupCode: quote.effectiveGroupCode,
        provider: quote.provider,
        baseBuyRate: quote.baseBuyRate,
        baseSaleRate: quote.baseSaleRate,
        sale: quote.sale,
        buy: quote.buy,
        currencyRateId: latest.id,
      } as Record<string, unknown>,
    };
  }

  private async assertIssuerLinked(productId: string, issuerId: string) {
    const link = await this.productIssuerRepository.findOne({
      where: { productId, partyProfileId: issuerId },
    });
    if (!link) {
      throw new BadRequestException(
        "Issuer is not linked to the selected product",
      );
    }
  }

  async getMaturityDayLimit(maturityOptionId: string): Promise<number> {
    const option = await this.selectOptionService.findActiveEntityByIdAndCode(
      maturityOptionId,
      CategoryOptionCodeEnum.TtMaturity,
    );
    if (!option) {
      throw new BadRequestException(
        "Maturity option must be an active TTMATURITY category option",
      );
    }
    return this.parseMaturityDayLimitFromOption(option);
  }

  private parseMaturityDayLimitFromOption(option: {
    value: string;
    label: string;
  }): number {
    const parsed = Number(String(option.value).trim());
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      throw new BadRequestException(
        `TT maturity option "${option.label}" value must be a non-negative whole number of days (got "${option.value}")`,
      );
    }
    return parsed;
  }

  private async assertMaturityOption(maturityOptionId: string) {
    const option = await this.selectOptionService.findActiveEntityByIdAndCode(
      maturityOptionId,
      CategoryOptionCodeEnum.TtMaturity,
    );
    if (!option) {
      throw new BadRequestException(
        "Maturity option must be an active TTMATURITY category option",
      );
    }
    this.parseMaturityDayLimitFromOption(option);
    return option;
  }

  private addUtcDays(date: Date, days: number) {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  async assertDealWithinMaturityWindow(
    deal: DealCover,
    asOfDate: Date | string,
  ) {
    const asOf = toDateOnlyString(asOfDate);
    const dealDate = toDateOnlyString(deal.transactionDate);
    if (!asOf || !dealDate) {
      throw new BadRequestException(
        "Unable to validate TT deal maturity window",
      );
    }
    const dayLimit = await this.getMaturityDayLimit(deal.maturityOptionId);
    const maturityEnd = toDateOnlyString(
      this.addUtcDays(toUtcDateOnly(dealDate), dayLimit),
    );
    if (!maturityEnd || asOf > maturityEnd) {
      throw new BadRequestException(
        `TT deal ${deal.dealNo ?? deal.id} is past its maturity window`,
      );
    }
  }

  async assertDealSelectableForPunch(
    deal: DealCover,
    asOfDate: Date | string,
  ) {
    if (deal.status !== DealCoverStatus.APPROVED) {
      throw new BadRequestException(
        `TT deal ${deal.dealNo ?? deal.id} must be APPROVED before punch`,
      );
    }
    if (deal.consumedTransactionItemId || deal.consumedTransactionId) {
      throw new BadRequestException(
        `TT deal ${deal.dealNo ?? deal.id} has already been consumed`,
      );
    }
    if (deal.cancelledAt) {
      throw new BadRequestException(
        `TT deal ${deal.dealNo ?? deal.id} is cancelled`,
      );
    }
    await this.assertDealWithinMaturityWindow(deal, asOfDate);
  }

  /**
   * Locks and marks a deal as consumed by an approved transaction item.
   * Call only from the approve / auto-approve path.
   */
  async consumeDealForApprovedItem(
    manager: EntityManager,
    dealId: string,
    transactionId: string,
    transactionItemId: string,
    asOfDate: Date | string,
  ) {
    const repo = manager.getRepository(DealCover);
    const locked = await repo
      .createQueryBuilder("cover")
      .where("cover.id = :id", { id: dealId })
      .setLock("pessimistic_write")
      .getOne();
    if (!locked) {
      throw new BadRequestException(`Deal cover ${dealId} was not found`);
    }
    await this.assertDealSelectableForPunch(locked, asOfDate);
    locked.consumedTransactionItemId = transactionItemId;
    locked.consumedTransactionId = transactionId;
    locked.updatedBy = locked.updatedBy ?? null;
    return repo.save(locked);
  }

  private async assertSubpurpose(
    purposeId: string,
    subpurposeId?: string | null,
  ) {
    if (!subpurposeId) return null;
    const subpurpose = await this.purposeSubpurposeRepository.findOne({
      where: { id: subpurposeId, purposeId, isActive: true },
    });
    if (!subpurpose) {
      throw new BadRequestException(
        "Subpurpose must belong to the selected purpose",
      );
    }
    return subpurpose;
  }

  private async loadPassengerIdentity(
    dto: CreateDealCoverDto | UpdateDealCoverDto,
  ) {
    let passenger: Passenger | null = null;
    if (dto.passengerId) {
      passenger = await this.passengerRepository.findOne({
        where: { id: dto.passengerId },
      });
      if (!passenger) {
        throw new NotFoundException(
          `Passenger ${dto.passengerId} was not found`,
        );
      }
    }

    return {
      passengerId: passenger?.id ?? dto.passengerId ?? null,
      passengerName:
        this.clean(dto.passengerName) ??
        this.clean(passenger?.passportPassengerName) ??
        this.clean(passenger?.panHolderName) ??
        null,
      passengerPan:
        this.clean(dto.passengerPan)?.toUpperCase() ??
        this.clean(passenger?.panNumber)?.toUpperCase() ??
        null,
      passengerPanHolder:
        this.clean(dto.passengerPanHolder) ??
        this.clean(passenger?.panHolderName) ??
        null,
      passengerPanDob:
        this.clean(dto.passengerPanDob) ??
        (passenger?.panDob ? toDateOnlyString(passenger.panDob) : null),
      passengerPassport:
        this.clean(dto.passengerPassport)?.toUpperCase() ??
        this.clean(passenger?.passportNumber)?.toUpperCase() ??
        null,
    };
  }

  private async buildValidatedFields(
    dto: CreateDealCoverDto,
    session: AuthenticatedSession,
    options?: {
      lockDealRate?: { dealRate: string; dealRateSnapshot: Record<string, unknown> };
    },
  ) {
    if (!session?.userId) {
      throw new ForbiddenException("User session is required");
    }
    const branchId = this.resolveBranchId(dto.branchId, session);
    const branch = await this.requireActiveBranch(branchId);
    const datePolicy =
      await this.dayEndStartProcessService.assertTransactionDateAllowed(
        branch.id,
        session.userId,
        dto.transactionDate,
      );
    const transactionDate = toUtcDateOnly(
      dto.transactionDate || datePolicy.allowedDate,
    );

    const bank = await this.accountProfileRepository.findOne({
      where: { id: dto.bankAccountProfileId, active: true },
    });
    if (!bank) {
      throw new NotFoundException("Active bank account profile was not found");
    }

    const product = await this.productRepository.findOne({
      where: { id: dto.productId, isActiveProduct: true },
    });
    if (!product) {
      throw new NotFoundException("Active product was not found");
    }

    const party = await this.partyProfileRepository.findOne({
      where: { id: dto.partyProfileId, active: true },
    });
    if (!party) {
      throw new NotFoundException("Active party profile was not found");
    }
    if (party.type !== dto.partyProfileType) {
      throw new BadRequestException(
        "Party profile type does not match the selected party",
      );
    }

    let marketing: PartyProfile | null = null;
    if (dto.marketingExecutiveId) {
      marketing = await this.partyProfileRepository.findOne({
        where: {
          id: dto.marketingExecutiveId,
          active: true,
          type: ClientType.MARKETING_EXECUTIVE,
        },
      });
      if (!marketing) {
        throw new NotFoundException(
          "Active marketing executive profile was not found",
        );
      }
    }

    const purpose = await this.purposeRepository.findOne({
      where: { id: dto.purposeId },
    });
    if (!purpose) {
      throw new NotFoundException("Purpose was not found");
    }

    const currency = await this.currencyRepository.findOne({
      where: { id: dto.currencyId },
    });
    if (!currency) {
      throw new NotFoundException(`Currency ${dto.currencyId} was not found`);
    }

    const issuer = await this.partyProfileRepository.findOne({
      where: {
        id: dto.issuerPartyProfileId,
        active: true,
        type: ClientType.CARD_ISSUER_PROFILE,
      },
    });
    if (!issuer) {
      throw new NotFoundException("Active issuer party profile was not found");
    }

    await this.assertIssuerLinked(product.id, issuer.id);
    await this.assertMaturityOption(dto.maturityOptionId);
    const subpurpose = await this.assertSubpurpose(
      purpose.id,
      dto.subpurposeId,
    );
    const passengerIdentity = await this.loadPassengerIdentity(dto);

    const rate = options?.lockDealRate
      ? {
          dealRate: options.lockDealRate.dealRate,
          snapshot: options.lockDealRate.dealRateSnapshot,
        }
      : await this.resolveDealRate(product.id, currency.id);

    const feAmount = this.parsePositiveAmount(
      dto.feAmount,
      "FE amount must be greater than zero",
    );
    const fbChargeAmount = this.parseNonNegativeAmount(
      dto.fbChargeAmount,
      "FB charge amount cannot be negative",
    );
    const dealRate = this.parsePositiveRate(
      rate.dealRate,
      "Deal rate must be greater than zero",
    );

    const [
      branchSnapshot,
      bankSnapshot,
      productSnapshot,
      partySnapshot,
      marketingSnapshot,
      purposeSnapshot,
      subpurposeSnapshot,
      currencySnapshot,
      issuerSnapshot,
    ] = await Promise.all([
      loadEntitySnapshot(this.branchRepository, branch.id),
      loadEntitySnapshot(this.accountProfileRepository, bank.id),
      loadEntitySnapshot(this.productRepository, product.id),
      loadEntitySnapshot(this.partyProfileRepository, party.id),
      marketing
        ? loadEntitySnapshot(this.partyProfileRepository, marketing.id)
        : Promise.resolve(null),
      loadEntitySnapshot(this.purposeRepository, purpose.id),
      subpurpose
        ? loadEntitySnapshot(this.purposeSubpurposeRepository, subpurpose.id)
        : Promise.resolve(null),
      loadEntitySnapshot(this.currencyRepository, currency.id),
      loadEntitySnapshot(this.partyProfileRepository, issuer.id),
    ]);

    return {
      branchId: branch.id,
      branchSnapshot: branchSnapshot ?? {},
      transactionDate,
      bankAccountProfileId: bank.id,
      bankAccountProfileSnapshot: bankSnapshot ?? {},
      productId: product.id,
      productSnapshot: productSnapshot ?? {},
      partyProfileType: dto.partyProfileType,
      partyProfileId: party.id,
      partyProfileSnapshot: partySnapshot ?? {},
      marketingExecutiveId: marketing?.id ?? null,
      marketingExecutiveSnapshot: marketingSnapshot,
      ...passengerIdentity,
      purposeId: purpose.id,
      purposeSnapshot: purposeSnapshot ?? {},
      subpurposeId: subpurpose?.id ?? null,
      subpurposeSnapshot: subpurposeSnapshot,
      currencyId: currency.id,
      currencySnapshot: currencySnapshot ?? {},
      issuerPartyProfileId: issuer.id,
      issuerPartyProfileSnapshot: issuerSnapshot ?? {},
      feAmount: feAmount.toFixed(2),
      dealRate: dealRate.toFixed(7),
      dealRateSnapshot: rate.snapshot,
      inrAmount: (feAmount * dealRate).toFixed(2),
      fbChargeAmount: fbChargeAmount.toFixed(2),
      narration: this.clean(dto.narration),
      maturityOptionId: dto.maturityOptionId,
      updatedBy: session.userId,
    };
  }

  async create(dto: CreateDealCoverDto, session: AuthenticatedSession) {
    const fields = await this.buildValidatedFields(dto, session);
    const branchCode = String(
      (fields.branchSnapshot as { code?: string } | null)?.code ?? "",
    ).trim();
    if (!branchCode) {
      throw new BadRequestException(
        "Branch code is required to generate the deal cover transaction number",
      );
    }
    const transactionNumber =
      await this.additionalSettingService.reserveTransactionNumber(
        TransactionTypeProfileEnum.DEAL_COVER,
        branchCode,
        fields.transactionDate,
      );
    const saved = await this.coverRepository.save(
      this.coverRepository.create({
        ...fields,
        transactionNumber,
        status: DealCoverStatus.PENDING,
        createdBy: session.userId!,
      }),
    );
    return DealCoverResponseDto.fromEntity(saved);
  }

  private applyListFilters(
    qb: ReturnType<Repository<DealCover>["createQueryBuilder"]>,
    query: DealCoverListQueryDto,
    session: AuthenticatedSession,
  ) {
    if (!this.isHo(session)) {
      if (!session.activeBranchId) {
        qb.andWhere("1=0");
        return;
      }
      qb.andWhere("cover.branchId = :sessionBranchId", {
        sessionBranchId: session.activeBranchId,
      });
    } else if (query.branchId) {
      qb.andWhere("cover.branchId = :branchId", { branchId: query.branchId });
    }

    if (query.status?.length) {
      qb.andWhere("cover.status IN (:...statuses)", {
        statuses: query.status,
      });
    }

    if (query.bankAccountProfileId) {
      qb.andWhere("cover.bankAccountProfileId = :bankAccountProfileId", {
        bankAccountProfileId: query.bankAccountProfileId,
      });
    }
    if (query.productId) {
      qb.andWhere("cover.productId = :productId", {
        productId: query.productId,
      });
    }
    if (query.currencyId) {
      qb.andWhere("cover.currencyId = :currencyId", {
        currencyId: query.currencyId,
      });
    }
    if (query.issuerPartyProfileId) {
      qb.andWhere("cover.issuerPartyProfileId = :issuerPartyProfileId", {
        issuerPartyProfileId: query.issuerPartyProfileId,
      });
    }
    if (query.partyProfileId) {
      qb.andWhere("cover.partyProfileId = :partyProfileId", {
        partyProfileId: query.partyProfileId,
      });
    }
    if (query.dateFrom) {
      qb.andWhere("cover.transactionDate >= :dateFrom", {
        dateFrom: toUtcDateOnly(query.dateFrom),
      });
    }
    if (query.dateTo) {
      qb.andWhere("cover.transactionDate < :dateTo", {
        dateTo: toUtcNextDate(query.dateTo),
      });
    }
    if (query.forPunch) {
      qb.andWhere("cover.consumedTransactionItemId IS NULL");
      qb.andWhere("cover.consumedTransactionId IS NULL");
      qb.andWhere("cover.cancelledAt IS NULL");
    }
    const search = this.clean(query.search);
    if (search) {
      const like = `%${search}%`;
      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where("cover.transactionNumber ILIKE :like", { like })
            .orWhere("cover.dealNo ILIKE :like", { like })
            .orWhere("cover.passengerName ILIKE :like", { like })
            .orWhere("cover.passengerPan ILIKE :like", { like })
            .orWhere("cover.passengerPassport ILIKE :like", { like })
            .orWhere("cover.narration ILIKE :like", { like });
        }),
      );
    }
  }

  async list(query: DealCoverListQueryDto, session: AuthenticatedSession) {
    const pagination = normalizePagination(query);
    const qb = this.coverRepository.createQueryBuilder("cover");
    this.applyListFilters(qb, query, session);
    qb.orderBy("cover.transactionDate", "DESC").addOrderBy(
      "cover.createdAt",
      "DESC",
    );
    if (query.forPunch) {
      const rows = await qb.getMany();
      const asOf = query.asOfDate ?? new Date();
      const selectable: DealCover[] = [];
      for (const row of rows) {
        try {
          await this.assertDealWithinMaturityWindow(row, asOf);
          selectable.push(row);
        } catch {
          // past maturity — hide from punch picker
        }
      }
      const page = selectable.slice(
        pagination.offset,
        pagination.offset + pagination.limit,
      );
      return buildPaginatedResponse(
        page.map(DealCoverResponseDto.fromEntity),
        selectable.length,
        pagination,
      );
    }
    applyPagination(qb, pagination);
    const [rows, total] = await qb.getManyAndCount();
    return buildPaginatedResponse(
      rows.map(DealCoverResponseDto.fromEntity),
      total,
      pagination,
    );
  }

  async listForAck(
    query: DealCoverAckListQueryDto,
    session: AuthenticatedSession,
  ) {
    return this.list(query, session);
  }

  async get(id: string, session: AuthenticatedSession) {
    const cover = await this.coverRepository.findOne({ where: { id } });
    if (!cover) {
      throw new NotFoundException(`Deal cover ${id} was not found`);
    }
    this.assertBranchAccess(cover, session);
    return DealCoverResponseDto.fromEntity(cover);
  }

  async update(
    id: string,
    dto: UpdateDealCoverDto,
    session: AuthenticatedSession,
  ) {
    const existing = await this.coverRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Deal cover ${id} was not found`);
    }
    this.assertBranchAccess(existing, session);
    this.assertPending(existing);

    const merged: CreateDealCoverDto = {
      branchId: dto.branchId ?? existing.branchId,
      transactionDate:
        dto.transactionDate ?? toDateOnlyString(existing.transactionDate)!,
      bankAccountProfileId:
        dto.bankAccountProfileId ?? existing.bankAccountProfileId,
      productId: dto.productId ?? existing.productId,
      partyProfileType: dto.partyProfileType ?? existing.partyProfileType,
      partyProfileId: dto.partyProfileId ?? existing.partyProfileId,
      marketingExecutiveId:
        dto.marketingExecutiveId === undefined
          ? (existing.marketingExecutiveId ?? undefined)
          : dto.marketingExecutiveId,
      passengerId:
        dto.passengerId === undefined
          ? (existing.passengerId ?? undefined)
          : dto.passengerId,
      passengerName:
        dto.passengerName === undefined
          ? (existing.passengerName ?? undefined)
          : dto.passengerName,
      passengerPan:
        dto.passengerPan === undefined
          ? (existing.passengerPan ?? undefined)
          : dto.passengerPan,
      passengerPanHolder:
        dto.passengerPanHolder === undefined
          ? (existing.passengerPanHolder ?? undefined)
          : dto.passengerPanHolder,
      passengerPanDob:
        dto.passengerPanDob === undefined
          ? (existing.passengerPanDob ?? undefined)
          : dto.passengerPanDob,
      passengerPassport:
        dto.passengerPassport === undefined
          ? (existing.passengerPassport ?? undefined)
          : dto.passengerPassport,
      purposeId: dto.purposeId ?? existing.purposeId,
      subpurposeId:
        dto.subpurposeId === undefined
          ? (existing.subpurposeId ?? undefined)
          : dto.subpurposeId,
      currencyId: dto.currencyId ?? existing.currencyId,
      issuerPartyProfileId:
        dto.issuerPartyProfileId ?? existing.issuerPartyProfileId,
      feAmount: dto.feAmount ?? existing.feAmount,
      fbChargeAmount: dto.fbChargeAmount ?? existing.fbChargeAmount,
      narration:
        dto.narration === undefined
          ? (existing.narration ?? undefined)
          : dto.narration,
      maturityOptionId: dto.maturityOptionId ?? existing.maturityOptionId,
    };

    const productOrCurrencyChanged =
      merged.productId !== existing.productId ||
      merged.currencyId !== existing.currencyId;

    const fields = await this.buildValidatedFields(merged, session, {
      lockDealRate: productOrCurrencyChanged
        ? undefined
        : {
            dealRate: existing.dealRate,
            dealRateSnapshot: existing.dealRateSnapshot,
          },
    });

    Object.assign(existing, {
      ...fields,
      status: DealCoverStatus.PENDING,
      dealNo: null,
      bookingRate: null,
    });

    const saved = await this.coverRepository.save(existing);
    return DealCoverResponseDto.fromEntity(saved);
  }

  async cancel(id: string, session: AuthenticatedSession) {
    if (!session?.userId) {
      throw new ForbiddenException("User session is required");
    }
    const saved = await this.database2.transaction(async (manager) => {
      const repo = manager.getRepository(DealCover);
      const cover = await repo
        .createQueryBuilder("cover")
        .where("cover.id = :id", { id })
        .setLock("pessimistic_write")
        .getOne();
      if (!cover) {
        throw new NotFoundException(`Deal cover ${id} was not found`);
      }
      this.assertBranchAccess(cover, session);
      this.assertPending(cover);
      cover.status = DealCoverStatus.CANCELLED;
      cover.cancelledAt = new Date();
      cover.cancelledById = session.userId;
      cover.updatedBy = session.userId;
      return repo.save(cover);
    });
    return DealCoverResponseDto.fromEntity(saved);
  }

  async approve(
    id: string,
    dto: ApproveDealCoverDto,
    session: AuthenticatedSession,
  ) {
    if (!session?.userId) {
      throw new ForbiddenException("User session is required");
    }
    const dealNo = this.clean(dto.dealNo);
    if (!dealNo) {
      throw new BadRequestException("Deal number is required");
    }
    const bookingRate = this.parsePositiveRate(
      dto.bookingRate,
      "Booking rate must be greater than zero",
    );

    const saved = await this.database2.transaction(async (manager) => {
      const repo = manager.getRepository(DealCover);
      const cover = await repo
        .createQueryBuilder("cover")
        .where("cover.id = :id", { id })
        .setLock("pessimistic_write")
        .getOne();
      if (!cover) {
        throw new NotFoundException(`Deal cover ${id} was not found`);
      }
      if (cover.status !== DealCoverStatus.PENDING) {
        throw new BadRequestException("Only PENDING deals can be approved");
      }
      cover.status = DealCoverStatus.APPROVED;
      cover.dealNo = dealNo;
      cover.bookingRate = bookingRate.toFixed(7);
      cover.approvedAt = new Date();
      cover.approvedById = session.userId;
      cover.rejectionReason = null;
      cover.rejectedAt = null;
      cover.rejectedById = null;
      cover.updatedBy = session.userId;
      return repo.save(cover);
    });

    await this.notifyBranchUsers(
      saved.branchId,
      `Deal cover ${saved.transactionNumber} approved`,
      `Deal cover ${saved.transactionNumber} was approved. Deal number: ${saved.dealNo}.`,
    );

    return DealCoverResponseDto.fromEntity(saved);
  }

  async reject(
    id: string,
    dto: RejectDealCoverDto,
    session: AuthenticatedSession,
  ) {
    if (!session?.userId) {
      throw new ForbiddenException("User session is required");
    }
    const reason = this.clean(dto.reason);
    if (!reason) {
      throw new BadRequestException("Rejection reason is required");
    }

    const saved = await this.database2.transaction(async (manager) => {
      const repo = manager.getRepository(DealCover);
      const cover = await repo
        .createQueryBuilder("cover")
        .where("cover.id = :id", { id })
        .setLock("pessimistic_write")
        .getOne();
      if (!cover) {
        throw new NotFoundException(`Deal cover ${id} was not found`);
      }
      if (cover.status !== DealCoverStatus.PENDING) {
        throw new BadRequestException("Only PENDING deals can be rejected");
      }
      cover.status = DealCoverStatus.REJECTED;
      cover.rejectionReason = reason;
      cover.rejectedAt = new Date();
      cover.rejectedById = session.userId;
      cover.updatedBy = session.userId;
      return repo.save(cover);
    });

    await this.notifyBranchUsers(
      saved.branchId,
      `Deal cover ${saved.transactionNumber} rejected`,
      `Deal cover ${saved.transactionNumber} was rejected. Reason: ${reason}`,
    );

    return DealCoverResponseDto.fromEntity(saved);
  }

  private async notifyBranchUsers(
    branchId: string,
    subject: string,
    text: string,
  ) {
    try {
      const userRoles = await this.userRoleRepository
        .createQueryBuilder("userRole")
        .leftJoinAndSelect("userRole.user", "user")
        .leftJoin("userRole.branch", "branch")
        .where("branch.id = :branchId", { branchId })
        .getMany();
      const recipients = Array.from(
        new Map(
          userRoles
            .map((role) => role.user)
            .filter((user): user is User => Boolean(user?.email))
            .map((user) => [user.id, user]),
        ).values(),
      );
      for (const recipient of recipients) {
        await this.mailService.sendEmail({
          to: recipient.email,
          subject,
          text,
        });
      }
    } catch {
      // Notification delivery must not roll back ack approve/reject.
    }
  }
}
