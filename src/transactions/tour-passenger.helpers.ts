import { BadRequestException } from "@nestjs/common";
import * as XLSX from "xlsx";

export type TourPassengerPayload = {
  lineNo?: number | string | null;
  passportNumber?: string | null;
  passportName?: string | null;
  placeOfIssue?: string | null;
  dateOfIssue?: string | null;
  dateOfExpiry?: string | null;
  panHolderRelationship?: string | null;
  travellerPanNumber?: string | null;
  panName?: string | null;
  travellerDob?: string | null;
  fcnCode?: string | null;
  fcnAmount?: string | number | null;
  contactNo?: string | null;
  remark?: string | null;
  otherAdExchangeDate?: string | null;
  otherAdNameAddress?: string | null;
};

const HEADER_MAP: Record<string, keyof TourPassengerPayload> = {
  sno: "lineNo",
  "passport number": "passportNumber",
  "name as per passport": "passportName",
  "place of issue": "placeOfIssue",
  "date of issue": "dateOfIssue",
  "date of expiry": "dateOfExpiry",
  "relationship with pan holder": "panHolderRelationship",
  "traveller pan number": "travellerPanNumber",
  "name as per the pan": "panName",
  "traveller date of birth": "travellerDob",
  "fcn code": "fcnCode",
  "fcn amount": "fcnAmount",
  "contact no": "contactNo",
  remark: "remark",
  "date of exchange with other ad/ffmc": "otherAdExchangeDate",
  "name & address of ad branch /ffmc effected": "otherAdNameAddress",
};

const DATE_FIELDS = new Set<keyof TourPassengerPayload>([
  "dateOfIssue",
  "dateOfExpiry",
  "travellerDob",
  "otherAdExchangeDate",
]);

const AMOUNT_FIELDS = new Set<keyof TourPassengerPayload>(["fcnAmount"]);

const textOf = (value: unknown) => String(value ?? "").trim();

const normalizeHeader = (value: unknown) =>
  textOf(value).toLowerCase().replace(/\s+/g, " ");

export const excelValueToIsoDate = (value: unknown): string | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    const year = utc.getUTCFullYear();
    const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
    const day = String(utc.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = textOf(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const display = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (display) {
    return `${display[3]}-${display[2].padStart(2, "0")}-${display[1].padStart(2, "0")}`;
  }
  return null;
};

const amountText = (value: unknown): string | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount) : null;
};

export const parseTourPassengerWorkbook = (
  buffer: Buffer,
): TourPassengerPayload[] => {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new BadRequestException("The Excel file has no sheet");
  }
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  const header = (rows[0] ?? []).map(normalizeHeader);
  if (!header.includes("fcn code") || !header.includes("fcn amount")) {
    throw new BadRequestException(
      "The Excel file must include FCN CODE and FCN AMOUNT",
    );
  }
  return rows.slice(1).flatMap((row, index) => {
    const record: TourPassengerPayload = { lineNo: index + 1 };
    let hasValue = false;
    header.forEach((name, columnIndex) => {
      const key = HEADER_MAP[name];
      if (!key || key === "lineNo") {
        return;
      }
      const cell = row[columnIndex];
      if (DATE_FIELDS.has(key)) {
        record[key] = excelValueToIsoDate(cell) as never;
      } else if (AMOUNT_FIELDS.has(key)) {
        record[key] = amountText(cell) as never;
      } else {
        record[key] = textOf(cell) || null;
      }
      if (textOf(cell)) {
        hasValue = true;
      }
    });
    return hasValue ? [record] : [];
  });
};

export const assertTourPassengerQuantities = (
  rows: TourPassengerPayload[],
  quantityByCurrencyCode: Map<string, number>,
) => {
  if (!rows.length) {
    return;
  }
  const totals = new Map<string, number>();
  rows.forEach((row, index) => {
    const code = textOf(row.fcnCode).toUpperCase();
    const amount = Number(row.fcnAmount ?? NaN);
    if (!code || !Number.isFinite(amount)) {
      throw new BadRequestException(
        `Tour passenger row ${index + 1} needs FCN CODE and FCN AMOUNT`,
      );
    }
    totals.set(code, (totals.get(code) ?? 0) + amount);
  });
  totals.forEach((amount, code) => {
    const quantity = quantityByCurrencyCode.get(code) ?? 0;
    if (Math.abs(quantity - amount) > 0.0000001) {
      throw new BadRequestException(
        `${code} tour passenger FCN AMOUNT ${amount} does not match the sale quantity ${quantity}`,
      );
    }
  });
};
