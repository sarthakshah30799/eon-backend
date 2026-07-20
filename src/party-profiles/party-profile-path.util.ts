const PARTY_PROFILE_ROUTE_TYPE_MAP: Record<string, string> = {
  FOREIGN_CORRESPONDENT: 'foreign-correspondent',
  FOREX_CORRESPONDENT: 'forex-correspondent',
  MISC_PROFILE: 'misc-supplier-profile',
};

const normalizeDelimitedValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const toPartyProfileRouteType = (value?: string | null): string => {
  if (!value) {
    return '';
  }

  const normalizedValue = value.trim();
  const mappedRouteType = PARTY_PROFILE_ROUTE_TYPE_MAP[normalizedValue.toUpperCase()];
  if (mappedRouteType) {
    return mappedRouteType;
  }

  return normalizeDelimitedValue(normalizedValue);
};

export const toPartyProfileMenuPath = (value?: string | null): string => {
  const routeType = toPartyProfileRouteType(value);
  return routeType ? `/party-profiles/${routeType}` : '';
};
