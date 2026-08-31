import { ClientType } from "../party-profiles/party-profile.entity";
import { TransactionTypeProfileEnum } from "../transactions/transactions.enums";

/** Party profile types included in FLM 4 / FLM 6 (everything except corporate/individual and non-trade entities). */
export const FLM_FFMC_PARTY_PROFILE_TYPES = [
  ClientType.FFMC,
  ClientType.AUTHORISED_DEALER,
  ClientType.RMC,
  ClientType.FOREX_CORRESPONDENT,
  ClientType.FOREIGN_CORRESPONDENT,
  ClientType.MISC_PROFILE,
  ClientType.FRANCHISE,
] as const;

export type FlmFfmcPartyProfileType =
  (typeof FLM_FFMC_PARTY_PROFILE_TYPES)[number];

/** Legacy short codes still accepted from older URLs / clients. */
const LEGACY_PROFILE_TYPE_ALIASES: Record<string, FlmFfmcPartyProfileType> = {
  FOREX: ClientType.FOREX_CORRESPONDENT,
  FOREIGN: ClientType.FOREIGN_CORRESPONDENT,
  MISC: ClientType.MISC_PROFILE,
};

export const FLM_FFMC_PROFILE_TYPES = [
  ...FLM_FFMC_PARTY_PROFILE_TYPES,
  ...Object.keys(LEGACY_PROFILE_TYPE_ALIASES),
];

const FLM4_PROFILE_SLUG_BY_TYPE: Record<
  FlmFfmcPartyProfileType,
  (typeof TransactionTypeProfileEnum)[keyof typeof TransactionTypeProfileEnum]
> = {
  [ClientType.FFMC]: TransactionTypeProfileEnum.PURCHASE_FFMC,
  [ClientType.AUTHORISED_DEALER]: TransactionTypeProfileEnum.PURCHASE_FFMC,
  [ClientType.RMC]: TransactionTypeProfileEnum.PURCHASE_RMC,
  [ClientType.FOREX_CORRESPONDENT]: TransactionTypeProfileEnum.PURCHASE_FOREX,
  [ClientType.FOREIGN_CORRESPONDENT]:
    TransactionTypeProfileEnum.PURCHASE_FOREIGN,
  [ClientType.MISC_PROFILE]: TransactionTypeProfileEnum.PURCHASE_MISC,
  [ClientType.FRANCHISE]: TransactionTypeProfileEnum.PURCHASE_FRANCHISE,
};

const FLM6_PROFILE_SLUG_BY_TYPE: Record<
  FlmFfmcPartyProfileType,
  (typeof TransactionTypeProfileEnum)[keyof typeof TransactionTypeProfileEnum]
> = {
  [ClientType.FFMC]: TransactionTypeProfileEnum.SALE_FFMC,
  [ClientType.AUTHORISED_DEALER]: TransactionTypeProfileEnum.SALE_FFMC,
  [ClientType.RMC]: TransactionTypeProfileEnum.SALE_RMC,
  [ClientType.FOREX_CORRESPONDENT]: TransactionTypeProfileEnum.SALE_FOREX,
  [ClientType.FOREIGN_CORRESPONDENT]: TransactionTypeProfileEnum.SALE_FOREIGN,
  [ClientType.MISC_PROFILE]: TransactionTypeProfileEnum.SALE_MISC,
  [ClientType.FRANCHISE]: TransactionTypeProfileEnum.SALE_FRANCHISE,
};

const normalizeProfileType = (
  value: string,
): FlmFfmcPartyProfileType | null => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!normalized) {
    return null;
  }

  const aliased = LEGACY_PROFILE_TYPE_ALIASES[normalized];
  if (aliased) {
    return aliased;
  }

  return FLM_FFMC_PARTY_PROFILE_TYPES.includes(
    normalized as FlmFfmcPartyProfileType,
  )
    ? (normalized as FlmFfmcPartyProfileType)
    : null;
};

export const resolveFlmFfmcPartyProfileTypes = (profileTypes?: string[]) => {
  const selected = [
    ...new Set(
      (profileTypes ?? [])
        .map((value) => normalizeProfileType(value))
        .filter((value): value is FlmFfmcPartyProfileType => Boolean(value)),
    ),
  ];

  return selected.length ? selected : [...FLM_FFMC_PARTY_PROFILE_TYPES];
};

export const resolveFlm4ProfileFilter = (profileTypes?: string[]) => {
  const partyProfileTypes = resolveFlmFfmcPartyProfileTypes(profileTypes);
  const selectedSet = new Set(partyProfileTypes);
  const slugs = [
    ...new Set(
      partyProfileTypes.map(
        (profileType) => FLM4_PROFILE_SLUG_BY_TYPE[profileType],
      ),
    ),
  ];
  const allTypesSelected =
    partyProfileTypes.length === FLM_FFMC_PARTY_PROFILE_TYPES.length;
  const slugOnlyFallbackSlugs = allTypesSelected
    ? slugs
    : slugs.filter((slug) =>
        FLM_FFMC_PARTY_PROFILE_TYPES.filter(
          (profileType) => FLM4_PROFILE_SLUG_BY_TYPE[profileType] === slug,
        ).every((profileType) => selectedSet.has(profileType)),
      );

  return {
    partyProfileTypes: allTypesSelected ? undefined : partyProfileTypes,
    slugs,
    slugOnlyFallbackSlugs: allTypesSelected ? undefined : slugOnlyFallbackSlugs,
  };
};

export const resolveFlm6ProfileFilter = (profileTypes?: string[]) => {
  const partyProfileTypes = resolveFlmFfmcPartyProfileTypes(profileTypes);
  const selectedSet = new Set(partyProfileTypes);
  const slugs = [
    ...new Set(
      partyProfileTypes.map(
        (profileType) => FLM6_PROFILE_SLUG_BY_TYPE[profileType],
      ),
    ),
  ];
  const allTypesSelected =
    partyProfileTypes.length === FLM_FFMC_PARTY_PROFILE_TYPES.length;
  const slugOnlyFallbackSlugs = allTypesSelected
    ? slugs
    : slugs.filter((slug) =>
        FLM_FFMC_PARTY_PROFILE_TYPES.filter(
          (profileType) => FLM6_PROFILE_SLUG_BY_TYPE[profileType] === slug,
        ).every((profileType) => selectedSet.has(profileType)),
      );

  return {
    partyProfileTypes: allTypesSelected ? undefined : partyProfileTypes,
    slugs,
    slugOnlyFallbackSlugs: allTypesSelected ? undefined : slugOnlyFallbackSlugs,
  };
};

/** @deprecated Prefer resolveFlm4ProfileFilter */
export const resolveFlm4ProfileSlugs = (profileTypes?: string[]) =>
  resolveFlm4ProfileFilter(profileTypes).slugs;

/** @deprecated Prefer resolveFlm6ProfileFilter */
export const resolveFlm6ProfileSlugs = (profileTypes?: string[]) =>
  resolveFlm6ProfileFilter(profileTypes).slugs;
