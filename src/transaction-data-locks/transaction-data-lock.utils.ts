export const normalizeDateOnly = (value: Date | string | null | undefined): string => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const addDaysToDateOnly = (dateOnly: string, days: number): string => {
  const normalized = normalizeDateOnly(dateOnly);
  if (!normalized) {
    return "";
  }

  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return normalizeDateOnly(date);
};

export const getEarliestAllowedPunchDate = (lockedThroughDate: string): string =>
  addDaysToDateOnly(lockedThroughDate, 1);
