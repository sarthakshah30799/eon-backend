import { BadRequestException } from "@nestjs/common";
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

export const serializeCommissionRulesToCsv = (
  rules: PartyProfileCommissionRuleValue[],
) => {
  const header = [
    'currencyCode',
    'currencyName',
    'productCode',
    'productDescription',
    'commissionType',
    'commissionValue',
  ];

  const rows = rules.map(rule =>
    [
      rule.currencyCode,
      rule.currencyName ?? '',
      rule.productCode,
      rule.productDescription ?? '',
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
    currencyName: headers.indexOf('currencyname'),
    productCode: headers.indexOf('productcode'),
    productDescription: headers.indexOf('productdescription'),
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
      currencyName: String(values[columnIndex.currencyName] ?? '').trim() || null,
      productCode: String(values[columnIndex.productCode] ?? '').trim().toUpperCase(),
      productDescription:
        String(values[columnIndex.productDescription] ?? '').trim() || null,
      commissionType,
      commissionValue: String(values[columnIndex.commissionValue] ?? '').trim(),
    } satisfies PartyProfileCommissionRuleValue;
  });
};
