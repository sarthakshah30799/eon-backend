export function parseDateValue(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toUtcDateOnly(value: string | Date | null | undefined): Date {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return new Date();
  }

  const isoDate = parsed.toISOString().slice(0, 10);
  return new Date(`${isoDate}T00:00:00.000Z`);
}
