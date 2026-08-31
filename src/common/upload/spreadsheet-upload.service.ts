import { BadRequestException, Injectable } from "@nestjs/common";
import * as XLSX from "xlsx";

export type SpreadsheetRecord = Record<string, unknown>;

export type SpreadsheetRows = {
  headers: string[];
  records: SpreadsheetRecord[];
};

@Injectable()
export class SpreadsheetUploadService {
  readRows(buffer: Buffer, requiredHeaders: string[] = []): SpreadsheetRows {
    if (!buffer?.length) {
      throw new BadRequestException("Upload file is required");
    }
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      throw new BadRequestException("The uploaded file has no worksheet");
    }
    const rows = XLSX.utils.sheet_to_json<(string | number | Date)[]>(sheet, {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
    });
    if (rows.length < 2) {
      throw new BadRequestException(
        "The file must contain a header and at least one data row.",
      );
    }
    const headers = (rows[0] ?? []).map((value) =>
      String(value ?? "")
        .trim()
        .toLowerCase(),
    );
    const missing = requiredHeaders.filter(
      (header) => !headers.includes(header),
    );
    if (missing.length) {
      throw new BadRequestException(`Missing column(s): ${missing.join(", ")}`);
    }
    const records = rows
      .slice(1)
      .filter((row) => row.some((value) => String(value ?? "").trim()))
      .map((row) =>
        Object.fromEntries(
          headers.map((header, index) => [header, row[index]]),
        ),
      );
    if (!records.length) {
      throw new BadRequestException(
        "The file must contain a header and at least one data row.",
      );
    }
    return { headers, records };
  }

  parseDate(value: unknown): string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return this.toIsoDate(
        value.getFullYear(),
        value.getMonth() + 1,
        value.getDate(),
      );
    }
    const text = String(value ?? "").trim();
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      return this.toIsoDate(
        Number(match[3]),
        Number(match[2]),
        Number(match[1]),
      );
    }
    if (/^\d+(\.\d+)?$/.test(text)) {
      const parsed = XLSX.SSF.parse_date_code(Number(text));
      if (!parsed) return "";
      return this.toIsoDate(parsed.y, parsed.m, parsed.d);
    }
    return "";
  }

  writeTemplate(
    headers: string[],
    sampleRow: Array<string | number>,
    sheetName: string,
  ): Buffer {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([headers, sampleRow]),
      sheetName,
    );
    return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  }

  private toIsoDate(year: number, month: number, day: number) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const pad = (value: number) => String(value).padStart(2, "0");
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
      ? `${year}-${pad(month)}-${pad(day)}`
      : "";
  }
}
