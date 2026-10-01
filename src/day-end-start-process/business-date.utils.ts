const DEFAULT_BUSINESS_TIME_ZONE = "Asia/Kolkata";

const isValidTimeZone = (timeZone: string): boolean => {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const resolveBusinessTimeZone = (
  timeZone?: string | null,
): string => {
  const normalized = String(timeZone ?? "").trim();
  if (normalized && isValidTimeZone(normalized)) {
    return normalized;
  }

  return DEFAULT_BUSINESS_TIME_ZONE;
};

/**
 * Calendar date (yyyy-MM-dd) for an instant in the business time zone.
 * BOD/EOD persistence uses Asia/Kolkata by default (not the server host locale).
 */
export const getBusinessDateOnly = (
  reference: Date = new Date(),
  timeZone?: string | null,
): string => {
  const resolvedTimeZone = resolveBusinessTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolvedTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
};

export const normalizeDateOnlyInput = (
  value: Date | string | null | undefined,
): string => {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return getBusinessDateOnly(date, "UTC");
};
