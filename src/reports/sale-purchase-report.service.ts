import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as XLSX from "xlsx";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionType } from "../transactions/transactions.enums";
import { TransactionItem } from "../transactions/entities/transaction-item.entity";
import { TransactionPayment } from "../transactions/entities/transaction-payment.entity";
import { TransactionAdditionalCharge } from "../transactions/entities/transaction-additional-charge.entity";
import { SalePurchaseReportQueryDto } from "./dto/sale-purchase-report-query.dto";

type ReportLayout = "grouped" | "flat";
type ReportExportFormat = "csv" | "xlsx";
type ReportRowType = "ITEM" | "SUBTOTAL";

type ReportColumn = {
  key: string;
  label: string;
};

type ReportRow = Record<string, string> & {
  rowType: ReportRowType;
  transactionId: string;
  partyProfileId: string;
  sortPartyProfile: string;
  sortDate: string;
  sortTransactionKey: string;
};

type ResolvedFilters = {
  startDate: Date | null;
  endDate: Date | null;
  branchIds: string[];
  stateIds: string[];
  counterIds: string[];
  partyProfileIds: string[];
  partyTypeCodes: string[];
  transactionTypes: TransactionType[];
};

const BASE_COLUMNS: ReportColumn[] = [
  { key: "branch", label: "Branch" },
  { key: "date", label: "Date" },
  { key: "vno", label: "Vno" },
  { key: "type", label: "Type" },
  { key: "partyProfileCode", label: "Party Profile Code" },
  { key: "partyProfileName", label: "Party Profile Name" },
  { key: "currencyCode", label: "Currency Code" },
  { key: "productCode", label: "Product Code" },
  { key: "quantity", label: "Quantity" },
  { key: "rate", label: "Rate" },
  { key: "amount", label: "Amount" },
  { key: "taxAmount", label: "Tax Amount" },
  { key: "netAmount", label: "Net Amount" },
  { key: "manualBillBook", label: "Manual Bill Book" },
  { key: "profit", label: "Profit" },
];

const PAYMENT_FIELD_SUFFIXES = [
  { key: "byBranch", label: "By Branch" },
  { key: "date", label: "Date" },
  { key: "number", label: "Number" },
  { key: "inBank", label: "In Bank" },
  { key: "chequeRef", label: "Cheque Ref" },
  { key: "amount", label: "Amount" },
  { key: "drawnOn", label: "Drawn On" },
];

const CHARGE_FIELD_SUFFIXES = [
  { key: "account", label: "Account" },
  { key: "amount", label: "Amount" },
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

const formatDateTime = (value: Date | string | null | undefined) => {
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

const getNestedId = (
  snapshot: Record<string, unknown> | null | undefined,
  path: string[],
) => {
  let current: unknown = snapshot;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return "";
    }
    current = (current as Record<string, unknown>)[key];
  }
  return toText(current);
};

const getTransactionDate = (transaction: Transaction) => {
  return transaction.approvedAt ?? transaction.createdAt ?? transaction.submittedAt;
};

const getItemUnitAmount = (item: TransactionItem) => {
  const quantity = Number(item.quantity ?? 0);
  const rate = Number(item.rate ?? 0);
  const per = Number(item.per ?? 1) || 1;
  return quantity * (rate / per);
};

const getItemProfitRate = (item: TransactionItem) => {
  if (item.profit !== null && item.profit !== undefined && item.profit !== "") {
    return Number(item.profit);
  }

  return 0;
};

const getPaymentNumber = (payment: TransactionPayment) => {
  const chequePageNo = toText((payment.chequePageSnapshot as Record<string, unknown> | null | undefined)?.pageNo);
  return chequePageNo || toText(payment.referenceNumber);
};

const getManualBookLabel = (transaction: Transaction) => {
  const snapshot = transaction.manualBookPageSnapshot as
    | Record<string, unknown>
    | null
    | undefined;

  if (!snapshot) {
    return "";
  }

  const pageNo = toText(snapshot.pageNo);
  const manualBook = snapshot.manualBook as Record<string, unknown> | null | undefined;
  const bookNo = toText(manualBook?.no);

  if (bookNo && pageNo) {
    return `${bookNo}/${pageNo}`;
  }

  return pageNo || bookNo;
};

const buildPaymentColumns = (maxPayments: number) =>
  Array.from({ length: maxPayments }).flatMap((_, index) =>
    PAYMENT_FIELD_SUFFIXES.map(field => ({
      key: `payment_${index + 1}_${field.key}`,
      label: `Payment ${index + 1} ${field.label}`,
    })),
  );

const buildChargeColumns = (maxCharges: number) =>
  Array.from({ length: maxCharges }).flatMap((_, index) =>
    CHARGE_FIELD_SUFFIXES.map(field => ({
      key: `charge_${index + 1}_${field.key}`,
      label: `Charge ${index + 1} ${field.label}`,
    })),
  );

const buildColumns = (maxPayments: number, maxCharges: number) => [
  ...BASE_COLUMNS,
  ...buildPaymentColumns(maxPayments),
  ...buildChargeColumns(maxCharges),
];

const formatTransactionTypeLabel = (transaction: Transaction) =>
  [
    toText(transaction.slug) || transaction.transactionType.toLowerCase(),
    transaction.tradeMode.toLowerCase(),
  ]
    .filter(Boolean)
    .join(" ");

@Injectable()
export class SalePurchaseReportService {
  constructor(
    @InjectRepository(Transaction, "database2")
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  private resolveFilters(query: SalePurchaseReportQueryDto): ResolvedFilters {
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
      transactionTypes: query.transactionTypes ?? [],
    };
  }

  private async loadTransactions(filters: ResolvedFilters) {
    const qb = this.transactionRepository
      .createQueryBuilder("transaction")
      .leftJoinAndSelect("transaction.items", "item")
      .leftJoinAndSelect("transaction.payments", "payment")
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
        {
          stateIds: filters.stateIds,
        },
      );
    }

    if (filters.counterIds.length > 0) {
      qb.andWhere(
        `COALESCE(transaction.counter_id::text, transaction.counter_snapshot->>'id', '') IN (:...counterIds)`,
        {
          counterIds: filters.counterIds,
        },
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
        {
          partyTypeCodes: filters.partyTypeCodes,
        },
      );
    }

    if (filters.transactionTypes.length > 0) {
      qb.andWhere("transaction.transaction_type IN (:...transactionTypes)", {
        transactionTypes: filters.transactionTypes,
      });
    }

    qb.orderBy(`COALESCE(transaction.party_profile_snapshot->>'code', transaction.party_profile_snapshot->>'name', transaction.party_profile_id::text)`, "ASC")
      .addOrderBy("transaction.approved_at", "ASC")
      .addOrderBy("transaction.created_at", "ASC")
      .addOrderBy("transaction.number", "ASC");

    return qb.getMany();
  }

  private buildTransactionRows(transaction: Transaction): {
    groupedRows: ReportRow[];
    flatRows: ReportRow[];
    maxPayments: number;
    maxCharges: number;
  } {
    const items = [...(transaction.items ?? [])].sort((left, right) => left.lineNo - right.lineNo);
    const payments = [...(transaction.payments ?? [])].sort((left, right) => left.lineNo - right.lineNo);
    const charges = [...(transaction.additionalCharges ?? [])].sort((left, right) => left.lineNo - right.lineNo);
    const transactionDate = getTransactionDate(transaction);
    const dateLabel = formatDateOnly(transactionDate);
    const sortDate = transactionDate ? new Date(transactionDate).toISOString() : "";
    const sortTransactionKey = [
      transaction.approvedAt ? new Date(transaction.approvedAt).toISOString() : "",
      transaction.createdAt ? new Date(transaction.createdAt).toISOString() : "",
      transaction.number ?? "",
    ].join("::");
    const branchLabel = getSnapshotLabel(transaction.branchSnapshot as Record<string, unknown> | null | undefined);
    const partyProfileLabel = getSnapshotLabel(transaction.partyProfileSnapshot as Record<string, unknown> | null | undefined);
    const partyProfileCode = toText((transaction.partyProfileSnapshot as Record<string, unknown> | null | undefined)?.code);
    const partyProfileId = transaction.partyProfileId;
    const manualBillBook = getManualBookLabel(transaction);
    const baseValues = {
      branch: branchLabel,
      date: dateLabel,
      vno: transaction.number ?? "",
      type: formatTransactionTypeLabel(transaction),
      partyProfileCode,
      partyProfileName: partyProfileLabel,
      manualBillBook,
    };
    const netAmount = items.reduce((sum, item) => sum + getItemUnitAmount(item), 0);
    const subtotalAmount = items.reduce((sum, item) => sum + getItemUnitAmount(item), 0);
    const subtotalTax = 0;
    const subtotalNet = netAmount;
    const subtotalProfit = items.reduce((sum, item) => sum + getItemProfitRate(item), 0);

    const getTransactionLevelColumns = (rowIndex: number, repeatTransactionData: boolean) => {
      if (!repeatTransactionData && rowIndex > 0) {
        return {
          branch: "",
          date: "",
          vno: "",
          type: "",
          partyProfileCode: "",
          partyProfileName: "",
          manualBillBook: "",
        };
      }

      return baseValues;
    };

    const buildRow = (
      item: TransactionItem,
      rowIndex: number,
      repeatTransactionData: boolean,
    ): ReportRow => {
      const transactionColumns = getTransactionLevelColumns(rowIndex, repeatTransactionData);
      const row: ReportRow = {
        rowType: "ITEM",
        transactionId: transaction.id,
        partyProfileId,
        sortPartyProfile: partyProfileLabel,
        sortDate,
        sortTransactionKey,
        ...transactionColumns,
        currencyCode: toText((item.currencySnapshot as Record<string, unknown> | null | undefined)?.code),
        productCode: toText((item.productSnapshot as Record<string, unknown> | null | undefined)?.code),
        quantity: formatNumber(item.quantity, 7),
        rate: formatNumber(item.rate, 7),
        amount: formatNumber(getItemUnitAmount(item), 2),
        taxAmount: "0.00",
        netAmount: rowIndex === 0 || repeatTransactionData ? formatNumber(netAmount, 2) : "0.00",
        profit: formatNumber(getItemProfitRate(item), 2),
      } as ReportRow;

      payments.forEach((payment, index) => {
        const prefix = `payment_${index + 1}`;
        if (!repeatTransactionData && rowIndex > 0) {
          row[`${prefix}_byBranch`] = "";
          row[`${prefix}_date`] = "";
          row[`${prefix}_number`] = "";
          row[`${prefix}_inBank`] = "";
          row[`${prefix}_chequeRef`] = "";
          row[`${prefix}_amount`] = "";
          row[`${prefix}_drawnOn`] = "";
          return;
        }

        row[`${prefix}_byBranch`] = toText(payment.branchName);
        row[`${prefix}_date`] = formatDateOnly(payment.referenceDate);
        row[`${prefix}_number`] = getPaymentNumber(payment);
        row[`${prefix}_inBank`] = getSnapshotLabel(payment.accountSnapshot as Record<string, unknown> | null | undefined);
        row[`${prefix}_chequeRef`] = toText(payment.referenceNumber);
        row[`${prefix}_amount`] = formatNumber(payment.amount, 2);
        row[`${prefix}_drawnOn`] = toText(payment.drawnOn);
      });

      charges.forEach((charge, index) => {
        const prefix = `charge_${index + 1}`;
        if (!repeatTransactionData && rowIndex > 0) {
          row[`${prefix}_account`] = "";
          row[`${prefix}_amount`] = "";
          return;
        }

        row[`${prefix}_account`] = getSnapshotLabel(charge.accountSnapshot as Record<string, unknown> | null | undefined);
        row[`${prefix}_amount`] = formatNumber(charge.amount, 2);
      });

      return row;
    };

    const groupedRows: ReportRow[] = [];
    const flatRows: ReportRow[] = [];

    items.forEach((item, index) => {
      groupedRows.push(buildRow(item, index, false));
      flatRows.push(buildRow(item, index, true));
    });

    if (items.length > 0) {
      const subtotalRow: ReportRow = {
        rowType: "SUBTOTAL",
        transactionId: transaction.id,
        partyProfileId,
        sortPartyProfile: partyProfileLabel,
        sortDate,
        sortTransactionKey,
        branch: "",
        date: "",
        vno: "",
        type: "",
        partyProfileCode: "",
        partyProfileName: "",
        currencyCode: "",
        productCode: "Subtotal",
        quantity: formatNumber(items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0), 7),
        rate: "",
        amount: formatNumber(subtotalAmount, 2),
        taxAmount: formatNumber(subtotalTax, 2),
        netAmount: formatNumber(subtotalNet, 2),
        manualBillBook: "",
        profit: formatNumber(subtotalProfit, 2),
      } as ReportRow;

      payments.forEach((_, index) => {
        const prefix = `payment_${index + 1}`;
        subtotalRow[`${prefix}_byBranch`] = "";
        subtotalRow[`${prefix}_date`] = "";
        subtotalRow[`${prefix}_number`] = "";
        subtotalRow[`${prefix}_inBank`] = "";
        subtotalRow[`${prefix}_chequeRef`] = "";
        subtotalRow[`${prefix}_amount`] = "";
        subtotalRow[`${prefix}_drawnOn`] = "";
      });

      charges.forEach((_, index) => {
        const prefix = `charge_${index + 1}`;
        subtotalRow[`${prefix}_account`] = "";
        subtotalRow[`${prefix}_amount`] = "";
      });

      groupedRows.push(subtotalRow);
    }

    return {
      groupedRows,
      flatRows,
      maxPayments: payments.length,
      maxCharges: charges.length,
    };
  }

  async buildReport(query: SalePurchaseReportQueryDto, layout: ReportLayout = "grouped") {
    const filters = this.resolveFilters(query);
    const transactions = await this.loadTransactions(filters);

    const prepared = transactions.map(transaction => this.buildTransactionRows(transaction));
    const maxPayments = prepared.reduce((max, item) => Math.max(max, item.maxPayments), 0);
    const maxCharges = prepared.reduce((max, item) => Math.max(max, item.maxCharges), 0);
    const columns = buildColumns(maxPayments, maxCharges);

    const rows = prepared
      .flatMap(item => (layout === "grouped" ? item.groupedRows : item.flatRows))
      .sort((left, right) => {
        if (left.sortPartyProfile !== right.sortPartyProfile) {
          return left.sortPartyProfile.localeCompare(right.sortPartyProfile);
        }

        if (left.sortDate !== right.sortDate) {
          return left.sortDate.localeCompare(right.sortDate);
        }

        if (left.sortTransactionKey !== right.sortTransactionKey) {
          return left.sortTransactionKey.localeCompare(right.sortTransactionKey);
        }

        if (left.rowType !== right.rowType) {
          return left.rowType === "ITEM" ? -1 : 1;
        }

        return 0;
      });

    return {
      columns,
      rows,
      layout,
    };
  }

  async buildExport(
    query: SalePurchaseReportQueryDto,
    layout: ReportLayout,
    format: ReportExportFormat,
  ) {
    const report = await this.buildReport(query, layout);
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
        filename: `sale-purchase-report-${layout}.csv`,
      };
    }

    const worksheet = XLSX.utils.json_to_sheet(sheetData, {
      header: report.columns.map(column => column.key),
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SalePurchase");
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    return {
      buffer,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `sale-purchase-report-${layout}.xlsx`,
    };
  }
}
