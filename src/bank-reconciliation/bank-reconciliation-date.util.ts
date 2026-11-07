/**
 * Bank-reconciliation scoped date-only converter.
 * Kept local so shared punch/lock date helpers stay untouched.
 *
 * - `yyyy-MM-dd` strings are returned as-is
 * - JS Date from PostgreSQL `date` (local midnight) uses local calendar parts
 * - JS Date from timestamptz business dates (UTC midnight) stays the same day in IST
 */
export const toBankReconDateOnly = (value: unknown): string => {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    const isoPrefix = value.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoPrefix)) {
      return isoPrefix;
    }
  }

  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
