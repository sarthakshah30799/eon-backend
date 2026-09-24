import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import * as XLSX from "xlsx";
import { Branch } from "../branches/branch.entity";
import { ReportSortBy } from "../reports/dto/report-sort.dto";
import {
  SpecialReportFormat,
  SpecialReportQueryDto,
} from "../reports/dto/special-report-query.dto";
import { SpecialReport } from "./entities/special-report.entity";
import {
  SPECIAL_REPORT_ACCOUNT_POSTING,
  SPECIAL_REPORT_SENSITIVE_COLUMN_NAMES,
  SPECIAL_REPORT_SENSITIVE_COLUMN_PATTERN,
} from "./special-report.constants";
import {
  assertSelectOnlySql,
  bindNamedSqlParameters,
  extractNamedParameterNames,
} from "./special-report-sql.util";

type SpecialReportColumn = {
  key: string;
  label: string;
};

type SpecialReportRow = Record<string, string> & {
  rowType: "ITEM";
};

const toText = (value: unknown) => {
  if (value === undefined || value === null) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value).trim();
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

const isSensitiveColumn = (key: string) => {
  const normalized = key.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (SPECIAL_REPORT_SENSITIVE_COLUMN_NAMES.has(normalized)) {
    return true;
  }

  return SPECIAL_REPORT_SENSITIVE_COLUMN_PATTERN.test(normalized);
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

const slugifyReportType = (reportType: string) =>
  reportType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "special-report";

@Injectable()
export class SpecialReportService {
  constructor(
    @InjectRepository(SpecialReport, "database2")
    private readonly specialReportRepository: Repository<SpecialReport>,
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
  ) {}

  async listTypes() {
    const reports = await this.specialReportRepository.find({
      where: { active: true },
      order: { name: "ASC" },
    });

    return reports.map((report) => ({
      id: report.type,
      label: report.name,
    }));
  }

  private async findActiveByType(reportType: string) {
    const normalizedType = reportType.trim();
    if (!normalizedType) {
      throw new BadRequestException("Special report type is required");
    }

    const report = await this.specialReportRepository.findOne({
      where: {
        type: normalizedType,
        active: true,
      },
    });

    if (!report) {
      throw new NotFoundException(
        `Special report type "${normalizedType}" was not found`,
      );
    }

    return report;
  }

  private resolveAccountPostingParams(query: SpecialReportQueryDto) {
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

    return {
      branchIds,
      transactionNumbers,
      sortBy: query.sortBy ?? ReportSortBy.DATE_ASC,
    };
  }

  private resolveBindParams(
    reportType: string,
    parameterNames: string[],
    query: SpecialReportQueryDto,
  ): { params: Record<string, unknown>; sortBy?: ReportSortBy } {
    const isAccountPosting =
      reportType.toUpperCase() === SPECIAL_REPORT_ACCOUNT_POSTING;

    if (!isAccountPosting) {
      if (parameterNames.length > 0) {
        throw new BadRequestException(
          `Report type "${reportType}" query has parameters that are not applied for this report type`,
        );
      }

      return { params: {} };
    }

    const accountPostingParams = this.resolveAccountPostingParams(query);
    const params: Record<string, unknown> = {};

    for (const name of parameterNames) {
      if (name === "branchIds") {
        params.branchIds = accountPostingParams.branchIds;
        continue;
      }

      if (name === "transactionNumbers") {
        params.transactionNumbers =
          accountPostingParams.transactionNumbers;
        continue;
      }

      throw new BadRequestException(
        `Unsupported report parameter "${name}" for account posting`,
      );
    }

    if (parameterNames.includes("branchIds") === false) {
      throw new BadRequestException(
        'Account posting report query must include ":branchIds" or ":...branchIds"',
      );
    }

    return {
      params,
      sortBy: accountPostingParams.sortBy,
    };
  }

  private async resolveBranchLabels(branchIds: string[]) {
    if (branchIds.length === 0) {
      return new Map<string, string>();
    }

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

  private sanitizeRows(rawRows: Record<string, unknown>[]) {
    return rawRows.map((rawRow) => {
      const row: Record<string, string> = {};
      Object.entries(rawRow).forEach(([key, value]) => {
        if (isSensitiveColumn(key)) {
          return;
        }
        row[key] = toText(value);
      });
      return row;
    });
  }

  private async enrichAccountPostingRows(rows: Record<string, string>[]) {
    const branchIds = [
      ...new Set(
        rows
          .map((row) => row.branchId || row.branch_id)
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    if (branchIds.length === 0) {
      return rows;
    }

    const branchLabelById = await this.resolveBranchLabels(branchIds);

    return rows.map((row) => {
      const branchId = (row.branchId || row.branch_id || "").trim();
      const next = { ...row };
      if (branchId) {
        next.branch =
          branchLabelById.get(branchId) || next.branch || branchId;
        delete next.branchId;
        delete next.branch_id;
      }
      return next;
    });
  }

  private buildColumns(rows: Record<string, string>[]): SpecialReportColumn[] {
    const keys: string[] = [];
    const seen = new Set<string>();
    const hiddenKeys = new Set([
      "rowType",
      "branchId",
      "branch_id",
      "sortBranch",
      "sortDateTime",
      "sortTransactionNumber",
      "transactionId",
    ]);

    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (
          hiddenKeys.has(key) ||
          seen.has(key) ||
          isSensitiveColumn(key)
        ) {
          return;
        }
        seen.add(key);
        keys.push(key);
      });
    });

    return keys.map((key) => ({ key, label: key }));
  }

  private sortAccountPostingRows(
    rows: SpecialReportRow[],
    sortBy: ReportSortBy,
  ) {
    return [...rows].sort((left, right) => {
      const leftBranch = left.branch || left.sortBranch || "";
      const rightBranch = right.branch || right.sortBranch || "";
      if (leftBranch !== rightBranch) {
        return leftBranch.localeCompare(rightBranch);
      }

      const leftDate =
        left.sortDateTime || left.date || left.transactionDate || "";
      const rightDate =
        right.sortDateTime || right.date || right.transactionDate || "";
      if (leftDate !== rightDate) {
        return compareIsoDateStrings(leftDate, rightDate, sortBy);
      }

      const leftNumber =
        left.sortTransactionNumber || left.transactionNumber || "";
      const rightNumber =
        right.sortTransactionNumber || right.transactionNumber || "";
      return leftNumber.localeCompare(rightNumber);
    });
  }

  async buildReport(query: SpecialReportQueryDto) {
    const template =
      query.template?.trim() || SPECIAL_REPORT_ACCOUNT_POSTING;
    const definition = await this.findActiveByType(template);

    assertSelectOnlySql(definition.query);

    const parameterNames = extractNamedParameterNames(definition.query);
    const { params, sortBy } = this.resolveBindParams(
      definition.type,
      parameterNames,
      query,
    );

    let rawRows: Record<string, unknown>[];
    try {
      if (parameterNames.length === 0) {
        rawRows = await this.database2.query(definition.query);
      } else {
        const bound = bindNamedSqlParameters(definition.query, params);
        rawRows = await this.database2.query(bound.text, bound.values);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to execute report query";
      throw new BadRequestException(message);
    }

    let sanitized = this.sanitizeRows(rawRows ?? []);

    const isAccountPosting =
      definition.type.toUpperCase() === SPECIAL_REPORT_ACCOUNT_POSTING;
    if (isAccountPosting) {
      sanitized = await this.enrichAccountPostingRows(sanitized);
    }

    let rows: SpecialReportRow[] = sanitized.map((row) => ({
      ...row,
      rowType: "ITEM",
    }));

    if (isAccountPosting && sortBy) {
      rows = this.sortAccountPostingRows(rows, sortBy);
    }

    return {
      columns: this.buildColumns(rows),
      rows,
      template: definition.type,
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

    const fileSlug = slugifyReportType(report.template);

    if (format === SpecialReportFormat.CSV) {
      const worksheet = XLSX.utils.json_to_sheet(sheetData, {
        header: report.columns.map((column) => column.key),
      });
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      return {
        buffer: Buffer.from(csv, "utf8"),
        contentType: "text/csv; charset=utf-8",
        filename: `special-reports-${fileSlug}.csv`,
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
      filename: `special-reports-${fileSlug}.xlsx`,
    };
  }
}
