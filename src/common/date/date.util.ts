export function parseDateValue(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toDateOnlyString(
  value: string | Date | null | undefined,
): string | null {
  if (typeof value === "string") {
    const isoPrefix = value.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoPrefix)) {
      return isoPrefix;
    }
  }

  const parsed = parseDateValue(value);
  if (!parsed) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function toUtcDateOnly(value: string | Date | null | undefined): Date {
  const isoDate = toDateOnlyString(value);
  if (!isoDate) {
    return new Date();
  }

  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function toUtcNextDate(value: string | Date | null | undefined): Date | null {
  const isoDate = toDateOnlyString(value);
  if (!isoDate) {
    return null;
  }

  const next = new Date(`${isoDate}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
