import { TransactionTypeProfileEnum } from "../transactions/transactions.enums";

export const FlmFfmcProfileType = {
  FFMC: "FFMC",
  RMC: "RMC",
  FOREX: "FOREX",
  FOREIGN: "FOREIGN",
  MISC: "MISC",
  FRANCHISE: "FRANCHISE",
} as const;

export type FlmFfmcProfileType =
  (typeof FlmFfmcProfileType)[keyof typeof FlmFfmcProfileType];

export const FLM_FFMC_PROFILE_TYPES = Object.values(FlmFfmcProfileType);

const FLM4_PROFILE_SLUG_BY_TYPE: Record<
  FlmFfmcProfileType,
  (typeof TransactionTypeProfileEnum)[keyof typeof TransactionTypeProfileEnum]
> = {
  [FlmFfmcProfileType.FFMC]: TransactionTypeProfileEnum.PURCHASE_FFMC,
  [FlmFfmcProfileType.RMC]: TransactionTypeProfileEnum.PURCHASE_RMC,
  [FlmFfmcProfileType.FOREX]: TransactionTypeProfileEnum.PURCHASE_FOREX,
  [FlmFfmcProfileType.FOREIGN]: TransactionTypeProfileEnum.PURCHASE_FOREIGN,
  [FlmFfmcProfileType.MISC]: TransactionTypeProfileEnum.PURCHASE_MISC,
  [FlmFfmcProfileType.FRANCHISE]: TransactionTypeProfileEnum.PURCHASE_FRANCHISE,
};

const FLM6_PROFILE_SLUG_BY_TYPE: Record<
  FlmFfmcProfileType,
  (typeof TransactionTypeProfileEnum)[keyof typeof TransactionTypeProfileEnum]
> = {
  [FlmFfmcProfileType.FFMC]: TransactionTypeProfileEnum.SALE_FFMC,
  [FlmFfmcProfileType.RMC]: TransactionTypeProfileEnum.SALE_RMC,
  [FlmFfmcProfileType.FOREX]: TransactionTypeProfileEnum.SALE_FOREX,
  [FlmFfmcProfileType.FOREIGN]: TransactionTypeProfileEnum.SALE_FOREIGN,
  [FlmFfmcProfileType.MISC]: TransactionTypeProfileEnum.SALE_MISC,
  [FlmFfmcProfileType.FRANCHISE]: TransactionTypeProfileEnum.SALE_FRANCHISE,
};

const resolveProfileTypes = (profileTypes?: string[]) => {
  const selected = [
    ...new Set(
      (profileTypes ?? []).map((value) => String(value).trim().toUpperCase()),
    ),
  ].filter((value): value is FlmFfmcProfileType =>
    FLM_FFMC_PROFILE_TYPES.includes(value as FlmFfmcProfileType),
  );

  return selected.length ? selected : FLM_FFMC_PROFILE_TYPES;
};

export const resolveFlm4ProfileSlugs = (profileTypes?: string[]) =>
  resolveProfileTypes(profileTypes).map(
    (profileType) => FLM4_PROFILE_SLUG_BY_TYPE[profileType],
  );

export const resolveFlm6ProfileSlugs = (profileTypes?: string[]) =>
  resolveProfileTypes(profileTypes).map(
    (profileType) => FLM6_PROFILE_SLUG_BY_TYPE[profileType],
  );
