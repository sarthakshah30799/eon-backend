import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as XLSX from "xlsx";
import { Transaction } from "../transactions/entities/transaction.entity";
import {
  formatPaymentChequeReference,
  isNonChequeBankPaymentMethod,
  TransactionPartyProfileTypeEnum,
  TransactionType,
} from "../transactions/transactions.enums";
import { TransactionItem } from "../transactions/entities/transaction-item.entity";
import { TransactionPayment } from "../transactions/entities/transaction-payment.entity";
import { TransactionAdditionalCharge } from "../transactions/entities/transaction-additional-charge.entity";
import {
  SalePurchaseReportDetail,
  SalePurchaseReportGroupBy,
  SalePurchaseReportQueryDto,
} from "./dto/sale-purchase-report-query.dto";
import { ReportSortBy } from "./dto/report-sort.dto";

type ReportLayout = "grouped" | "flat";
type ReportExportFormat = "csv" | "xlsx";
type ReportRowType = "GROUP" | "ITEM" | "SUBTOTAL";

type ReportColumn = {
  key: string;
  label: string;
};

type ReportRow = Record<string, string> & {
  rowType: ReportRowType;
  transactionId: string;
  partyProfileId: string;
  branchId: string;
  sortPartyProfile: string;
  sortBranch: string;
  sortDate: string;
  sortDateKey: string;
  sortTransactionKey: string;
  groupKey: string;
  groupLabel: string;
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
  sortBy: ReportSortBy;
  groupBy: SalePurchaseReportGroupBy;
  detail: SalePurchaseReportDetail;
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

const formatSortDateKey = (value: Date | string | null | undefined) => {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
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
  return (
    transaction.approvedAt ?? transaction.createdAt ?? transaction.submittedAt
  );
};

const getItemUnitAmount = (item: TransactionItem) => {
  const quantity = Number(item.quantity ?? 0);
  const rate = Number(item.rate ?? 0);
  const per = Number(item.per ?? 1) || 1;
  return quantity * (rate / per);
};

const snapshotField = (
  snapshot: Record<string, unknown> | null | undefined,
  key: string,
) => toText(snapshot?.[key]);

const getItemTaxAmount = (item: TransactionItem) => {
  const gst = Number(item.gstAmount ?? 0);
  if (Number.isFinite(gst) && gst !== 0) {
    return gst;
  }

  return [item.igstAmount, item.cgstAmount, item.sgstAmount].reduce(
    (sum, value) => {
      const amount = Number(value ?? 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    },
    0,
  );
};

const getItemLineAmount = (item: TransactionItem) => {
  if (item.amount !== null && item.amount !== undefined && item.amount !== "") {
    const stored = Number(item.amount);
    if (Number.isFinite(stored)) {
      return stored;
    }
  }

  return getItemUnitAmount(item);
};

const getItemProfitRate = (item: TransactionItem) => {
  if (item.profit !== null && item.profit !== undefined && item.profit !== "") {
    return Number(item.profit);
  }

  return 0;
};

const getPaymentNumber = (payment: TransactionPayment) => {
  if (isNonChequeBankPaymentMethod(payment.paymentMethod)) {
    return String(payment.paymentMethod).trim().toUpperCase();
  }
  const chequePageNo = toText(
    (payment.chequePageSnapshot as Record<string, unknown> | null | undefined)
      ?.pageNo,
  );
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
  const manualBook = snapshot.manualBook as
    | Record<string, unknown>
    | null
    | undefined;
  const bookNo = toText(manualBook?.no);

  if (bookNo && pageNo) {
    return `${bookNo}/${pageNo}`;
  }

  return pageNo || bookNo;
};

const buildPaymentColumns = (maxPayments: number) =>
  Array.from({ length: maxPayments }).flatMap((_, index) =>
    PAYMENT_FIELD_SUFFIXES.map((field) => ({
      key: `payment_${index + 1}_${field.key}`,
      label: `Payment ${index + 1} ${field.label}`,
    })),
  );

const buildChargeColumns = (maxCharges: number) =>
  Array.from({ length: maxCharges }).flatMap((_, index) =>
    CHARGE_FIELD_SUFFIXES.map((field) => ({
      key: `charge_${index + 1}_${field.key}`,
      label: `Charge ${index + 1} ${field.label}`,
    })),
  );

const SHORT_COLUMNS: ReportColumn[] = [
  { key: "brnCode", label: "BRNCODE" },
  { key: "date", label: "DATE" },
  { key: "vno", label: "VNO" },
  { key: "type", label: "Type" },
  { key: "partyName", label: "Party Name" },
  { key: "passengerName", label: "Passenger Name" },
  { key: "cnCode", label: "Cncode" },
  { key: "exchType", label: "Exch Type" },
  { key: "feAmount", label: "Feamount" },
  { key: "rate", label: "Rate" },
  { key: "amount", label: "Amount" },
  { key: "taxAmt", label: "taxamt" },
  { key: "netAmt", label: "Netamt" },
  { key: "manualBillRef", label: "Manual Bill Ref." },
  { key: "issuerCode", label: "Issuer Code" },
  { key: "cardNumber", label: "Card Number" },
  { key: "profit", label: "Profit" },
  { key: "reference", label: "Refrence" },
  { key: "category", label: "Category" },
  { key: "paymentByBranch", label: "Receipt / Payment By Branch" },
  { key: "paymentDate", label: "Receive /Payment Date" },
  { key: "paymentNumber", label: "Receipt / Payment Number" },
  { key: "paymentInBank", label: "Receipt / Payment In Bank" },
  { key: "paidByName", label: "Paid By / Paid To Name" },
  { key: "paidByPan", label: "Paid By / Paid To PAN NO" },
  { key: "chequeRef", label: "Cheque No / Bank Reference No" },
  { key: "paymentAmount", label: "Receipt / Payment Amount" },
  { key: "chequeDate", label: "Cheque Date" },
  { key: "drawnOn", label: "Drawn on" },
  { key: "narration", label: "Narration" },
  { key: "remarks", label: "Remarks" },
];

const buildColumns = (
  maxPayments: number,
  maxCharges: number,
  detail: SalePurchaseReportDetail,
) =>
  detail === SalePurchaseReportDetail.SHORT ||
  detail === SalePurchaseReportDetail.LONG
    ? SHORT_COLUMNS.map((column) => ({ ...column }))
    : [
        ...BASE_COLUMNS,
        ...buildPaymentColumns(maxPayments),
        ...buildChargeColumns(maxCharges),
      ];

const formatTransactionTypeLabel = (transaction: Transaction) =>
  transaction.transferRequestId
    ? [
        transaction.transactionPartyProfileType ===
        TransactionPartyProfileTypeEnum.BRANCH
          ? "branch transfer"
          : transaction.transactionPartyProfileType ===
              TransactionPartyProfileTypeEnum.COUNTER
            ? "counter transfer"
            : toText(transaction.slug) ||
              transaction.transactionType.toLowerCase(),
        transaction.tradeMode.toLowerCase(),
      ]
        .filter(Boolean)
        .join(" ")
    : [
        toText(transaction.slug) || transaction.transactionType.toLowerCase(),
        transaction.tradeMode.toLowerCase(),
      ]
        .filter(Boolean)
        .join(" ");

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
      sortBy: query.sortBy ?? ReportSortBy.DATE_ASC,
      groupBy: query.groupBy ?? SalePurchaseReportGroupBy.CODE,
      detail: query.detail ?? SalePurchaseReportDetail.SHORT,
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
    qb.andWhere("COALESCE(transaction.slug, '') NOT IN (:...technicalSlugs)", {
      technicalSlugs: [
        "CARD_STOCK",
        "CARD_TRANSFER_OUT",
        "CARD_TRANSFER_IN",
        "CARD_STOCK_LOAD",
        "CARD_SELL",
        "CARD_SETTLE",
        "CM_SETTLE",
        "TT_SETTLE",
        "CARD_RETURN",
        "CARD_VOID",
      ],
    });

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

    const partyOrder = `COALESCE(transaction.party_profile_snapshot->>'code', transaction.party_profile_snapshot->>'name', transaction.party_profile_id::text)`;
    const branchOrder = `COALESCE(transaction.branch_snapshot->>'code', transaction.branch_snapshot->>'name', transaction.branch_id::text)`;
    const dateDirection =
      filters.sortBy === ReportSortBy.DATE_DESC ? "DESC" : "ASC";
    if (filters.groupBy === SalePurchaseReportGroupBy.DATE) {
      qb.orderBy("transaction.approved_at", dateDirection)
        .addOrderBy(partyOrder, "ASC")
        .addOrderBy(branchOrder, "ASC");
    } else if (filters.groupBy === SalePurchaseReportGroupBy.BRANCH) {
      qb.orderBy(branchOrder, "ASC")
        .addOrderBy(partyOrder, "ASC")
        .addOrderBy("transaction.approved_at", dateDirection);
    } else {
      qb.orderBy(partyOrder, "ASC")
        .addOrderBy(branchOrder, "ASC")
        .addOrderBy("transaction.approved_at", dateDirection);
    }
    qb.addOrderBy("transaction.created_at", "ASC").addOrderBy(
      "transaction.number",
      "ASC",
    );

    return qb.getMany();
  }

  private buildTransactionRows(
    transaction: Transaction,
    groupBy: SalePurchaseReportGroupBy,
  ): {
    groupHeaderRow: ReportRow;
    groupedRows: ReportRow[];
    flatRows: ReportRow[];
    maxPayments: number;
    maxCharges: number;
  } {
    const items = [...(transaction.items ?? [])]
      .filter((item) => !item.dealCoverId)
      .sort((left, right) => left.lineNo - right.lineNo);
    const payments = [...(transaction.payments ?? [])].sort(
      (left, right) => left.lineNo - right.lineNo,
    );
    const charges = [...(transaction.additionalCharges ?? [])].sort(
      (left, right) => left.lineNo - right.lineNo,
    );
    const transactionDate = getTransactionDate(transaction);
    const dateLabel = formatDateOnly(transactionDate);
    const sortDate = transactionDate
      ? new Date(transactionDate).toISOString()
      : "";
    const sortDateKey = formatSortDateKey(transactionDate);
    const sortTransactionKey = [
      transaction.approvedAt
        ? new Date(transaction.approvedAt).toISOString()
        : "",
      transaction.createdAt
        ? new Date(transaction.createdAt).toISOString()
        : "",
      transaction.number ?? "",
    ].join("::");
    const branchLabel = getSnapshotLabel(
      transaction.branchSnapshot as Record<string, unknown> | null | undefined,
    );
    const branchSortKey =
      toText(
        (
          transaction.branchSnapshot as
            | Record<string, unknown>
            | null
            | undefined
        )?.code,
      ) || branchLabel;
    const partyProfileLabel = getSnapshotLabel(
      transaction.partyProfileSnapshot as
        | Record<string, unknown>
        | null
        | undefined,
    );
    const partyProfileCode = toText(
      (
        transaction.partyProfileSnapshot as
          | Record<string, unknown>
          | null
          | undefined
      )?.code,
    );
    const partyProfileId = transaction.partyProfileId;
    const branchId = transaction.branchId ?? "";
    const partyProfileDisplay =
      partyProfileLabel || partyProfileCode || partyProfileId;
    const groupKey =
      groupBy === SalePurchaseReportGroupBy.DATE
        ? sortDateKey
        : groupBy === SalePurchaseReportGroupBy.BRANCH
          ? branchId || branchSortKey
          : partyProfileId;
    const groupLabel =
      groupBy === SalePurchaseReportGroupBy.DATE
        ? `Date: ${dateLabel || "Unknown"}`
        : groupBy === SalePurchaseReportGroupBy.BRANCH
          ? `Branch: ${branchLabel || branchSortKey || "Unknown"}`
          : `Party Profile: ${partyProfileDisplay || "Unknown"}`;
    const partySnapshot = transaction.partyProfileSnapshot as
      | Record<string, unknown>
      | null
      | undefined;
    const passengerSnapshot = transaction.passengerSnapshot as
      | Record<string, unknown>
      | null
      | undefined;
    const brnCode = branchSortKey;
    const partyName = snapshotField(partySnapshot, "name") || partyProfileLabel;
    const passengerName =
      snapshotField(passengerSnapshot, "passportPassengerName") ||
      snapshotField(passengerSnapshot, "name");
    const paidByName = snapshotField(passengerSnapshot, "paidByPanHolderName");
    const paidByPan = snapshotField(passengerSnapshot, "paidByPanNumber");
    const remarks = toText(transaction.remarks);
    const manualBillBook = getManualBookLabel(transaction);
    const emptyShortTransactionFields = {
      brnCode: "",
      partyName: "",
      passengerName: "",
      manualBillRef: "",
      paidByName: "",
      paidByPan: "",
      reference: "",
      category: "",
      narration: "",
      remarks: "",
    };
    const sortFields = {
      partyProfileId,
      branchId,
      sortPartyProfile: partyProfileLabel,
      sortBranch: branchSortKey,
      sortDate,
      sortDateKey,
      sortTransactionKey,
      groupKey,
      groupLabel,
    };
    const groupHeaderRow: ReportRow = {
      rowType: "GROUP",
      transactionId: transaction.id,
      ...sortFields,
      branch: groupBy === SalePurchaseReportGroupBy.BRANCH ? branchLabel : "",
      vno: "",
      type:
        groupBy === SalePurchaseReportGroupBy.DATE
          ? "Date"
          : groupBy === SalePurchaseReportGroupBy.BRANCH
            ? "Branch"
            : "Party Profile",
      partyProfileCode:
        groupBy === SalePurchaseReportGroupBy.CODE ? partyProfileCode || "" : "",
      partyProfileName:
        groupBy === SalePurchaseReportGroupBy.CODE ? partyProfileDisplay : "",
      ...emptyShortTransactionFields,
      brnCode:
        groupBy === SalePurchaseReportGroupBy.BRANCH ? brnCode : "",
      date: groupBy === SalePurchaseReportGroupBy.DATE ? dateLabel : "",
      partyName:
        groupBy === SalePurchaseReportGroupBy.CODE ? partyName : "",
      currencyCode: "",
      productCode: "",
      quantity: "",
      rate: "",
      amount: "",
      taxAmount: "",
      netAmount: "",
      manualBillBook: "",
      profit: "",
    } as ReportRow;
    const baseValues = {
      branch: branchLabel,
      date: dateLabel,
      vno: transaction.number ?? "",
      type: formatTransactionTypeLabel(transaction),
      partyProfileCode,
      partyProfileName: partyProfileLabel,
      manualBillBook,
      brnCode,
      partyName,
      passengerName,
      manualBillRef: manualBillBook,
      paidByName,
      paidByPan,
      reference: "",
      category: "",
      narration: "",
      remarks,
    };
    const subtotalAmount = items.reduce(
      (sum, item) => sum + getItemLineAmount(item),
      0,
    );
    const subtotalTax = items.reduce(
      (sum, item) => sum + getItemTaxAmount(item),
      0,
    );
    const subtotalNet = subtotalAmount + subtotalTax;
    const netAmount = subtotalAmount;
    const subtotalProfit = items.reduce(
      (sum, item) => sum + getItemProfitRate(item),
      0,
    );

    const getTransactionLevelColumns = (
      rowIndex: number,
      repeatTransactionData: boolean,
    ) => {
      if (!repeatTransactionData && rowIndex > 0) {
        return {
          branch: "",
          date: "",
          vno: "",
          type: "",
          partyProfileCode: "",
          partyProfileName: "",
          manualBillBook: "",
          ...emptyShortTransactionFields,
        };
      }

      return baseValues;
    };

    const buildRow = (
      item: TransactionItem,
      rowIndex: number,
      repeatTransactionData: boolean,
    ): ReportRow => {
      const transactionColumns = getTransactionLevelColumns(
        rowIndex,
        repeatTransactionData,
      );
      const row: ReportRow = {
        rowType: "ITEM",
        transactionId: transaction.id,
        ...sortFields,
        ...transactionColumns,
        currencyCode: toText(
          (item.currencySnapshot as Record<string, unknown> | null | undefined)
            ?.code,
        ),
        productCode: toText(
          (item.productSnapshot as Record<string, unknown> | null | undefined)
            ?.code,
        ),
        quantity: formatNumber(item.quantity, 7),
        rate: formatNumber(item.rate, 7),
        amount: formatNumber(getItemUnitAmount(item), 2),
        taxAmount: "0.00",
        netAmount:
          rowIndex === 0 || repeatTransactionData
            ? formatNumber(netAmount, 2)
            : "0.00",
        profit: formatNumber(getItemProfitRate(item), 2),
        cnCode: snapshotField(
          item.currencySnapshot as Record<string, unknown> | null | undefined,
          "code",
        ),
        exchType: snapshotField(
          item.productSnapshot as Record<string, unknown> | null | undefined,
          "code",
        ),
        feAmount: formatNumber(item.quantity, 7),
        taxAmt: formatNumber(getItemTaxAmount(item), 2),
        netAmt: formatNumber(
          getItemLineAmount(item) + getItemTaxAmount(item),
          2,
        ),
        issuerCode: snapshotField(
          item.issuerPartyProfileSnapshot as
            | Record<string, unknown>
            | null
            | undefined,
          "code",
        ),
        cardNumber: snapshotField(
          item.cardSnapshot as Record<string, unknown> | null | undefined,
          "maskedCardNumber",
        ),
        remarks: transactionColumns.remarks || toText(item.remarks),
      } as ReportRow;

      const showPayment = repeatTransactionData || rowIndex === 0;
      const visiblePayments = showPayment ? payments : [];
      const joinPaymentText = (values: string[]) =>
        values.map((value) => value.trim()).filter(Boolean).join(" / ");
      row.paymentByBranch = joinPaymentText(
        visiblePayments.map((payment) => toText(payment.branchName)),
      );
      row.paymentDate = "";
      row.paymentNumber = joinPaymentText(
        visiblePayments.map((payment) => getPaymentNumber(payment)),
      );
      row.paymentInBank = joinPaymentText(
        visiblePayments.map((payment) =>
          getSnapshotLabel(
            payment.accountSnapshot as
              | Record<string, unknown>
              | null
              | undefined,
          ),
        ),
      );
      row.chequeRef = joinPaymentText(
        visiblePayments.map((payment) =>
          formatPaymentChequeReference(
            payment.paymentMethod,
            payment.referenceNumber,
          ),
        ),
      );
      row.paymentAmount = visiblePayments.length
        ? formatNumber(
            visiblePayments.reduce(
              (sum, payment) => sum + Number(payment.amount ?? 0),
              0,
            ),
            2,
          )
        : "";
      row.chequeDate = joinPaymentText(
        visiblePayments.map((payment) => formatDateOnly(payment.referenceDate)),
      );
      row.drawnOn = joinPaymentText(
        visiblePayments.map((payment) => toText(payment.drawnOn)),
      );

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
        row[`${prefix}_inBank`] = getSnapshotLabel(
          payment.accountSnapshot as Record<string, unknown> | null | undefined,
        );
        row[`${prefix}_chequeRef`] = formatPaymentChequeReference(
          payment.paymentMethod,
          payment.referenceNumber,
        );
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

        row[`${prefix}_account`] = getSnapshotLabel(
          charge.accountSnapshot as Record<string, unknown> | null | undefined,
        );
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
        ...sortFields,
        branch: "",
        date: "",
        vno: "",
        type: "",
        partyProfileCode: "",
        partyProfileName: "",
        currencyCode: "",
        productCode: "Subtotal",
        quantity: formatNumber(
          items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
          7,
        ),
        rate: "",
        amount: formatNumber(subtotalAmount, 2),
        taxAmount: formatNumber(subtotalTax, 2),
        netAmount: formatNumber(subtotalNet, 2),
        manualBillBook: "",
        profit: formatNumber(subtotalProfit, 2),
        ...emptyShortTransactionFields,
        exchType: "Subtotal",
        feAmount: formatNumber(
          items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
          7,
        ),
        taxAmt: formatNumber(subtotalTax, 2),
        netAmt: formatNumber(subtotalNet, 2),
        issuerCode: "",
        cardNumber: "",
        paymentByBranch: "",
        paymentDate: "",
        paymentNumber: "",
        paymentInBank: "",
        paidByName: "",
        paidByPan: "",
        chequeRef: "",
        paymentAmount: "",
        chequeDate: "",
        drawnOn: "",
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
      groupHeaderRow,
      groupedRows,
      flatRows,
      maxPayments: payments.length,
      maxCharges: charges.length,
    };
  }

  async buildReport(
    query: SalePurchaseReportQueryDto,
    layout: ReportLayout = "grouped",
  ) {
    const filters = this.resolveFilters(query);
    const transactions = await this.loadTransactions(filters);

    const prepared = transactions.map((transaction) =>
      this.buildTransactionRows(transaction, filters.groupBy),
    );
    const maxPayments = prepared.reduce(
      (max, item) => Math.max(max, item.maxPayments),
      0,
    );
    const maxCharges = prepared.reduce(
      (max, item) => Math.max(max, item.maxCharges),
      0,
    );
    const columns = buildColumns(maxPayments, maxCharges, filters.detail);

    const compareText = (left: string, right: string) =>
      left.localeCompare(right);
    const sortedPrepared = [...prepared].sort((left, right) => {
      const leftHeader = left.groupHeaderRow;
      const rightHeader = right.groupHeaderRow;
      const byCode = () =>
        compareText(leftHeader.sortPartyProfile, rightHeader.sortPartyProfile);
      const byBranch = () =>
        compareText(leftHeader.sortBranch, rightHeader.sortBranch);
      const byDate = () =>
        compareIsoDateStrings(
          leftHeader.sortDateKey,
          rightHeader.sortDateKey,
          filters.sortBy,
        );
      const byTransaction = () =>
        compareText(
          leftHeader.sortTransactionKey,
          rightHeader.sortTransactionKey,
        );
      const checks =
        filters.groupBy === SalePurchaseReportGroupBy.DATE
          ? [byDate, byCode, byBranch, byTransaction]
          : filters.groupBy === SalePurchaseReportGroupBy.BRANCH
            ? [byBranch, byCode, byDate, byTransaction]
            : [byCode, byBranch, byDate, byTransaction];

      for (const check of checks) {
        const result = check();
        if (result !== 0) {
          return result;
        }
      }

      return 0;
    });

    const rows: ReportRow[] = [];
    let lastGroupKey = "";

    sortedPrepared.forEach((item) => {
      if (
        layout === "grouped" &&
        item.groupHeaderRow.groupKey !== lastGroupKey
      ) {
        rows.push(item.groupHeaderRow);
        lastGroupKey = item.groupHeaderRow.groupKey;
      }

      rows.push(...(layout === "grouped" ? item.groupedRows : item.flatRows));
    });

    return {
      columns,
      rows,
      layout,
      message: "",
    };
  }

  async buildExport(
    query: SalePurchaseReportQueryDto,
    layout: ReportLayout,
    format: ReportExportFormat,
  ) {
    const report = await this.buildReport(query, layout);
    const detail = query.detail ?? SalePurchaseReportDetail.SHORT;
    if (report.message && !report.rows.length) {
      const filename = `sale-purchase-report-${detail}-${layout}.${format === "csv" ? "csv" : "xlsx"}`;
      if (format === "csv") {
        return {
          buffer: Buffer.from(report.message, "utf8"),
          contentType: "text/csv; charset=utf-8",
          filename,
        };
      }
      const worksheet = XLSX.utils.aoa_to_sheet([[report.message]]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "SalePurchase");
      return {
        buffer: XLSX.write(workbook, {
          type: "buffer",
          bookType: "xlsx",
        }) as Buffer,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename,
      };
    }
    const sheetData = report.rows.map((row) => {
      const output: Record<string, string> = {};
      report.columns.forEach((column) => {
        output[column.key] = row[column.key] ?? "";
      });
      return output;
    });

    if (format === "csv") {
      const worksheet = XLSX.utils.json_to_sheet(sheetData, {
        header: report.columns.map((column) => column.key),
      });
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      return {
        buffer: Buffer.from(csv, "utf8"),
        contentType: "text/csv; charset=utf-8",
        filename: `sale-purchase-report-${detail}-${layout}.csv`,
      };
    }

    const worksheet = XLSX.utils.json_to_sheet(sheetData, {
      header: report.columns.map((column) => column.key),
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
      filename: `sale-purchase-report-${detail}-${layout}.xlsx`,
    };
  }
}
