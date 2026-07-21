import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionItem } from "../transactions/entities/transaction-item.entity";
import { PartyProfile } from "../party-profiles/party-profile.entity";
import { ChequeBook } from "../chequebooks/entities/cheque-book.entity";
import { ManualBook } from "../manual-bill-books/entities/manual-book.entity";
import { WorkflowStatus } from "../common/enums/workflow-status.enum";
import {
  DashboardStatsDto,
  VolumeByCurrencyDto,
  VolumeDataPointDto,
  RecentTransactionDto,
  PendingApprovalDto,
} from "./dto/dashboard.dto";

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction, "database2")
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionItem, "database2")
    private readonly transactionItemRepository: Repository<TransactionItem>,
    @InjectRepository(PartyProfile)
    private readonly partyProfileRepository: Repository<PartyProfile>,
    @InjectRepository(ChequeBook, "database2")
    private readonly chequeBookRepository: Repository<ChequeBook>,
    @InjectRepository(ManualBook, "database2")
    private readonly manualBookRepository: Repository<ManualBook>,
  ) {}

  private dateRange(key: string): { from: Date; to: Date } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const day = now.getDay();

    switch (key) {
      case "today": {
        const from = new Date(y, m, d);
        const to = new Date(y, m, d, 23, 59, 59, 999);
        return { from, to };
      }
      case "yesterday": {
        const from = new Date(y, m, d - 1);
        const to = new Date(y, m, d - 1, 23, 59, 59, 999);
        return { from, to };
      }
      case "current_week": {
        const diff = day === 0 ? 6 : day - 1;
        const from = new Date(y, m, d - diff);
        const to = new Date(y, m, d, 23, 59, 59, 999);
        return { from, to };
      }
      case "last_week": {
        const diff = day === 0 ? 6 : day - 1;
        const from = new Date(y, m, d - diff - 7);
        const to = new Date(y, m, d - diff - 1, 23, 59, 59, 999);
        return { from, to };
      }
      case "current_month": {
        const from = new Date(y, m, 1);
        const to = new Date(y, m, d, 23, 59, 59, 999);
        return { from, to };
      }
      case "last_month": {
        const from = new Date(y, m - 1, 1);
        const to = new Date(y, m, 0, 23, 59, 59, 999);
        return { from, to };
      }
      default:
        return this.dateRange("today");
    }
  }

  private branchFilter(qb: any, branchId?: string, isAdminOrHo?: boolean) {
    if (branchId && !isAdminOrHo) {
      qb.andWhere("t.branchId = :branchId", { branchId });
    }
    return qb;
  }

  async getStats(
    branchId?: string,
    isAdminOrHo?: boolean,
  ): Promise<DashboardStatsDto> {
    const today = this.dateRange("today");
    const yesterday = this.dateRange("yesterday");

    const todayVol = await this.volumeBetween(today.from, today.to, branchId, isAdminOrHo);
    const yesterdayVol = await this.volumeBetween(yesterday.from, yesterday.to, branchId, isAdminOrHo);
    const todayCount = await this.txnCountBetween(today.from, today.to, branchId, isAdminOrHo);
    const yesterdayCount = await this.txnCountBetween(yesterday.from, yesterday.to, branchId, isAdminOrHo);

    const pendingTxns = await this.transactionRepository
      .createQueryBuilder("t")
      .where("t.isLatest = true")
      .andWhere("t.status = 'PENDING'")
      .getCount();

    const pendingPP = await this.partyProfileRepository.count({
      where: { status: WorkflowStatus.PENDING },
    });

    const pendingQB = this.chequeBookRepository
      .createQueryBuilder("t")
      .where("t.status = :status", { status: WorkflowStatus.PENDING });
    this.branchFilter(pendingQB, branchId, isAdminOrHo);
    const pendingChequeBooks = await pendingQB.getCount();

    const pendingMB = this.manualBookRepository
      .createQueryBuilder("t")
      .where("t.status = :status", { status: WorkflowStatus.PENDING });
    this.branchFilter(pendingMB, branchId, isAdminOrHo);
    const pendingManualBooks = await pendingMB.getCount();

    const flaggedTxns = await this.transactionRepository
      .createQueryBuilder("t")
      .where("t.isLatest = true")
      .andWhere("t.status = 'PENDING'")
      .andWhere("t.approvedAt IS NULL")
      .getCount();

    return {
      todayVolume: todayVol.toFixed(2),
      yesterdayVolume: yesterdayVol.toFixed(2),
      todayTransactionCount: todayCount,
      yesterdayTransactionCount: yesterdayCount,
      pendingApprovals: pendingTxns + pendingPP + pendingChequeBooks + pendingManualBooks,
      pendingPartyProfileReviews: pendingPP,
      pendingTransactions: pendingTxns,
      pendingChequeBooks,
      pendingManualBooks,
      activeAlerts: flaggedTxns,
    };
  }

  private async volumeBetween(
    from: Date,
    to: Date,
    branchId?: string,
    isAdminOrHo?: boolean,
  ): Promise<number> {
    const qb = this.transactionRepository
      .createQueryBuilder("t")
      .select("COALESCE(SUM(ti.quantity * ti.rate), 0)", "vol")
      .innerJoin("t.items", "ti")
      .where("t.isLatest = true")
      .andWhere("t.status = 'APPROVED'")
      .andWhere("t.approvedAt >= :from", { from })
      .andWhere("t.approvedAt <= :to", { to });

    this.branchFilter(qb, branchId, isAdminOrHo);
    const row = await qb.getRawOne();
    return Number(row?.vol ?? 0);
  }

  private async txnCountBetween(
    from: Date,
    to: Date,
    branchId?: string,
    isAdminOrHo?: boolean,
  ): Promise<number> {
    const qb = this.transactionRepository
      .createQueryBuilder("t")
      .where("t.isLatest = true")
      .andWhere("t.status = 'APPROVED'")
      .andWhere("t.approvedAt >= :from", { from })
      .andWhere("t.approvedAt <= :to", { to });

    this.branchFilter(qb, branchId, isAdminOrHo);
    return qb.getCount();
  }

  async getVolumeByCurrency(
    branchId?: string,
    isAdminOrHo?: boolean,
  ): Promise<VolumeByCurrencyDto[]> {
    const today = this.dateRange("today");
    const yesterday = this.dateRange("yesterday");

    const raw = await this.transactionRepository
      .createQueryBuilder("t")
      .select([
        `ti.currencySnapshot->>'currencyCode' as currency_code`,
        `ti.currencyId as currency_id`,
        `DATE(t.approvedAt) as vol_date`,
        `COALESCE(SUM(ti.quantity * ti.rate), 0) as volume`,
      ])
      .innerJoin("t.items", "ti")
      .where("t.isLatest = true")
      .andWhere("t.status = 'APPROVED'")
      .andWhere("t.approvedAt >= :from", { from: yesterday.from })
      .groupBy("ti.currencySnapshot->>'currencyCode'")
      .addGroupBy("ti.currencyId")
      .addGroupBy("DATE(t.approvedAt)")
      .getRawMany();

    const todayStr = today.from.toISOString().split("T")[0];
    const yesterdayStr = yesterday.from.toISOString().split("T")[0];

    const todayMap: Record<string, { vol: number; id: string; code: string }> = {};
    const yesterdayMap: Record<string, { vol: number; id: string; code: string }> = {};

    for (const row of raw) {
      const dateStr = String(row.vol_date).split("T")[0];
      const key = row.currency_code ?? row.currency_id;
      const vol = Number(row.volume ?? 0);
      const entry = { vol, id: row.currency_id, code: row.currency_code };
      if (dateStr === todayStr) todayMap[key] = entry;
      else if (dateStr === yesterdayStr) yesterdayMap[key] = entry;
    }

    const allKeys = new Set([...Object.keys(todayMap), ...Object.keys(yesterdayMap)]);
    const result: VolumeByCurrencyDto[] = [];

    for (const key of allKeys) {
      const tV = todayMap[key]?.vol ?? 0;
      const yV = yesterdayMap[key]?.vol ?? 0;
      const changePct = yV > 0 ? (((tV - yV) / yV) * 100).toFixed(1) : tV > 0 ? "100" : "0";
      result.push({
        currencyId: todayMap[key]?.id ?? yesterdayMap[key]?.id ?? key,
        currencyCode: todayMap[key]?.code ?? yesterdayMap[key]?.code ?? key,
        todayVolume: tV.toFixed(2),
        yesterdayVolume: yV.toFixed(2),
        changePercent: changePct,
        products: [],
      });
    }

    return result;
  }

  async getVolumeChart(
    days: number = 7,
    branchId?: string,
    isAdminOrHo?: boolean,
  ): Promise<VolumeDataPointDto[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const qb = this.transactionRepository
      .createQueryBuilder("t")
      .select("DATE(t.approvedAt)", "date")
      .addSelect("t.transactionType", "transactionType")
      .addSelect("COALESCE(SUM(ti.quantity * ti.rate), 0)", "volume")
      .innerJoin("t.items", "ti")
      .where("t.isLatest = true")
      .andWhere("t.status = 'APPROVED'")
      .andWhere("t.approvedAt >= :since", { since })
      .groupBy("DATE(t.approvedAt)")
      .addGroupBy("t.transactionType")
      .orderBy("DATE(t.approvedAt)", "ASC");

    this.branchFilter(qb, branchId, isAdminOrHo);
    const rows = await qb.getRawMany();

    const map: Record<string, VolumeDataPointDto> = {};
    for (const row of rows) {
      const dateStr =
        row.date instanceof Date
          ? row.date.toISOString().split("T")[0]
          : String(row.date).split("T")[0];
      if (!map[dateStr]) {
        map[dateStr] = { date: dateStr, saleVolume: "0", purchaseVolume: "0" };
      }
      if (row.transactionType === "SALE") {
        map[dateStr].saleVolume = Number(row.volume ?? 0).toFixed(2);
      } else {
        map[dateStr].purchaseVolume = Number(row.volume ?? 0).toFixed(2);
      }
    }

    const result: VolumeDataPointDto[] = [];
    const cursor = new Date(since);
    const stop = new Date();
    while (cursor <= stop) {
      const key = cursor.toISOString().split("T")[0];
      result.push(map[key] || { date: key, saleVolume: "0", purchaseVolume: "0" });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  async getRecentTransactions(
    limit: number = 10,
    branchId?: string,
    isAdminOrHo?: boolean,
  ): Promise<RecentTransactionDto[]> {
    const qb = this.transactionRepository
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.items", "ti")
      .where("t.isLatest = true")
      .orderBy("t.createdAt", "DESC")
      .take(limit);

    this.branchFilter(qb, branchId, isAdminOrHo);
    const transactions = await qb.getMany();

    return transactions.map((t) => {
      const partySnapshot = t.partyProfileSnapshot as Record<string, string> | null;
      const branchSnapshot = t.branchSnapshot as Record<string, string> | null;
      const items = (t as any).items ?? [];
      const firstItem = items[0];
      const currencySnap = firstItem?.currencySnapshot as Record<string, string> | null;
      const productSnap = firstItem?.productSnapshot as Record<string, string> | null;
      const fcyAmount = items.reduce(
        (s: number, it: any) => s + Number(it.quantity) * Number(it.rate),
        0,
      );

      return {
        id: t.id,
        number: t.number ?? "",
        partyName: partySnapshot?.name ?? partySnapshot?.label ?? "",
        currencyCode: currencySnap?.currencyCode ?? "",
        productCode: productSnap?.code ?? productSnap?.productCode ?? "",
        transactionType: t.transactionType,
        fcyAmount: fcyAmount.toFixed(2),
        lcyAmount: fcyAmount.toFixed(2),
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      };
    });
  }

  async getPendingApprovals(
    userId: string,
    isAdminOrHo: boolean,
    branchId?: string,
    limit: number = 20,
  ): Promise<PendingApprovalDto[]> {
    const results: PendingApprovalDto[] = [];

    if (isAdminOrHo) {
      const partyProfiles = await this.partyProfileRepository.find({
        where: { status: WorkflowStatus.PENDING },
        order: { createdAt: "ASC" },
        take: limit,
      });
      for (const p of partyProfiles) {
        results.push({
          id: p.id,
          entityType: "party-profile",
          code: p.code,
          name: p.type ?? "",
          type: p.type ?? "",
          subType: p.type,
          createdAt: p.createdAt.toISOString(),
        });
      }

      const transactions = await this.transactionRepository
        .createQueryBuilder("t")
        .where("t.isLatest = true")
        .andWhere("t.status = 'PENDING'")
        .orderBy("t.createdAt", "ASC")
        .take(limit)
        .getMany();
      for (const t of transactions) {
        const partySnap = t.partyProfileSnapshot as Record<string, string> | null;
        results.push({
          id: t.id,
          entityType: "transaction",
          code: t.number ?? t.id.slice(0, 8),
          name: partySnap?.name ?? partySnap?.label ?? "",
          type: t.transactionType,
          createdAt: t.createdAt.toISOString(),
        });
      }
    }

    const chequeQB = this.chequeBookRepository
      .createQueryBuilder("t")
      .where("t.status = :status", { status: WorkflowStatus.PENDING })
      .orderBy("t.createdAt", "ASC")
      .take(limit);
    if (!isAdminOrHo && branchId) {
      chequeQB.andWhere("t.branchId = :branchId", { branchId });
    }
    const chequeBooks = await chequeQB.getMany();
    for (const cb of chequeBooks) {
      results.push({
        id: cb.id,
        entityType: "chequebook",
        code: cb.no,
        name: cb.no,
        type: "chequebook",
        createdAt: cb.createdAt.toISOString(),
      });
    }

    const manualQB = this.manualBookRepository
      .createQueryBuilder("t")
      .where("t.status = :status", { status: WorkflowStatus.PENDING })
      .orderBy("t.createdAt", "ASC")
      .take(limit);
    if (!isAdminOrHo && branchId) {
      manualQB.andWhere("t.branchId = :branchId", { branchId });
    }
    const manualBooks = await manualQB.getMany();
    for (const mb of manualBooks) {
      results.push({
        id: mb.id,
        entityType: "manual-book",
        code: mb.no,
        name: mb.no,
        type: "manual-book",
        createdAt: mb.createdAt.toISOString(),
      });
    }

    results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return results.slice(0, limit);
  }
}
