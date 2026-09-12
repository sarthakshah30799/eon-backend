import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import * as XLSX from "xlsx";
import { Branch } from "../branches/branch.entity";
import { AccountPostingsCombinedQuery } from "./account-postings-combined.query";
import { AccountPostingCombinedRow } from "./account-postings-combined.types";
import { ReportSortBy } from "./dto/report-sort.dto";
import {
  SpecialReportFormat,
  SpecialReportQueryDto,
  SpecialReportTemplateEnum,
} from "./dto/special-report-query.dto";

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

  const raw = toText(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [year, month, day] = raw.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
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

const getSnapshotCode = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) {
    return "";
  }

  return toText(snapshot.code);
};

const getSnapshotName = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) {
    return "";
  }

  return toText(snapshot.name) || getSnapshotLabel(snapshot);
};

const formatDocumentTypeLabel = (row: AccountPostingCombinedRow) => {
  if (row.documentKind === "VOUCHER") {
    return toText(row.documentType).toLowerCase() || "voucher";
  }

  return [toText(row.documentType), toText(row.tradeMode).toLowerCase()]
    .filter(Boolean)
    .join(" ");
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
    private readonly accountPostingsCombinedQuery: AccountPostingsCombinedQuery,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
  ) {}

  private resolveFilters(query: SpecialReportQueryDto) {
    const branchIds = [
      ...new Set(
        (query.branchIds ?? []).map((item) => item.trim()).filter(Boolean),
      ),
    ];
    const transactionNumbers = [
      ...new Set(
        (query.transactionNumbers ?? [])
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];

    if (branchIds.length === 0) {
      throw new BadRequestException("At least one branch is required");
    }

    const template =
      query.template ?? SpecialReportTemplateEnum.ACCOUNT_POSTING;
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

  private async resolveBranchLabels(branchIds: string[]) {
    const branches = await this.branchRepository.find({
      where: { id: In(branchIds) },
    });
    return new Map(
      branches.map((branch) => [
        branch.id,
        getSnapshotLabel({
          code: branch.code,
          name: branch.name,
          label: `${branch.code} - ${branch.name}`,
        }) || branch.id,
      ]),
    );
  }

  private buildRow(
    row: AccountPostingCombinedRow,
    branchLabelById: Map<string, string>,
  ): SpecialReportRow {
    const amount = Number(row.amount ?? 0);
    const isDebit = row.direction === "DEBIT";
    const branchLabel =
      branchLabelById.get(row.branchId) ||
      getSnapshotLabel(row.partySnapshot) ||
      row.branchId;
    const partyProfileCode = toText(row.partySnapshot?.code);
    const partyProfileName = getSnapshotLabel(row.partySnapshot);
    const dateLabel = formatDateOnly(row.transactionDate);
    const sortDateTime = row.transactionDate
      ? `${row.transactionDate}T${row.createdAt || "00:00:00.000Z"}`
      : row.createdAt;

    return {
      rowType: "ITEM",
      transactionId: row.documentId,
      sortBranch: branchLabel,
      sortDateTime,
      sortTransactionNumber: row.documentNumber ?? "",
      branch: branchLabel,
      type: formatDocumentTypeLabel(row),
      date: dateLabel,
      transactionNumber: row.documentNumber ?? "",
      accountCode: getSnapshotCode(row.accountSnapshot),
      accountName: getSnapshotName(row.accountSnapshot),
      partyProfileCode,
      partyProfileName,
      direction: row.direction,
      debit: isDebit ? formatNumber(amount, 2) : "0.00",
      credit: isDebit ? "0.00" : formatNumber(amount, 2),
    };
  }

  async buildReport(query: SpecialReportQueryDto) {
    const filters = this.resolveFilters(query);
    const [postings, branchLabelById] = await Promise.all([
      this.accountPostingsCombinedQuery.list({
        branchIds: filters.branchIds,
        documentNumbers: filters.transactionNumbers,
      }),
      this.resolveBranchLabels(filters.branchIds),
    ]);

    const rows = postings
      .map((posting) => this.buildRow(posting, branchLabelById))
      .sort((left, right) => {
        if (left.sortBranch !== right.sortBranch) {
          return left.sortBranch.localeCompare(right.sortBranch);
        }

        if (left.sortDateTime !== right.sortDateTime) {
          return compareIsoDateStrings(
            left.sortDateTime,
            right.sortDateTime,
            filters.sortBy,
          );
        }

        if (left.sortTransactionNumber !== right.sortTransactionNumber) {
          return left.sortTransactionNumber.localeCompare(
            right.sortTransactionNumber,
          );
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
    const sheetData = report.rows.map((row) => {
      const output: Record<string, string> = {};
      report.columns.forEach((column) => {
        output[column.key] = row[column.key] ?? "";
      });
      return output;
    });

    if (format === SpecialReportFormat.CSV) {
      const worksheet = XLSX.utils.json_to_sheet(sheetData, {
        header: report.columns.map((column) => column.key),
      });
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      return {
        buffer: Buffer.from(csv, "utf8"),
        contentType: "text/csv; charset=utf-8",
        filename: "special-reports-account-posting.csv",
      };
    }

    const worksheet = XLSX.utils.json_to_sheet(sheetData, {
      header: report.columns.map((column) => column.key),
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
