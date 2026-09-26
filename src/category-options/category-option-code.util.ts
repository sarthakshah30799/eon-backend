/**
 * Single normalize for category option codes.
 * Must match SelectOptionService / misc-profile storage
 * (underscores, spaces, and dashes stripped; uppercased).
 */
export const normalizeCategoryOptionCode = (code: string): string =>
  String(code ?? "")
    .trim()
    .replace(/[_\s-]/g, "")
    .toUpperCase();
