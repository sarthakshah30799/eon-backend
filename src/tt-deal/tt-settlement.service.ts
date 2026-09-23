import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { AuthenticatedSession } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import {
  toDateOnlyString,
  toUtcDateOnly,
} from "../common/date/date.util";
import {
  buildPaginatedResponse,
  normalizePagination,
} from "../common/pagination";
import { DayEndStartProcessService } from "../day-end-start-process/day-end-start-process.service";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionItem } from "../transactions/entities/transaction-item.entity";
import {
  TransactionStatus,
  TransactionTypeProfileEnum,
} from "../transactions/transactions.enums";
import {
  CancelTtSettlementDocumentDto,
  CreateTtSettlementDocumentDto,
  RejectTtSettlementDocumentDto,
  TtSettlementDocumentQueryDto,
  TtSettlementUnsettledQueryDto,
} from "./dto/tt-settlement.dto";
import { DealCover } from "./entities/deal-cover.entity";
import { TtSettlement } from "./entities/tt-settlement.entity";
import { TtSettlementDocument } from "./entities/tt-settlement-document.entity";
import {
  TtSettlementDocumentKind,
  TtSettlementDocumentStatus,
  TtSettlementMode,
  TtSettlementStatus,
} from "./tt-deal.enums";

type TtCapableTransactionItem = TransactionItem & {
  dealCoverId?: string | null;
};

@Injectable()
export class TtSettlementService {
  constructor(
    @InjectDataSource("database2") private readonly database2: DataSource,
    @InjectRepository(TtSettlement, "database2")
    private readonly settlementRepository: Repository<TtSettlement>,
    @InjectRepository(TtSettlementDocument, "database2")
    private readonly documentRepository: Repository<TtSettlementDocument>,
    @InjectRepository(DealCover, "database2")
    private readonly dealCoverRepository: Repository<DealCover>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly additionalSettingService: AdditionalSettingService,
    private readonly dayEndStartProcessService: DayEndStartProcessService,
  ) {}

  private isHo(session: AuthenticatedSession) {
    return Boolean(session?.isAdmin || session?.isHo || session?.isHoStaff);
  }

  private assertHo(session: AuthenticatedSession) {
    if (!session?.userId || !this.isHo(session)) {
      throw new ForbiddenException(
        "Only Admin/HO users can perform this action",
      );
    }
  }

  private clean(value?: string) {
    return value?.trim() || null;
  }

  private toTimestamp(
    value: Date | string | null | undefined,
    message: string,
  ): Date {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Date(value.getTime());
    }
    const isoDate = toDateOnlyString(value);
    if (!isoDate) throw new BadRequestException(message);
    return toUtcDateOnly(isoDate);
  }

  private isCalendarBefore(
    left: Date | string | null | undefined,
    right: Date | string | null | undefined,
  ) {
    const leftDate = toDateOnlyString(left);
    const rightDate = toDateOnlyString(right);
    return Boolean(leftDate && rightDate && leftDate < rightDate);
  }

  private parseRate(value: string, message: string) {
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new BadRequestException(message);
    }
    return rate;
  }

  private amountFrom(feAmount: string, rate: number) {
    return (Number(feAmount) * rate).toFixed(2);
  }

  private async getBranch(id: string) {
    const branch = await this.branchRepository.findOne({
      where: { id, isActive: true },
      relations: ["company"],
    });
    if (!branch) {
      throw new NotFoundException(`Active branch ${id} was not found`);
    }
    return branch;
  }

  private async getSettlementHo(sellingBranch: Branch) {
    if (sellingBranch.isHeadOffice) return sellingBranch;
    const companyId = sellingBranch.company?.id;
    const query = this.branchRepository
      .createQueryBuilder("branch")
      .leftJoinAndSelect("branch.company", "company")
      .where("branch.isHeadOffice = true AND branch.isActive = true")
      .orderBy("branch.createdAt", "ASC");
    if (companyId) query.andWhere("company.id = :companyId", { companyId });
    const ho = await query.getOne();
    if (!ho) {
      throw new BadRequestException(
        "An active HO branch is required for TT settlement",
      );
    }
    return ho;
  }

  private async reserveNumber(branch: Branch, date: Date) {
    return this.additionalSettingService.reserveTransactionNumber(
      TransactionTypeProfileEnum.TT_SETTLE,
      branch.code,
      date,
    );
  }

  private sortIds(ids: string[]) {
    return [...new Set(ids.filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    );
  }

  private async lockSettlementRows(manager: EntityManager, ids: string[]) {
    const uniqueIds = this.sortIds(ids);
    if (!uniqueIds.length) return [];
    for (const id of uniqueIds) {
      await manager.query(
        `SELECT 1 FROM tt_settlements WHERE id = $1 FOR UPDATE`,
        [id],
      );
    }
    return manager.getRepository(TtSettlement).find({
      where: { id: In(uniqueIds) },
    });
  }

  private async createDocument(
    manager: EntityManager,
    input: {
      kind: TtSettlementDocumentKind;
      status: TtSettlementDocumentStatus;
      transactionDate: Date;
      numberBranch: Branch;
      issuerPartyProfileId: string;
      issuerPartyProfileSnapshot: TtSettlement["issuerPartyProfileSnapshot"];
      currencyId: string;
      currencySnapshot: TtSettlement["currencySnapshot"];
      branchId: string;
      branchSnapshot: TtSettlement["branchSnapshot"];
      hoBranchId: string;
      hoBranchSnapshot: TtSettlement["hoBranchSnapshot"];
      reference: string | null;
      remarks: string | null;
      actorId: string;
    },
  ) {
    const repo = manager.getRepository(TtSettlementDocument);
    const transactionNumber = await this.reserveNumber(
      input.numberBranch,
      input.transactionDate,
    );
    return repo.save(
      repo.create({
        transactionNumber,
        transactionDate: input.transactionDate,
        kind: input.kind,
        status: input.status,
        issuerPartyProfileId: input.issuerPartyProfileId,
        issuerPartyProfileSnapshot: input.issuerPartyProfileSnapshot,
        currencyId: input.currencyId,
        currencySnapshot: input.currencySnapshot,
        branchId: input.branchId,
        branchSnapshot: input.branchSnapshot,
        hoBranchId: input.hoBranchId,
        hoBranchSnapshot: input.hoBranchSnapshot,
        reference: input.reference,
        remarks: input.remarks,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      }),
    );
  }

  /**
   * Creates TT settlement rows for approved transaction items that reference a deal cover.
   * Settle rate is always the locked dealRate. No TT control account is invented — status
   * workflow only until posting account is confirmed.
   */
  async createForApprovedTtItems(
    manager: EntityManager,
    transaction: Transaction,
    items: TtCapableTransactionItem[],
    actorId: string,
  ) {
    if (transaction.status !== TransactionStatus.APPROVED) {
      throw new BadRequestException(
        "TT settlement requires an approved transaction",
      );
    }
    const sellingBranch = await this.getBranch(transaction.branchId);
    const ho = await this.getSettlementHo(sellingBranch);
    const repo = manager.getRepository(TtSettlement);
    const dealRepo = manager.getRepository(DealCover);
    const saleRows: TtSettlement[] = [];

    for (const item of items) {
      const dealCoverId = item.dealCoverId;
      if (!dealCoverId) continue;

      let row = await repo.findOne({
        where: {
          dealCoverId,
          transactionItemId: item.id,
        },
      });
      if (!row) {
        const deal = await dealRepo.findOne({ where: { id: dealCoverId } });
        if (!deal) {
          throw new BadRequestException(
            `TT deal cover ${dealCoverId} was not found for item ${item.lineNo}`,
          );
        }
        const dealRate = Number(deal.dealRate);
        if (!Number.isFinite(dealRate) || dealRate <= 0) {
          throw new BadRequestException(
            `TT deal cover ${deal.dealNo ?? deal.id} has an invalid deal rate`,
          );
        }
        const feAmount = Number(item.quantity ?? deal.feAmount);
        const saleDate = this.toTimestamp(
          transaction.transactionDate,
          `TT item ${item.lineNo} is missing a transaction date`,
        );
        const freezeBranch = true;
        const mode = TtSettlementMode.AUTO;
        row = await repo.save(
          repo.create({
            dealCoverId: deal.id,
            transactionId: transaction.id,
            transactionItemId: item.id,
            branchId: sellingBranch.id,
            branchSnapshot: transaction.branchSnapshot,
            hoBranchId: ho.id,
            hoBranchSnapshot: {
              id: ho.id,
              code: ho.code,
              name: ho.name,
              label: `${ho.code} - ${ho.name}`,
            },
            issuerPartyProfileId:
              item.issuerPartyProfileId ?? deal.issuerPartyProfileId,
            issuerPartyProfileSnapshot:
              item.issuerPartyProfileSnapshot ??
              deal.issuerPartyProfileSnapshot,
            currencyId: item.currencyId ?? deal.currencyId,
            currencySnapshot: item.currencySnapshot ?? deal.currencySnapshot,
            productId: item.productId ?? deal.productId,
            productSnapshot: item.productSnapshot ?? deal.productSnapshot,
            passengerId: transaction.passengerId,
            passengerSnapshot: transaction.passengerSnapshot,
            feAmount: feAmount.toFixed(2),
            dealRate: deal.dealRate,
            bookingRate: deal.bookingRate,
            customerRate: item.rate ? String(item.rate) : null,
            settlementAmount: (feAmount * dealRate).toFixed(2),
            saleDate,
            settlementMode: mode,
            branchRequestedDate: freezeBranch ? saleDate : null,
            branchReference: null,
            branchRemarks: null,
            branchRequestedAt: freezeBranch ? new Date() : null,
            branchRequestedById: freezeBranch ? actorId : null,
            status:
              sellingBranch.id !== ho.id
                ? TtSettlementStatus.PENDING_HO_ACCEPTANCE
                : TtSettlementStatus.BRANCH_HO_ACCEPTED,
            createdBy: actorId,
            updatedBy: actorId,
          }),
        );
      }
      saleRows.push(row);
    }

    const frozenRows = saleRows.filter(
      (row) =>
        row.settlementMode === TtSettlementMode.AUTO && !row.branchDocumentId,
    );
    if (frozenRows.length) {
      await this.createFrozenBranchDocuments(manager, frozenRows, actorId);
    }
  }

  private async createFrozenBranchDocuments(
    manager: EntityManager,
    rows: TtSettlement[],
    actorId: string,
  ) {
    const groups = new Map<string, TtSettlement[]>();
    for (const row of rows) {
      const key = `${row.transactionId}:${row.issuerPartyProfileId}:${row.currencyId}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const itemRepo = manager.getRepository(TtSettlement);
    for (const group of groups.values()) {
      const first = group[0];
      const ho = await this.getBranch(first.hoBranchId);
      const selling = await this.getBranch(first.branchId);
      const date = this.toTimestamp(
        first.branchRequestedDate ?? first.saleDate,
        "TT settlement date is invalid",
      );
      const document = await this.createDocument(manager, {
        kind: TtSettlementDocumentKind.BRANCH_HO,
        status: TtSettlementDocumentStatus.PENDING_HO_ACCEPTANCE,
        transactionDate: date,
        numberBranch: selling,
        issuerPartyProfileId: first.issuerPartyProfileId,
        issuerPartyProfileSnapshot: first.issuerPartyProfileSnapshot,
        currencyId: first.currencyId,
        currencySnapshot: first.currencySnapshot,
        branchId: first.branchId,
        branchSnapshot: first.branchSnapshot,
        hoBranchId: first.hoBranchId,
        hoBranchSnapshot: first.hoBranchSnapshot,
        reference: null,
        remarks: null,
        actorId,
      });
      for (const row of group) {
        await itemRepo.update(row.id, {
          branchDocumentId: document.id,
          updatedBy: actorId,
        });
      }
      if (selling.id === ho.id) {
        await this.acceptBranchDocument(manager, document.id, actorId, false);
      }
    }
  }

  /**
   * Accepts branch→HO document. Status-only — no TT control account posting.
   */
  private async acceptBranchDocument(
    manager: EntityManager,
    documentId: string,
    actorId: string,
    acceptedByHo: boolean,
  ) {
    const documentRepo = manager.getRepository(TtSettlementDocument);
    const itemRepo = manager.getRepository(TtSettlement);
    const document = await documentRepo.findOne({ where: { id: documentId } });
    if (!document) throw new NotFoundException("TT settlement not found");

    const itemIds: Array<{ id: string }> = await manager.query(
      `SELECT id FROM tt_settlements WHERE deleted_at IS NULL AND branch_document_id = $1`,
      [document.id],
    );
    const items = await this.lockSettlementRows(
      manager,
      itemIds.map((row) => row.id),
    );
    if (!items.length) {
      throw new BadRequestException("TT settlement has no items");
    }

    const branch = await this.getBranch(document.branchId);
    await this.dayEndStartProcessService.assertTransactionDateAllowed(
      branch.id,
      actorId,
      document.transactionDate,
    );

    const postedIds = items.map((row) => row.id);
    await itemRepo.update(
      { id: In(postedIds) },
      {
        status: TtSettlementStatus.HO_ISSUER_PENDING,
        branchSettlementDate: document.transactionDate,
        hoAcceptedAt: acceptedByHo ? new Date() : null,
        hoAcceptedById: acceptedByHo ? actorId : null,
        updatedBy: actorId,
      },
    );
    await documentRepo.update(document.id, {
      status: TtSettlementDocumentStatus.ACCEPTED,
      acceptedAt: new Date(),
      acceptedById: actorId,
      updatedBy: actorId,
    });
  }

  async create(
    dto: CreateTtSettlementDocumentDto,
    session: AuthenticatedSession,
  ) {
    if (!session?.userId) {
      throw new ForbiddenException("User session is required");
    }
    const isHo = this.isHo(session);
    if (dto.kind === TtSettlementDocumentKind.HO_ISSUER && !isHo) {
      throw new ForbiddenException(
        "Only Admin/HO users can settle with issuers",
      );
    }
    if (dto.kind === TtSettlementDocumentKind.BRANCH_HO && isHo) {
      throw new ForbiddenException("HO creates issuer settlements only");
    }

    const id = await this.database2.transaction(async (manager) => {
      const itemRepo = manager.getRepository(TtSettlement);
      const uniqueIds = [...new Set(dto.items.map((item) => item.id))];
      if (uniqueIds.length !== dto.items.length) {
        throw new BadRequestException(
          "Duplicate TT items cannot be settled together",
        );
      }
      const rows = await this.lockSettlementRows(manager, uniqueIds);
      if (rows.length !== uniqueIds.length) {
        throw new BadRequestException("One or more TT items were not found");
      }
      const first = rows[0];
      if (
        rows.some(
          (row) =>
            row.issuerPartyProfileId !== dto.issuerPartyProfileId ||
            row.currencyId !== dto.currencyId,
        )
      ) {
        throw new BadRequestException(
          "Selected TT items must match the issuer and currency",
        );
      }
      const date = this.toTimestamp(
        dto.transactionDate,
        "Settlement date is invalid",
      );
      if (rows.some((row) => this.isCalendarBefore(date, row.saleDate))) {
        throw new BadRequestException(
          "Settlement date cannot be before the TT punch date",
        );
      }
      const reference = this.clean(dto.reference);
      const remarks = this.clean(dto.remarks);

      if (dto.kind === TtSettlementDocumentKind.BRANCH_HO) {
        const branchId = session.activeBranchId;
        if (!branchId) {
          throw new BadRequestException("Current branch is required");
        }
        if (
          rows.some(
            (row) =>
              row.branchId !== branchId ||
              row.status !== TtSettlementStatus.UNSETTLED ||
              row.settlementMode !== TtSettlementMode.MANUAL ||
              row.branchDocumentId,
          )
        ) {
          throw new BadRequestException(
            "Only unsettled MANUAL TT items for the current branch can be submitted",
          );
        }
        const document = await this.createDocument(manager, {
          kind: TtSettlementDocumentKind.BRANCH_HO,
          status: TtSettlementDocumentStatus.PENDING_HO_ACCEPTANCE,
          transactionDate: date,
          numberBranch: await this.getBranch(first.branchId),
          issuerPartyProfileId: first.issuerPartyProfileId,
          issuerPartyProfileSnapshot: first.issuerPartyProfileSnapshot,
          currencyId: first.currencyId,
          currencySnapshot: first.currencySnapshot,
          branchId: first.branchId,
          branchSnapshot: first.branchSnapshot,
          hoBranchId: first.hoBranchId,
          hoBranchSnapshot: first.hoBranchSnapshot,
          reference,
          remarks,
          actorId: session.userId,
        });
        for (const row of rows) {
          const dealRate = Number(row.dealRate);
          await itemRepo.update(row.id, {
            settlementAmount: this.amountFrom(row.feAmount, dealRate),
            branchRequestedDate: date,
            branchReference: reference,
            branchRemarks: remarks,
            branchRequestedAt: new Date(),
            branchRequestedById: session.userId,
            status: TtSettlementStatus.PENDING_HO_ACCEPTANCE,
            hoRejectedAt: null,
            hoRejectedById: null,
            hoRejectionReason: null,
            branchDocumentId: document.id,
            updatedBy: session.userId,
          });
        }
        return document.id;
      }

      if (
        rows.some(
          (row) =>
            row.status !== TtSettlementStatus.HO_ISSUER_PENDING ||
            !row.branchSettlementDate ||
            row.issuerDocumentId,
        )
      ) {
        throw new BadRequestException(
          "Only branch-settled TT items can be settled with issuers",
        );
      }
      if (!dto.hoBranchId) {
        throw new BadRequestException("HO branch is required");
      }
      const ho = await this.getBranch(dto.hoBranchId);
      if (!ho.isHeadOffice) {
        throw new BadRequestException(
          "Issuer settlement must use an HO branch",
        );
      }
      if (rows.some((row) => row.hoBranchId !== ho.id)) {
        throw new BadRequestException(
          "Selected TT items must belong to the selected HO branch",
        );
      }
      if (
        rows.some((row) =>
          this.isCalendarBefore(date, row.branchSettlementDate ?? row.saleDate),
        )
      ) {
        throw new BadRequestException(
          "Issuer settlement date cannot be before the branch settlement date",
        );
      }

      const rates = new Map(
        dto.items.map((item) => {
          if (!item.rate) {
            throw new BadRequestException(
              "Issuer settlement rate is required for each item",
            );
          }
          return [
            item.id,
            this.parseRate(item.rate, "Settlement rate must be greater than zero"),
          ];
        }),
      );

      const document = await this.createDocument(manager, {
        kind: TtSettlementDocumentKind.HO_ISSUER,
        status: TtSettlementDocumentStatus.POSTED,
        transactionDate: date,
        numberBranch: ho,
        issuerPartyProfileId: first.issuerPartyProfileId,
        issuerPartyProfileSnapshot: first.issuerPartyProfileSnapshot,
        currencyId: first.currencyId,
        currencySnapshot: first.currencySnapshot,
        branchId: ho.id,
        branchSnapshot: {
          id: ho.id,
          code: ho.code,
          name: ho.name,
          label: `${ho.code} - ${ho.name}`,
        },
        hoBranchId: ho.id,
        hoBranchSnapshot: {
          id: ho.id,
          code: ho.code,
          name: ho.name,
          label: `${ho.code} - ${ho.name}`,
        },
        reference,
        remarks,
        actorId: session.userId,
      });

      for (const row of rows) {
        const rate = rates.get(row.id) ?? 0;
        const issuerAmount = this.amountFrom(row.feAmount, rate);
        const branchAmount = Number(row.settlementAmount);
        await itemRepo.update(row.id, {
          issuerRate: rate.toFixed(7),
          issuerSettlementAmount: issuerAmount,
          profitAmount: (branchAmount - Number(issuerAmount)).toFixed(2),
          issuerDocumentId: document.id,
          issuerSettlementDate: date,
          issuerReference: reference,
          issuerRemarks: remarks,
          status: TtSettlementStatus.SETTLED,
          updatedBy: session.userId,
        });
      }
      return document.id;
    });

    return this.get(id, session);
  }

  private documentListWhere(
    query: TtSettlementDocumentQueryDto,
    session: AuthenticatedSession,
  ): { conditions: string[]; params: unknown[] } | { empty: true } {
    const conditions = ["d.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (!this.isHo(session)) {
      if (!session.activeBranchId) return { empty: true };
      params.push(session.activeBranchId);
      conditions.push(`d.branch_id = $${params.length}`);
    } else if (query.branchId) {
      params.push(query.branchId);
      conditions.push(`d.branch_id = $${params.length}`);
    }
    if (query.status?.length) {
      params.push(query.status);
      conditions.push(`d.status = ANY($${params.length})`);
    }
    if (query.kind) {
      params.push(query.kind);
      conditions.push(`d.kind = $${params.length}`);
    }
    if (query.issuerPartyProfileId) {
      params.push(query.issuerPartyProfileId);
      conditions.push(`d.issuer_party_profile_id = $${params.length}`);
    }
    if (query.currencyId) {
      params.push(query.currencyId);
      conditions.push(`d.currency_id = $${params.length}`);
    }
    if (query.dateFrom) {
      params.push(toUtcDateOnly(query.dateFrom));
      conditions.push(`d.transaction_date >= $${params.length}`);
    }
    if (query.dateTo) {
      params.push(toUtcDateOnly(query.dateTo));
      conditions.push(`d.transaction_date < ($${params.length}::date + 1)`);
    }
    if (query.search?.trim()) {
      params.push(`%${query.search.trim()}%`);
      conditions.push(
        `(d.transaction_number ILIKE $${params.length} OR d.reference ILIKE $${params.length} OR d.remarks ILIKE $${params.length})`,
      );
    }
    return { conditions, params };
  }

  private documentSelectSql() {
    return `SELECT d.id, d.transaction_number AS "transactionNumber", d.transaction_date AS "transactionDate",
      d.kind, d.status, d.issuer_party_profile_id AS "issuerPartyProfileId",
      d.issuer_party_profile_snapshot AS "issuerPartyProfileSnapshot",
      d.currency_id AS "currencyId", d.currency_snapshot AS "currencySnapshot",
      d.branch_id AS "branchId", d.branch_snapshot AS "branchSnapshot",
      d.ho_branch_id AS "hoBranchId", d.ho_branch_snapshot AS "hoBranchSnapshot",
      d.reference, d.remarks, d.rejection_reason AS "rejectionReason",
      d.cancellation_reason AS "cancellationReason",
      d.accepted_at AS "acceptedAt", d.accepted_by_id AS "acceptedById",
      d.rejected_at AS "rejectedAt", d.rejected_by_id AS "rejectedById",
      d.cancelled_at AS "cancelledAt", d.cancelled_by_id AS "cancelledById",
      d.posting_transaction_id AS "postingTransactionId",
      d.created_at AS "createdAt", d.updated_at AS "updatedAt"
     FROM tt_settlement_documents d`;
  }

  async list(
    query: TtSettlementDocumentQueryDto,
    session: AuthenticatedSession,
  ) {
    const pagination = normalizePagination(query);
    const where = this.documentListWhere(query, session);
    if ("empty" in where) return buildPaginatedResponse([], 0, pagination);
    const countRows = await this.database2.query(
      `SELECT COUNT(*)::int AS total FROM tt_settlement_documents d WHERE ${where.conditions.join(" AND ")}`,
      where.params,
    );
    const total = Number(countRows[0]?.total ?? 0);
    const data = await this.database2.query(
      `${this.documentSelectSql()} WHERE ${where.conditions.join(" AND ")} ORDER BY d.transaction_date DESC, d.created_at DESC LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
      [...where.params, pagination.limit, pagination.offset],
    );
    return buildPaginatedResponse(data, total, pagination);
  }

  async listUnsettled(
    query: TtSettlementUnsettledQueryDto,
    session: AuthenticatedSession,
  ) {
    const pagination = normalizePagination(query);
    const params: unknown[] = [
      query.issuerPartyProfileId,
      query.currencyId,
    ];
    const conditions = [
      "s.deleted_at IS NULL",
      "s.issuer_party_profile_id = $1",
      "s.currency_id = $2",
    ];

    if (query.kind === TtSettlementDocumentKind.BRANCH_HO) {
      const branchId = this.isHo(session)
        ? query.branchId
        : session.activeBranchId;
      if (!branchId) return buildPaginatedResponse([], 0, pagination);
      params.push(branchId);
      conditions.push(`s.branch_id = $${params.length}`);
      conditions.push(`s.status = '${TtSettlementStatus.UNSETTLED}'`);
      conditions.push(`s.branch_document_id IS NULL`);
    } else {
      this.assertHo(session);
      conditions.push(`s.status = '${TtSettlementStatus.HO_ISSUER_PENDING}'`);
      conditions.push(`s.issuer_document_id IS NULL`);
      if (query.hoBranchId) {
        params.push(query.hoBranchId);
        conditions.push(`s.ho_branch_id = $${params.length}`);
      }
    }

    const countRows = await this.database2.query(
      `SELECT COUNT(*)::int AS total FROM tt_settlements s WHERE ${conditions.join(" AND ")}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);
    const data = await this.database2.query(
      `SELECT s.id, s.deal_cover_id AS "dealCoverId", s.fe_amount AS "feAmount",
        s.deal_rate AS "dealRate", s.booking_rate AS "bookingRate",
        s.customer_rate AS "customerRate", s.settlement_amount AS "settlementAmount",
        s.status, s.sale_date AS "saleDate",
        s.branch_id AS "branchId", s.branch_snapshot AS "branchSnapshot",
        s.product_id AS "productId", s.product_snapshot AS "productSnapshot",
        s.currency_id AS "currencyId", s.currency_snapshot AS "currencySnapshot"
       FROM tt_settlements s
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.sale_date DESC, s.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pagination.limit, pagination.offset],
    );
    return buildPaginatedResponse(data, total, pagination);
  }

  async get(id: string, session: AuthenticatedSession) {
    const where = this.documentListWhere({}, session);
    if ("empty" in where) {
      throw new NotFoundException("TT settlement not found");
    }
    where.params.push(id);
    where.conditions.push(`d.id = $${where.params.length}`);
    const documents = await this.database2.query(
      `${this.documentSelectSql()} WHERE ${where.conditions.join(" AND ")}`,
      where.params,
    );
    const document = documents[0];
    if (!document) throw new NotFoundException("TT settlement not found");
    const items = await this.database2.query(
      `SELECT s.id, s.deal_cover_id AS "dealCoverId", s.fe_amount AS "feAmount",
        s.deal_rate AS "dealRate", s.booking_rate AS "bookingRate",
        s.customer_rate AS "customerRate", s.settlement_amount AS "settlementAmount",
        s.issuer_rate AS "issuerRate",
        s.issuer_settlement_amount AS "issuerSettlementAmount",
        s.profit_amount AS "profitAmount", s.status,
        s.branch_id AS "branchId", s.branch_snapshot AS "branchSnapshot",
        s.product_id AS "productId", s.product_snapshot AS "productSnapshot"
       FROM tt_settlements s
       WHERE s.deleted_at IS NULL
         AND ((s.branch_document_id=$1 AND $2='BRANCH_HO')
           OR (s.issuer_document_id=$1 AND $2='HO_ISSUER'))
       ORDER BY s.created_at`,
      [id, document.kind],
    );
    return { ...document, items };
  }

  async accept(id: string, session: AuthenticatedSession) {
    this.assertHo(session);
    await this.database2.transaction(async (manager) => {
      const documentRepo = manager.getRepository(TtSettlementDocument);
      const document = await documentRepo
        .createQueryBuilder("d")
        .where("d.id = :id", { id })
        .setLock("pessimistic_write")
        .getOne();
      if (!document) throw new NotFoundException("TT settlement not found");
      if (
        document.kind !== TtSettlementDocumentKind.BRANCH_HO ||
        document.status !== TtSettlementDocumentStatus.PENDING_HO_ACCEPTANCE
      ) {
        throw new BadRequestException(
          "Only pending HO acceptance settlements can be accepted",
        );
      }
      await this.acceptBranchDocument(manager, document.id, session.userId!, true);
    });
    return this.get(id, session);
  }

  async reject(
    id: string,
    dto: RejectTtSettlementDocumentDto,
    session: AuthenticatedSession,
  ) {
    this.assertHo(session);
    await this.database2.transaction(async (manager) => {
      const documentRepo = manager.getRepository(TtSettlementDocument);
      const itemRepo = manager.getRepository(TtSettlement);
      const document = await documentRepo
        .createQueryBuilder("d")
        .where("d.id = :id", { id })
        .setLock("pessimistic_write")
        .getOne();
      if (!document) throw new NotFoundException("TT settlement not found");
      if (
        document.kind !== TtSettlementDocumentKind.BRANCH_HO ||
        document.status !== TtSettlementDocumentStatus.PENDING_HO_ACCEPTANCE
      ) {
        throw new BadRequestException(
          "Only pending HO acceptance settlements can be rejected",
        );
      }
      const itemIds: Array<{ id: string }> = await manager.query(
        `SELECT id FROM tt_settlements WHERE deleted_at IS NULL AND branch_document_id = $1`,
        [document.id],
      );
      const items = await this.lockSettlementRows(
        manager,
        itemIds.map((row) => row.id),
      );
      for (const row of items) {
        await itemRepo.update(row.id, {
          branchDocumentId: null,
          settlementAmount: this.amountFrom(row.feAmount, Number(row.dealRate)),
          branchRequestedDate: null,
          branchReference: null,
          branchRemarks: null,
          branchRequestedAt: null,
          branchRequestedById: null,
          settlementMode: TtSettlementMode.MANUAL,
          status: TtSettlementStatus.UNSETTLED,
          hoRejectedAt: new Date(),
          hoRejectedById: session.userId,
          hoRejectionReason: dto.reason.trim(),
          updatedBy: session.userId,
        });
      }
      await documentRepo.update(document.id, {
        status: TtSettlementDocumentStatus.REJECTED,
        rejectionReason: dto.reason.trim(),
        rejectedAt: new Date(),
        rejectedById: session.userId,
        updatedBy: session.userId,
      });
    });
    return this.get(id, session);
  }

  async cancel(
    id: string,
    dto: CancelTtSettlementDocumentDto,
    session: AuthenticatedSession,
  ) {
    if (!session?.userId) {
      throw new ForbiddenException("User session is required");
    }
    await this.database2.transaction(async (manager) => {
      const documentRepo = manager.getRepository(TtSettlementDocument);
      const itemRepo = manager.getRepository(TtSettlement);
      const document = await documentRepo
        .createQueryBuilder("d")
        .where("d.id = :id", { id })
        .setLock("pessimistic_write")
        .getOne();
      if (!document) throw new NotFoundException("TT settlement not found");
      if (
        document.status !== TtSettlementDocumentStatus.PENDING_HO_ACCEPTANCE ||
        document.kind !== TtSettlementDocumentKind.BRANCH_HO
      ) {
        throw new BadRequestException(
          "Only unposted branch settlements can be cancelled",
        );
      }
      if (!this.isHo(session) && document.branchId !== session.activeBranchId) {
        throw new ForbiddenException(
          "Settlement must belong to the current branch",
        );
      }
      const itemIds: Array<{ id: string }> = await manager.query(
        `SELECT id FROM tt_settlements WHERE deleted_at IS NULL AND branch_document_id = $1`,
        [document.id],
      );
      const items = await this.lockSettlementRows(
        manager,
        itemIds.map((row) => row.id),
      );
      for (const row of items) {
        await itemRepo.update(row.id, {
          branchDocumentId: null,
          settlementAmount: this.amountFrom(row.feAmount, Number(row.dealRate)),
          branchRequestedDate: null,
          branchReference: null,
          branchRemarks: null,
          branchRequestedAt: null,
          branchRequestedById: null,
          settlementMode: TtSettlementMode.MANUAL,
          status: TtSettlementStatus.UNSETTLED,
          updatedBy: session.userId,
        });
      }
      await documentRepo.update(document.id, {
        status: TtSettlementDocumentStatus.CANCELLED,
        cancellationReason: dto.reason.trim(),
        cancelledAt: new Date(),
        cancelledById: session.userId,
        updatedBy: session.userId,
      });
    });
    return this.get(id, session);
  }
}
