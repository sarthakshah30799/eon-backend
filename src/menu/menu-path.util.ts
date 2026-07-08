export const normalizeMenuPath = (path?: string | null): string | null => {
  if (typeof path !== 'string') {
    return null;
  }

  const normalized = path
    .trim()
    .split('/')
    .map(segment => segment.trim().toLowerCase().replace(/\s+/g, '-'))
    .join('/')
    .replace(/\/{2,}/g, '/');

  if (normalized.length === 0) {
    return null;
  }

  const withLeadingSlash = normalized.startsWith('/')
    ? normalized
    : `/${normalized}`;

  return withLeadingSlash === '/' ? null : withLeadingSlash.replace(/\/+$/, '');
};
