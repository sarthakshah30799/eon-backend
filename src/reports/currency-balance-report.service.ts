import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as XLSX from "xlsx";
import { TransactionBalanceCurrency } from "../transactions/entities/transaction-balance-currency.entity";
import { TradeMode } from "../transactions/transactions.enums";
import { resolveCurrencyBalanceTradeMode } from "../transactions/transaction-balance-profile.util";
import {
  CurrencyBalanceReportFormat,
  CurrencyBalanceReportQueryDto,
} from "./dto/currency-balance-report-query.dto";

type ReportColumn = {
  key: string;
  label: string;
};

type ReportRow = {
  date: string;
  branch: string;
  counter: string;
  opening: string;
  purchaseBulk: string;
  purchaseRetail: string;
  sellBulk: string;
  sellRetail: string;
  closing: string;
  sortDate: string;
  sortBranch: string;
  sortCounter: string;
};

type ResolvedFilters = {
  startDate: Date | null;
  endDate: Date | null;
  branchIds: string[];
  counterIds: string[];
  currencyIds: string[];
};

const COLUMNS: ReportColumn[] = [
  { key: "date", label: "Date" },
  { key: "branch", label: "Branch" },
  { key: "counter", label: "Counter" },
  { key: "opening", label: "Opening (Rs)" },
  { key: "purchaseBulk", label: "Purchase Bulk (Rs)" },
  { key: "purchaseRetail", label: "Purchase Retail (Rs)" },
  { key: "sellBulk", label: "Sell Bulk (Rs)" },
  { key: "sellRetail", label: "Sell Retail (Rs)" },
  { key: "closing", label: "Closing (Rs)" },
];

const toText = (value: unknown) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};

const formatNumber = (value: number | string | null | undefined, scale = 7) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return (0).toFixed(scale);
  }

  return parsed.toFixed(scale);
};

const formatDateKey = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
};

const getSnapshotLabel = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) {
    return "";
  }

  const code = toText(snapshot.code);
  const name = toText(snapshot.name);
  const label = toText(snapshot.label);

  if (code && name) {
    return `${code} - ${name}`;
  }

  return label || name || code;
};

const buildWorkbook = (columns: ReportColumn[], rows: ReportRow[]) => {
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) =>
      columns.reduce<Record<string, string>>((acc, column) => {
        acc[column.label] = row[column.key as keyof ReportRow] ?? "";
        return acc;
      }, {}),
    ),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Currency Balance");
  return workbook;
};

@Injectable()
export class CurrencyBalanceReportService {
  constructor(
    @InjectRepository(TransactionBalanceCurrency, "database2")
    private readonly transactionBalanceCurrencyRepository: Repository<TransactionBalanceCurrency>,
  ) {}

  private resolveFilters(
    query: CurrencyBalanceReportQueryDto,
  ): ResolvedFilters {
    const startDate = query.startDate ? new Date(query.startDate) : null;
    const endDate = query.endDate ? new Date(query.endDate) : null;

    if (startDate && Number.isNaN(startDate.getTime())) {
      throw new BadRequestException("Invalid start date");
    }

    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new BadRequestException("Invalid end date");
    }

    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException("Start date cannot be after end date");
    }

    return {
      startDate,
      endDate,
      branchIds: query.branchIds ?? [],
      counterIds: query.counterIds ?? [],
      currencyIds: query.currencyIds ?? [],
    };
  }

  private async loadRows(filters: ResolvedFilters) {
    const qb = this.transactionBalanceCurrencyRepository
      .createQueryBuilder("balance")
      .where("balance.deletedAt IS NULL");

    if (filters.startDate) {
      qb.andWhere("balance.date >= :startDate", {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      qb.andWhere("balance.date <= :endDate", {
        endDate: new Date(filters.endDate.getTime() + 24 * 60 * 60 * 1000 - 1),
      });
    }

    if (filters.branchIds.length > 0) {
      qb.andWhere("balance.branchId IN (:...branchIds)", {
        branchIds: filters.branchIds,
      });
    }

    if (filters.counterIds.length > 0) {
      qb.andWhere("balance.counterId IN (:...counterIds)", {
        counterIds: filters.counterIds,
      });
    }

    if (filters.currencyIds.length > 0) {
      qb.andWhere("balance.currencyId IN (:...currencyIds)", {
        currencyIds: filters.currencyIds,
      });
    }

    return qb
      .orderBy("balance.date", "ASC")
      .addOrderBy("balance.branchId", "ASC")
      .addOrderBy("balance.counterId", "ASC")
      .addOrderBy("balance.currencyId", "ASC")
      .addOrderBy("balance.profileType", "ASC")
      .addOrderBy("balance.createdAt", "ASC")
      .getMany();
  }

  buildReport(query: CurrencyBalanceReportQueryDto) {
    return this.build(query);
  }

  async buildExport(
    query: CurrencyBalanceReportQueryDto,
    format: CurrencyBalanceReportFormat,
  ) {
    const report = await this.build(query);
    const workbook = buildWorkbook(report.columns, report.rows);

    if (format === CurrencyBalanceReportFormat.CSV) {
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      return {
        contentType: "text/csv",
        filename: "currency-balance-report.csv",
        buffer: Buffer.from(csv, "utf8"),
      };
    }

    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    }) as Buffer;
    return {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "currency-balance-report.xlsx",
      buffer,
    };
  }

  private async build(query: CurrencyBalanceReportQueryDto) {
    const filters = this.resolveFilters(query);
    const rows = await this.loadRows(filters);

    type ChainState = {
      runningRs: number;
      currentDateKey: string | null;
      currentRow: ReportRow | null;
    };

    const chainStates = new Map<string, ChainState>();
    const reportRows: ReportRow[] = [];

    const finalizeCurrent = (state: ChainState) => {
      if (state.currentRow) {
        state.currentRow.closing = formatNumber(state.runningRs, 2);
        reportRows.push(state.currentRow);
      }
      state.currentRow = null;
      state.currentDateKey = null;
    };

    for (const balanceRow of rows) {
      const chainKey = `${balanceRow.branchId}:${balanceRow.counterId}`;
      const state =
        chainStates.get(chainKey) ??
        ({
          runningRs: 0,
          currentDateKey: null,
          currentRow: null,
        } as ChainState);

      if (!chainStates.has(chainKey)) {
        chainStates.set(chainKey, state);
      }

      const dateKey = formatDateKey(balanceRow.date);
      const mode = resolveCurrencyBalanceTradeMode(balanceRow.profileType);
      const purchase = Number(balanceRow.purchaseRs ?? 0);
      const sell = Number(balanceRow.sellRs ?? 0);

      if (state.currentDateKey !== dateKey) {
        finalizeCurrent(state);
        state.currentDateKey = dateKey;
        state.currentRow = {
          date: formatDateLabel(balanceRow.date),
          branch: getSnapshotLabel(balanceRow.branchSnapshot),
          counter: getSnapshotLabel(balanceRow.counterSnapshot),
          opening: formatNumber(state.runningRs, 2),
          purchaseBulk: formatNumber(0, 2),
          purchaseRetail: formatNumber(0, 2),
          sellBulk: formatNumber(0, 2),
          sellRetail: formatNumber(0, 2),
          closing: formatNumber(state.runningRs, 2),
          sortDate: dateKey,
          sortBranch: getSnapshotLabel(balanceRow.branchSnapshot),
          sortCounter: getSnapshotLabel(balanceRow.counterSnapshot),
        };
      }

      if (!state.currentRow) {
        continue;
      }

      if (mode === TradeMode.RETAIL) {
        state.currentRow.purchaseRetail = formatNumber(
          Number(state.currentRow.purchaseRetail) + purchase,
          2,
        );
        state.currentRow.sellRetail = formatNumber(
          Number(state.currentRow.sellRetail) + sell,
          2,
        );
      } else {
        state.currentRow.purchaseBulk = formatNumber(
          Number(state.currentRow.purchaseBulk) + purchase,
          2,
        );
        state.currentRow.sellBulk = formatNumber(
          Number(state.currentRow.sellBulk) + sell,
          2,
        );
      }

      state.runningRs = Number(
        formatNumber(state.runningRs + purchase - sell, 2),
      );
      state.currentRow.closing = formatNumber(state.runningRs, 2);
    }

    for (const state of chainStates.values()) {
      finalizeCurrent(state);
    }

    reportRows.sort((left, right) => {
      if (left.sortDate !== right.sortDate) {
        return left.sortDate.localeCompare(right.sortDate);
      }
      if (left.sortBranch !== right.sortBranch) {
        return left.sortBranch.localeCompare(right.sortBranch);
      }
      return left.sortCounter.localeCompare(right.sortCounter);
    });

    return {
      columns: COLUMNS,
      rows: reportRows,
    };
  }
}
