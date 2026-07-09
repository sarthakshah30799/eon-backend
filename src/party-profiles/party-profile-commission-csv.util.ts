import { BadRequestException } from "@nestjs/common";
import * as XLSX from "xlsx";
import {
  PartyProfileCommissionTypeEnum,
  type PartyProfileCommissionRuleValue,
} from "./types/party-profile-commission-rule.types";

const normalizeHeader = (value: string) =>
  value.trim().toLowerCase().replace(/[\s_-]+/g, '');

const escapeCsvCell = (value: string) => {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
};

const parseCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const normalizeCommissionRows = (
  rows: Record<string, unknown>[],
): PartyProfileCommissionRuleValue[] => {
  if (!rows.length) {
    return [];
  }

  const normalizeRecord = (row: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        normalizeHeader(key),
        String(value ?? "").trim(),
      ]),
    );

  return rows.map(row => {
    const normalizedRow = normalizeRecord(row);
    const rawType = String(
      normalizedRow.commissiontype ?? normalizedRow.rate ?? "",
    )
      .trim()
      .toUpperCase();

    const commissionType =
      rawType === "PERCENT" || rawType === "PERCENTAGE"
        ? PartyProfileCommissionTypeEnum.PERCENTAGE
        : rawType === "RATE" || rawType === "PAISA"
          ? PartyProfileCommissionTypeEnum.PAISA
          : null;

    if (!commissionType) {
      throw new BadRequestException(
        `Unsupported commission type "${normalizedRow.commissiontype ?? normalizedRow.rate ?? ""}"`,
      );
    }

    return {
      currencyCode: String(normalizedRow.currencycode ?? "").trim().toUpperCase(),
      productCode: String(normalizedRow.productcode ?? "").trim().toUpperCase(),
      commissionType,
      commissionValue: String(normalizedRow.commissionvalue ?? "").trim(),
    } satisfies PartyProfileCommissionRuleValue;
  });
};

export const serializeCommissionRulesToCsv = (
  rules: PartyProfileCommissionRuleValue[],
) => {
  const header = [
    'currencyCode',
    'productCode',
    'commissionType',
    'commissionValue',
  ];

  const rows = rules.map(rule =>
    [
      rule.currencyCode,
      rule.productCode,
      rule.commissionType,
      rule.commissionValue,
    ]
      .map(value => escapeCsvCell(String(value ?? '')))
      .join(','),
  );

  return [header.join(','), ...rows].join('\n');
};

export const parseCommissionRulesCsv = (content: string) => {
  const normalized = content.replace(/^\uFEFF/, '').trim();

  if (!normalized) {
    return [] as PartyProfileCommissionRuleValue[];
  }

  const lines = normalized
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [] as PartyProfileCommissionRuleValue[];
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const columnIndex = {
    currencyCode: headers.indexOf('currencycode'),
    productCode: headers.indexOf('productcode'),
    commissionType:
      headers.indexOf('commissiontype') >= 0
        ? headers.indexOf('commissiontype')
        : headers.indexOf('rate'),
    commissionValue: headers.indexOf('commissionvalue'),
  };

  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const rawType = String(values[columnIndex.commissionType] ?? '')
      .trim()
      .toUpperCase();
    const commissionType =
      rawType === 'PERCENT' || rawType === 'PERCENTAGE'
        ? PartyProfileCommissionTypeEnum.PERCENTAGE
        : rawType === 'RATE' || rawType === 'PAISA'
          ? PartyProfileCommissionTypeEnum.PAISA
          : null;

    if (!commissionType) {
      throw new BadRequestException(
        `Unsupported commission type "${values[columnIndex.commissionType] ?? ''}"`,
      );
    }

    return {
      currencyCode: String(values[columnIndex.currencyCode] ?? '').trim().toUpperCase(),
      productCode: String(values[columnIndex.productCode] ?? '').trim().toUpperCase(),
      commissionType,
      commissionValue: String(values[columnIndex.commissionValue] ?? '').trim(),
    } satisfies PartyProfileCommissionRuleValue;
  });
};

export const parseCommissionRulesWorkbook = (buffer: Buffer) => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [] as PartyProfileCommissionRuleValue[];
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    return [] as PartyProfileCommissionRuleValue[];
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    blankrows: false,
  });

  if (!rows.length) {
    return [] as PartyProfileCommissionRuleValue[];
  }

  return normalizeCommissionRows(rows);
};
