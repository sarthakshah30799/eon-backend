import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as XLSX from "xlsx";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionItem } from "../transactions/entities/transaction-item.entity";
import { TransactionAdditionalCharge } from "../transactions/entities/transaction-additional-charge.entity";
import { TransactionType } from "../transactions/transactions.enums";
import { ProductProfitReportQueryDto } from "./dto/product-profit-report-query.dto";
import { ReportSortBy } from "./dto/report-sort.dto";

type ProductProfitReportColumn = {
  key: string;
  label: string;
};

type ProductProfitReportRow = Record<string, string> & {
  rowType: "ITEM" | "SUBTOTAL";
  transactionId: string;
  sortBranch: string;
  sortDateTime: string;
  sortTransactionNumber: string;
};

type ResolvedFilters = {
  startDate: Date | null;
  endDate: Date | null;
  branchIds: string[];
  stateIds: string[];
  counterIds: string[];
  partyProfileIds: string[];
  partyTypeCodes: string[];
  currencyIds: string[];
  productIds: string[];
  sortBy: ReportSortBy;
};

const COLUMNS: ProductProfitReportColumn[] = [
  { key: "branchCode", label: "Branch Code" },
  { key: "type", label: "Type" },
  { key: "transactionNumber", label: "Transaction Number" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "profileName", label: "Profile Name" },
  { key: "agentName", label: "Agent Name" },
  { key: "currencyCode", label: "Currency Code" },
  { key: "productType", label: "Product Type" },
  { key: "quantity", label: "Quantity" },
  { key: "rate", label: "Rate" },
  { key: "amount", label: "Amount" },
  { key: "cost", label: "Cost" },
  { key: "totalGp", label: "Total GP" },
  { key: "otherIncome", label: "Other Income" },
  { key: "otherExpense", label: "Other Expense" },
  { key: "commissionRate", label: "Commission Rate" },
  { key: "commissionAmount", label: "Commission Amount" },
  { key: "netProfit", label: "Net Profit" },
];

const toText = (value: unknown) => {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
};

const formatNumber = (value: number | string | null | undefined, scale = 2) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return (0).toFixed(scale);
  }
  return parsed.toFixed(scale);
};

const formatDateOnly = (value: Date | string | null | undefined) => {
  if (!value) {
    return "";
  }
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

const formatTimeOnly = (value: Date | string | null | undefined) => {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(date);
};

const getSnapshotLabel = (snapshot: Record<string, unknown> | null | undefined) => {
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

const getSnapshotCode = (snapshot: Record<string, unknown> | null | undefined) => {
  if (!snapshot) {
    return "";
  }
  return toText(snapshot.code);
};

const getSnapshotName = (snapshot: Record<string, unknown> | null | undefined) => {
  if (!snapshot) {
    return "";
  }
  return toText(snapshot.name) || getSnapshotLabel(snapshot);
};

const getTransactionDate = (transaction: Transaction) => {
  return transaction.approvedAt ?? transaction.createdAt ?? transaction.submittedAt;
};

const compareIsoDateStrings = (
  left: string,
  right: string,
  direction: ReportSortBy,
) => {
  if (left === right) {
    return 0;
  }

  const result = left.localeCompare(right);
  return direction === ReportSortBy.DATE_DESC ? result * -1 : result;
};

const getTransactionTypeLabel = (transaction: Transaction) => {
  const slug = toText(transaction.slug) || transaction.transactionType.toLowerCase();
  return [slug, transaction.tradeMode.toLowerCase()].filter(Boolean).join(" ");
};

const getItemUnitRate = (item: TransactionItem) => {
  const rate = Number(item.rate ?? 0);
  const per = Number(item.per ?? 1) || 1;
  return rate / per;
};

const getItemAmount = (item: TransactionItem) => {
  const quantity = Number(item.quantity ?? 0);
  return quantity * getItemUnitRate(item);
};

const getItemCostAmount = (item: TransactionItem) => {
  const quantity = Number(item.quantity ?? 0);
  const holdCost = Number(item.holdCost ?? 0);
  return quantity * holdCost;
};

const getItemGpAmount = (item: TransactionItem) => {
  const quantity = Number(item.quantity ?? 0);
  const profit = Number(item.profit ?? 0);
  return quantity * profit;
};

const getCommissionRate = (item: TransactionItem) => {
  const snapshot = item.commissionSnapshot as Record<string, unknown> | null | undefined;
  return toText(snapshot?.commissionValue) || "";
};

const getCommissionAmount = (item: TransactionItem) => Number(item.commission ?? 0);

const buildChargeTotals = (transaction: Transaction) => {
  let income = 0;
  let expense = 0;

  for (const charge of transaction.additionalCharges ?? []) {
    const amount = Number(charge.amount ?? 0);
    if (!Number.isFinite(amount) || amount === 0) {
      continue;
    }

    if (transaction.transactionType === TransactionType.PURCHASE) {
      if (amount < 0) {
        income += Math.abs(amount);
      } else {
        expense += amount;
      }
      continue;
    }

    if (amount > 0) {
      income += amount;
    } else {
      expense += Math.abs(amount);
    }
  }

  return { income, expense };
};

const buildSubtotalRow = (rows: ProductProfitReportRow[]): ProductProfitReportRow => {
  const sum = (key: string) =>
    rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);

  return {
    rowType: "SUBTOTAL",
    transactionId: rows[0]?.transactionId ?? "",
    sortBranch: "",
    sortDateTime: "",
    sortTransactionNumber: "",
    branchCode: "",
    type: "",
    transactionNumber: "",
    date: "",
    time: "",
    profileName: "",
    agentName: "",
    currencyCode: "",
    productType: "Subtotal",
    quantity: formatNumber(sum("quantity"), 7),
    rate: "",
    amount: formatNumber(sum("amount"), 2),
    cost: formatNumber(sum("cost"), 2),
    totalGp: formatNumber(sum("totalGp"), 2),
    otherIncome: formatNumber(sum("otherIncome"), 2),
    otherExpense: formatNumber(sum("otherExpense"), 2),
    commissionRate: "",
    commissionAmount: formatNumber(sum("commissionAmount"), 2),
    netProfit: formatNumber(sum("netProfit"), 2),
  };
};

@Injectable()
export class ProductProfitReportService {
  constructor(
    @InjectRepository(Transaction, "database2")
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  private resolveFilters(query: ProductProfitReportQueryDto): ResolvedFilters {
    const startDate = query.startDate ? new Date(query.startDate) : null;
    const endDate = query.endDate ? new Date(query.endDate) : null;

    if (startDate && Number.isNaN(startDate.getTime())) {
      throw new BadRequestException("Invalid startDate");
    }

    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new BadRequestException("Invalid endDate");
    }

    if ((startDate && !endDate) || (!startDate && endDate)) {
      throw new BadRequestException("Both startDate and endDate are required");
    }

    return {
      startDate,
      endDate,
      branchIds: query.branchIds ?? [],
      stateIds: query.stateIds ?? [],
      counterIds: query.counterIds ?? [],
      partyProfileIds: query.partyProfileIds ?? [],
      partyTypeCodes: query.partyTypeCodes ?? [],
      currencyIds: query.currencyIds ?? [],
      productIds: query.productIds ?? [],
      sortBy: query.sortBy ?? ReportSortBy.DATE_ASC,
    };
  }

  private async loadTransactions(filters: ResolvedFilters) {
    const qb = this.transactionRepository
      .createQueryBuilder("transaction")
      .leftJoinAndSelect("transaction.items", "item")
      .leftJoinAndSelect("transaction.additionalCharges", "charge")
      .where("transaction.isLatest = true")
      .andWhere("transaction.status = :status", { status: "APPROVED" });

    if (filters.startDate && filters.endDate) {
      qb.andWhere("transaction.approvedAt >= :startDate", {
        startDate: filters.startDate,
      }).andWhere("transaction.approvedAt <= :endDate", {
        endDate: new Date(filters.endDate.getTime() + 24 * 60 * 60 * 1000 - 1),
      });
    }

    if (filters.branchIds.length > 0) {
      qb.andWhere("transaction.branchId IN (:...branchIds)", {
        branchIds: filters.branchIds,
      });
    }

    if (filters.stateIds.length > 0) {
      qb.andWhere(
        `COALESCE(transaction.branch_snapshot->'state'->>'id', '') IN (:...stateIds)`,
        { stateIds: filters.stateIds },
      );
    }

    if (filters.counterIds.length > 0) {
      qb.andWhere(
        `COALESCE(transaction.counter_id::text, transaction.counter_snapshot->>'id', '') IN (:...counterIds)`,
        { counterIds: filters.counterIds },
      );
    }

    if (filters.partyProfileIds.length > 0) {
      qb.andWhere("transaction.partyProfileId IN (:...partyProfileIds)", {
        partyProfileIds: filters.partyProfileIds,
      });
    }

    if (filters.partyTypeCodes.length > 0) {
      qb.andWhere(
        `COALESCE(transaction.party_profile_snapshot->>'type', '') IN (:...partyTypeCodes)`,
        { partyTypeCodes: filters.partyTypeCodes },
      );
    }

    if (filters.currencyIds.length > 0) {
      qb.andWhere("item.currencyId IN (:...currencyIds)", {
        currencyIds: filters.currencyIds,
      });
    }

    if (filters.productIds.length > 0) {
      qb.andWhere("item.productId IN (:...productIds)", {
        productIds: filters.productIds,
      });
    }

    qb.orderBy(
        `COALESCE(transaction.branch_snapshot->>'code', transaction.branch_id::text)`,
        "ASC",
      )
      .addOrderBy("transaction.approved_at", "ASC")
      .addOrderBy("transaction.created_at", "ASC")
      .addOrderBy("transaction.number", "ASC")
      .addOrderBy("item.line_no", "ASC");

    return qb.getMany();
  }

  async buildReport(query: ProductProfitReportQueryDto) {
    const filters = this.resolveFilters(query);
    const transactions = await this.loadTransactions(filters);
    const rows: ProductProfitReportRow[] = [];

    transactions.forEach(transaction => {
      const transactionDate = getTransactionDate(transaction);
      const dateLabel = formatDateOnly(transactionDate);
      const timeLabel = formatTimeOnly(transactionDate);
      const branchLabel = getSnapshotLabel(
        transaction.branchSnapshot as Record<string, unknown> | null | undefined,
      );
      const profileName = getSnapshotLabel(
        transaction.partyProfileSnapshot as Record<string, unknown> | null | undefined,
      );
      const agentName = getSnapshotLabel(
        transaction.agentProfileSnapshot as Record<string, unknown> | null | undefined,
      );
      const transactionItems = [...(transaction.items ?? [])].sort(
        (left, right) => left.lineNo - right.lineNo,
      );
      const matchingItems = transactionItems.filter(item => {
        if (filters.currencyIds.length > 0 && !filters.currencyIds.includes(item.currencyId)) {
          return false;
        }
        if (filters.productIds.length > 0 && !filters.productIds.includes(item.productId)) {
          return false;
        }
        return true;
      });

      if (matchingItems.length === 0) {
        return;
      }

      const { income: totalTransactionIncome, expense: totalTransactionExpense } =
        buildChargeTotals(transaction);

      const totalMatchingAmount = matchingItems.reduce((sum, item) => sum + getItemAmount(item), 0);
      const fallbackWeight = matchingItems.length > 0 ? 1 / matchingItems.length : 0;

      matchingItems.forEach((item, index) => {
        const itemAmount = getItemAmount(item);
        const itemCost = getItemCostAmount(item);
        const itemGp = getItemGpAmount(item);
        const itemCommission = getCommissionAmount(item);
        const commissionRate = getCommissionRate(item);
        const allocationWeight =
          totalMatchingAmount > 0 ? itemAmount / totalMatchingAmount : fallbackWeight;
        const otherIncome = totalTransactionIncome * allocationWeight;
        const otherExpense = totalTransactionExpense * allocationWeight;
        const netProfit = itemGp + otherIncome - otherExpense - itemCommission;

        rows.push({
          rowType: "ITEM",
          transactionId: transaction.id,
          sortBranch: branchLabel,
          sortDateTime: transactionDate ? new Date(transactionDate).toISOString() : "",
          sortTransactionNumber: transaction.number ?? "",
          branchCode: getSnapshotCode(
            transaction.branchSnapshot as Record<string, unknown> | null | undefined,
          ),
          type: getTransactionTypeLabel(transaction),
          transactionNumber: transaction.number ?? "",
          date: dateLabel,
          time: timeLabel,
          profileName: getSnapshotName(
            transaction.partyProfileSnapshot as Record<string, unknown> | null | undefined,
          ),
          agentName: getSnapshotName(
            transaction.agentProfileSnapshot as Record<string, unknown> | null | undefined,
          ),
          currencyCode: getSnapshotCode(
            item.currencySnapshot as Record<string, unknown> | null | undefined,
          ),
          productType: getSnapshotLabel(
            item.productSnapshot as Record<string, unknown> | null | undefined,
          ),
          quantity: formatNumber(item.quantity, 7),
          rate: formatNumber(getItemUnitRate(item), 7),
          amount: formatNumber(itemAmount, 2),
          cost: formatNumber(itemCost, 2),
          totalGp: formatNumber(itemGp, 2),
          otherIncome: formatNumber(otherIncome, 2),
          otherExpense: formatNumber(otherExpense, 2),
          commissionRate,
          commissionAmount: formatNumber(itemCommission, 2),
          netProfit: formatNumber(netProfit, 2),
        });
      });
    });

    rows.sort((left, right) => {
      if (left.sortBranch !== right.sortBranch) {
        return left.sortBranch.localeCompare(right.sortBranch);
      }
      if (left.sortDateTime !== right.sortDateTime) {
        return compareIsoDateStrings(left.sortDateTime, right.sortDateTime, filters.sortBy);
      }
      if (left.sortTransactionNumber !== right.sortTransactionNumber) {
        return left.sortTransactionNumber.localeCompare(right.sortTransactionNumber);
      }
      return 0;
    });

    if (rows.length > 0) {
      rows.push(buildSubtotalRow(rows));
    }

    return {
      columns: COLUMNS,
      rows,
      layout: "single" as const,
    };
  }

  async buildExport(query: ProductProfitReportQueryDto, format: "csv" | "xlsx") {
    const report = await this.buildReport(query);
    const sheetData = report.rows.map(row => {
      const output: Record<string, string> = {};
      report.columns.forEach(column => {
        output[column.key] = row[column.key] ?? "";
      });
      return output;
    });

    if (format === "csv") {
      const worksheet = XLSX.utils.json_to_sheet(sheetData, {
        header: report.columns.map(column => column.key),
      });
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      return {
        buffer: Buffer.from(csv, "utf8"),
        contentType: "text/csv; charset=utf-8",
        filename: "product-profit-report.csv",
      };
    }

    const worksheet = XLSX.utils.json_to_sheet(sheetData, {
      header: report.columns.map(column => column.key),
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ProductProfit");
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    return {
      buffer,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "product-profit-report.xlsx",
    };
  }
}
