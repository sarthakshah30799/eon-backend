import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as XLSX from "xlsx";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionStatus } from "../transactions/transactions.enums";
import { ReportSortBy } from "./dto/report-sort.dto";
import { SpecialReportFormat, SpecialReportQueryDto, SpecialReportTemplateEnum } from "./dto/special-report-query.dto";

type SpecialReportColumn = {
  key: string;
  label: string;
};

type SpecialReportRow = Record<string, string> & {
  rowType: "ITEM";
  transactionId: string;
  sortBranch: string;
  sortDateTime: string;
  sortTransactionNumber: string;
};

const COLUMNS: SpecialReportColumn[] = [
  { key: "branch", label: "Branch" },
  { key: "type", label: "Type" },
  { key: "date", label: "Date" },
  { key: "transactionNumber", label: "Transaction Number" },
  { key: "accountCode", label: "Account Code" },
  { key: "accountName", label: "Account Name" },
  { key: "partyProfileCode", label: "Party Profile Code" },
  { key: "partyProfileName", label: "Party Profile Name" },
  { key: "direction", label: "Direction" },
  { key: "debit", label: "Debit" },
  { key: "credit", label: "Credit" },
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

const formatTransactionTypeLabel = (transaction: Transaction) =>
  [toText(transaction.slug) || transaction.transactionType.toLowerCase(), transaction.tradeMode.toLowerCase()]
    .filter(Boolean)
    .join(" ");

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

@Injectable()
export class SpecialReportService {
  constructor(
    @InjectRepository(Transaction, "database2")
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  private resolveFilters(query: SpecialReportQueryDto) {
    const branchIds = [...new Set((query.branchIds ?? []).map(item => item.trim()).filter(Boolean))];
    const transactionNumbers = [...new Set((query.transactionNumbers ?? []).map(item => item.trim()).filter(Boolean))];

    if (branchIds.length === 0) {
      throw new BadRequestException("At least one branch is required");
    }

    const template = query.template ?? SpecialReportTemplateEnum.ACCOUNT_POSTING;
    if (template !== SpecialReportTemplateEnum.ACCOUNT_POSTING) {
      throw new BadRequestException("Unsupported special report template");
    }

    return {
      branchIds,
      transactionNumbers,
      template,
      sortBy: query.sortBy ?? ReportSortBy.DATE_ASC,
    };
  }

  private async loadTransactions(branchIds: string[], transactionNumbers: string[]) {
    const qb = this.transactionRepository
      .createQueryBuilder("transaction")
      .innerJoinAndSelect("transaction.postings", "posting")
      .where("transaction.isLatest = true")
      .andWhere("transaction.status = :status", { status: TransactionStatus.APPROVED })
      .andWhere("transaction.branchId IN (:...branchIds)", { branchIds });

    if (transactionNumbers.length > 0) {
      qb.andWhere("transaction.number IN (:...transactionNumbers)", {
        transactionNumbers,
      });
    }

    qb.orderBy(`COALESCE(transaction.branch_snapshot->>'code', transaction.branch_id::text)`, "ASC")
      .addOrderBy("transaction.approvedAt", "ASC")
      .addOrderBy("transaction.number", "ASC")
      .addOrderBy("posting.lineNo", "ASC");

    return qb.getMany();
  }

  private buildRows(transaction: Transaction): SpecialReportRow[] {
    const transactionDate = getTransactionDate(transaction);
    const dateLabel = formatDateOnly(transactionDate);
    const sortDateTime = transactionDate ? new Date(transactionDate).toISOString() : "";
    const branchLabel = getSnapshotLabel(transaction.branchSnapshot as Record<string, unknown> | null | undefined);
    const partyProfileSnapshot = transaction.partyProfileSnapshot as Record<string, unknown> | null | undefined;
    const partyProfileCode = toText(partyProfileSnapshot?.code);
    const partyProfileName = getSnapshotLabel(partyProfileSnapshot);
    const typeLabel = formatTransactionTypeLabel(transaction);

    const postings = [...(transaction.postings ?? [])].sort((left, right) => left.lineNo - right.lineNo);

    return postings.map(posting => {
      const accountSnapshot = posting.accountSnapshot as Record<string, unknown> | null | undefined;
      const amount = Number(posting.amount ?? 0);
      const isDebit = posting.direction === "DEBIT";

      return {
        rowType: "ITEM",
        transactionId: transaction.id,
        sortBranch: branchLabel,
        sortDateTime,
        sortTransactionNumber: transaction.number ?? "",
        branch: branchLabel,
        type: typeLabel,
        date: dateLabel,
        transactionNumber: transaction.number ?? "",
        accountCode: getSnapshotCode(accountSnapshot),
        accountName: getSnapshotName(accountSnapshot),
        partyProfileCode,
        partyProfileName,
        direction: posting.direction,
        debit: isDebit ? formatNumber(amount, 2) : "0.00",
        credit: isDebit ? "0.00" : formatNumber(amount, 2),
      };
    });
  }

  async buildReport(query: SpecialReportQueryDto) {
    const filters = this.resolveFilters(query);
    const transactions = await this.loadTransactions(filters.branchIds, filters.transactionNumbers);

    const rows = transactions
      .flatMap(transaction => this.buildRows(transaction))
      .sort((left, right) => {
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

    return {
      columns: COLUMNS,
      rows,
      template: filters.template,
    };
  }

  async buildExport(query: SpecialReportQueryDto, format: SpecialReportFormat) {
    const report = await this.buildReport(query);
    const sheetData = report.rows.map(row => {
      const output: Record<string, string> = {};
      report.columns.forEach(column => {
        output[column.key] = row[column.key] ?? "";
      });
      return output;
    });

    if (format === SpecialReportFormat.CSV) {
      const worksheet = XLSX.utils.json_to_sheet(sheetData, {
        header: report.columns.map(column => column.key),
      });
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      return {
        buffer: Buffer.from(csv, "utf8"),
        contentType: "text/csv; charset=utf-8",
        filename: "special-reports-account-posting.csv",
      };
    }

    const worksheet = XLSX.utils.json_to_sheet(sheetData, {
      header: report.columns.map(column => column.key),
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SpecialReport");
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    return {
      buffer,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "special-reports-account-posting.xlsx",
    };
  }
}
