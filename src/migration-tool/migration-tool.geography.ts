import { CountryRiskCategory } from "../country/country.entity";
import {
  pickSourceString,
  toBoolean,
  toNullableNumber,
  toNullableString,
  type SourceRow,
} from "./migration-tool.mapping";

export const LEGACY_COUNTRY_TABLE_CANDIDATES = {
  ctrcountry: ["CTRCOUNTRY", "ctrcountry"],
  ctrcountry2: ["ctrcountry2", "CTRCOUNTRY2"],
  mstCountry: ["tb_MstCountry", "tb_mstcountry", "TBMSTCOUNTRY"],
  lrsCountry: ["LRSCountry", "LRSCOUNTRY", "lrscountry"],
} as const;

export const LEGACY_STATE_TABLE_CANDIDATES = {
  ctrState: ["CTRSTATE", "ctrstate"],
  customerState: ["CTR_CUSTOMERSTATE", "ctr_customerstate"],
  gstState: ["GSTSTATE", "gststate"],
} as const;

export const LEGACY_LOCATION_TYPE_TABLE_CANDIDATES = [
  "mstLocationType",
  "mstlocationtype",
  "MSTLOCATIONTYPE",
] as const;

export const LEGACY_CITY_TABLE_CANDIDATES = {
  city: ["CTRCITY", "ctrcity"],
  city2: ["CTRCITY2", "ctrcity2"],
} as const;

export const LEGACY_DISTRICT_TABLE_CANDIDATES = [
  "CTRDISTRICT",
  "ctrdistrict",
  "CTRDISTRICT2",
  "ctrdistrict2",
] as const;

const LEGACY_CITY_ID_KEYS = [
  "nCityID",
  "nCityId",
  "CityId",
  "CityID",
  "CITYID",
  "CITYCODE",
  "CityCode",
];

const LEGACY_CITY_NAME_KEYS = [
  "CITYNAME",
  "CityName",
  "vCityName",
  "vCity",
  "City",
];

const LEGACY_DISTRICT_ID_KEYS = [
  "nDistrictID",
  "nDistrictId",
  "DistrictId",
  "DISTRICTID",
  "DISTRICTCODE",
  "DistrictCode",
];

const LEGACY_DISTRICT_NAME_KEYS = [
  "DISTRICTNAME",
  "DistrictName",
  "vDistrictName",
  "vDistrict",
  "District",
];

const PLACE_ROW_ID_KEYS = [
  ...LEGACY_CITY_ID_KEYS,
  "id",
  "ID",
];

const PLACE_ROW_NAME_KEYS = [
  ...LEGACY_CITY_NAME_KEYS,
  "name",
  "Name",
];

const STATE_NAME_ALIASES: Record<string, string> = {
  uttranchal: "uttarakhand",
  uttaranchal: "uttarakhand",
  orissa: "odisha",
};

export type UnmappedLegacyField = {
  sourceTable: string;
  sourceColumn: string;
  sourceValue: string | number | boolean | null;
  reason: string;
};

export type CombinedLegacyCountry = {
  name: string;
  code: string;
  lrsCountryCode: string | null;
  ctrCountryCode: string | null;
  riskCategory: CountryRiskCategory;
  restrictedCountry: boolean;
  greyListCountry: boolean;
  baseCountry: boolean;
  ctrNumericCode: string | null;
  mstCountryId: string | null;
  lrsCountryId: string | null;
  mstCtrCode: string | null;
  sourceTables: string[];
  unmapped: UnmappedLegacyField[];
};

export type CombinedLegacyState = {
  name: string;
  code: string;
  gstStateCode: string | null;
  ctrStateCode: string | null;
  customerStateId: string | null;
  sourceTables: string[];
  unmapped: UnmappedLegacyField[];
};

export type CombinedLegacyCity = {
  cityCode: string;
  name: string;
  customerStateId: string | null;
  stateName: string | null;
  districtCode: string | null;
  districtName: string | null;
  sourceTables: string[];
};

export type MappedLocationType = {
  value: string;
  label: string;
  sortOrder: number;
  oldId: string | number | null;
};

export const normalizeGeographyName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const canonicalGeographyName = (value: string): string => {
  const normalized = normalizeGeographyName(value);
  return STATE_NAME_ALIASES[normalized] ?? normalized;
};

export const padGstStateCode = (value: any): string | null => {
  const text = toNullableString(value);
  if (!text) {
    return null;
  }
  if (!/^\d{1,2}$/.test(text)) {
    return text.length <= 20 ? text : null;
  }
  return text.padStart(2, "0");
};

const titleFromLegacyName = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed !== trimmed.toUpperCase()) {
    return trimmed;
  }
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((part) =>
      part === "and" || part === "of" || part === "the"
        ? part
        : `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(" ");
};

const preferDisplayName = (
  current: string | null,
  incoming: string | null,
): string => {
  const next = toNullableString(incoming);
  if (!next) {
    return current ?? "";
  }
  if (!current) {
    return titleFromLegacyName(next);
  }
  const currentIsUpper = current === current.toUpperCase();
  const incomingIsMixed = next !== next.toUpperCase();
  if (currentIsUpper && incomingIsMixed) {
    return next.trim();
  }
  return current;
};

export const mapCountryRiskCategory = (value: any): CountryRiskCategory => {
  const text = toNullableString(value)?.toLowerCase() ?? "";
  if (text === CountryRiskCategory.High || text === "high") {
    return CountryRiskCategory.High;
  }
  if (text === CountryRiskCategory.Medium || text === "medium") {
    return CountryRiskCategory.Medium;
  }
  return CountryRiskCategory.Low;
};

const pushUnmapped = (
  target: UnmappedLegacyField[],
  field: UnmappedLegacyField,
) => {
  if (field.sourceValue === null || field.sourceValue === "") {
    return;
  }
  target.push(field);
};

export const combineLegacyCountries = (params: {
  ctrRows?: SourceRow[];
  ctr2Rows?: SourceRow[];
  mstRows?: SourceRow[];
  lrsRows?: SourceRow[];
}): CombinedLegacyCountry[] => {
  const byName = new Map<string, CombinedLegacyCountry>();

  const ensure = (rawName: string | null): CombinedLegacyCountry | null => {
    const name = toNullableString(rawName);
    if (!name) {
      return null;
    }
    const key = canonicalGeographyName(name);
    const existing = byName.get(key);
    if (existing) {
      existing.name = preferDisplayName(existing.name, name);
      return existing;
    }
    const created: CombinedLegacyCountry = {
      name: titleFromLegacyName(name),
      code: "",
      lrsCountryCode: null,
      ctrCountryCode: null,
      riskCategory: CountryRiskCategory.Low,
      restrictedCountry: false,
      greyListCountry: false,
      baseCountry: false,
      ctrNumericCode: null,
      mstCountryId: null,
      lrsCountryId: null,
      mstCtrCode: null,
      sourceTables: [],
      unmapped: [],
    };
    byName.set(key, created);
    return created;
  };

  const addSource = (country: CombinedLegacyCountry, table: string) => {
    if (!country.sourceTables.includes(table)) {
      country.sourceTables.push(table);
    }
  };

  const applyCtrRow = (row: SourceRow, table: string) => {
    const country = ensure(
      toNullableString(row.COUNTRYNAME) ?? toNullableString(row.CountryName),
    );
    if (!country) {
      return;
    }
    addSource(country, table);
    const ctrCode =
      toNullableString(row.COUNTRYCODE) ?? toNullableString(row.CountryCode);
    if (ctrCode) {
      country.ctrNumericCode = country.ctrNumericCode ?? ctrCode;
      country.ctrCountryCode = country.ctrCountryCode ?? ctrCode;
    }
  };

  for (const row of params.ctrRows ?? []) {
    applyCtrRow(row, "CTRCOUNTRY");
  }
  for (const row of params.ctr2Rows ?? []) {
    applyCtrRow(row, "ctrcountry2");
  }

  for (const row of params.mstRows ?? []) {
    const country = ensure(
      toNullableString(row.CountryName) ?? toNullableString(row.COUNTRYNAME),
    );
    if (!country) {
      continue;
    }
    addSource(country, "tb_MstCountry");
    const iso =
      toNullableString(row.LRSCode) ?? toNullableString(row.lrsCode);
    if (iso) {
      country.lrsCountryCode = country.lrsCountryCode ?? iso;
      country.code = country.code || iso;
    }
    const mstId =
      toNullableString(row.CountryId) ?? toNullableString(row.CountryID);
    if (mstId) {
      country.mstCountryId = country.mstCountryId ?? mstId;
    }
    const mstCtr =
      toNullableString(row.CTRCode) ?? toNullableString(row.ctrCode);
    if (mstCtr) {
      country.mstCtrCode = country.mstCtrCode ?? mstCtr;
      country.ctrCountryCode = country.ctrCountryCode ?? mstCtr;
    }
    country.riskCategory = mapCountryRiskCategory(row.RiskCateg);
    country.restrictedCountry = toBoolean(row.bIsRestricted);
    country.greyListCountry = toBoolean(row.bIsGreyList);
    country.baseCountry = toBoolean(row.IsBaseCountry);
    pushUnmapped(country.unmapped, {
      sourceTable: "tb_MstCountry",
      sourceColumn: "Nationality",
      sourceValue: toNullableString(row.Nationality),
      reason: "countries has no nationality column; passenger nationality stays on category_options",
    });
    pushUnmapped(country.unmapped, {
      sourceTable: "tb_MstCountry",
      sourceColumn: "LimitCategory",
      sourceValue: toNullableString(row.LimitCategory),
      reason: "No country-level limit category on countries; country_groups not sourced this wave",
    });
    pushUnmapped(country.unmapped, {
      sourceTable: "tb_MstCountry",
      sourceColumn: "Limits",
      sourceValue: toNullableNumber(row.Limits),
      reason: "No country-level sell limit on countries",
    });
    pushUnmapped(country.unmapped, {
      sourceTable: "tb_MstCountry",
      sourceColumn: "RestrictedReason",
      sourceValue: toNullableString(row.RestrictedReason),
      reason: "restrictedCountry is a boolean; reason is not stored on countries",
    });
    pushUnmapped(country.unmapped, {
      sourceTable: "tb_MstCountry",
      sourceColumn: "bActive",
      sourceValue: row.bActive ?? null,
      reason: "countries has no isActive flag; row is still cloned",
    });
  }

  for (const row of params.lrsRows ?? []) {
    const country = ensure(
      toNullableString(row.CountryName) ?? toNullableString(row.COUNTRYNAME),
    );
    if (!country) {
      continue;
    }
    addSource(country, "LRSCountry");
    const iso =
      toNullableString(row.CountryCode) ?? toNullableString(row.COUNTRYCODE);
    if (iso) {
      country.lrsCountryCode = country.lrsCountryCode ?? iso;
      country.code = country.code || iso;
    }
    const lrsId =
      toNullableString(row.CountryID) ?? toNullableString(row.CountryId);
    if (lrsId) {
      country.lrsCountryId = country.lrsCountryId ?? lrsId;
    }
  }

  return [...byName.values()].map((country) => {
    if (!country.code) {
      country.code =
        country.lrsCountryCode ??
        country.ctrNumericCode ??
        country.mstCountryId ??
        canonicalGeographyName(country.name).replace(/\s+/g, "").slice(0, 20);
    }
    if (!country.ctrCountryCode) {
      country.ctrCountryCode = country.ctrNumericCode ?? country.mstCtrCode;
    }
    return country;
  });
};

export const combineLegacyStates = (params: {
  ctrRows?: SourceRow[];
  customerRows?: SourceRow[];
  gstRows?: SourceRow[];
}): CombinedLegacyState[] => {
  const byName = new Map<string, CombinedLegacyState>();

  const ensure = (rawName: string | null): CombinedLegacyState | null => {
    const name = toNullableString(rawName);
    if (!name) {
      return null;
    }
    const key = canonicalGeographyName(name);
    const existing = byName.get(key);
    if (existing) {
      existing.name = preferDisplayName(existing.name, name);
      return existing;
    }
    const created: CombinedLegacyState = {
      name: titleFromLegacyName(name),
      code: "",
      gstStateCode: null,
      ctrStateCode: null,
      customerStateId: null,
      sourceTables: [],
      unmapped: [],
    };
    byName.set(key, created);
    return created;
  };

  const addSource = (state: CombinedLegacyState, table: string) => {
    if (!state.sourceTables.includes(table)) {
      state.sourceTables.push(table);
    }
  };

  for (const row of params.ctrRows ?? []) {
    const state = ensure(
      toNullableString(row.STATENAME) ?? toNullableString(row.StateName),
    );
    if (!state) {
      continue;
    }
    addSource(state, "CTRSTATE");
    const code =
      toNullableString(row.STATECODE) ?? toNullableString(row.StateCode);
    if (code) {
      state.ctrStateCode = state.ctrStateCode ?? code;
      state.code = state.code || code;
    }
  }

  for (const row of params.customerRows ?? []) {
    const state = ensure(
      toNullableString(row.CUSTOMERSTATEDESC) ??
        toNullableString(row.CustomerStateDesc),
    );
    if (!state) {
      continue;
    }
    addSource(state, "CTR_CUSTOMERSTATE");
    const customerId =
      toNullableString(row.CUSTOMERSTATEID) ??
      toNullableString(row.CustomerStateId);
    if (customerId) {
      state.customerStateId = state.customerStateId ?? customerId;
    }
    const gstFromCustomer = padGstStateCode(
      row.CUSTOMERSTATEID2 ?? row.CustomerStateId2,
    );
    if (gstFromCustomer) {
      state.gstStateCode = state.gstStateCode ?? gstFromCustomer;
    }
  }

  for (const row of params.gstRows ?? []) {
    const state = ensure(
      toNullableString(row.State) ??
        toNullableString(row.STATENAME) ??
        toNullableString(row.StateName),
    );
    if (!state) {
      continue;
    }
    addSource(state, "GSTSTATE");
    const gst = padGstStateCode(
      row["State code"] ?? row.StateCode ?? row.STATECODE,
    );
    if (gst) {
      state.gstStateCode = state.gstStateCode ?? gst;
    }
  }

  return [...byName.values()].map((state) => {
    if (!state.code) {
      state.code =
        state.ctrStateCode ??
        state.gstStateCode ??
        (state.customerStateId ? `CS${state.customerStateId}` : "");
    }
    return state;
  });
};

export const combineLegacyCities = (params: {
  cityRows?: SourceRow[];
  city2Rows?: SourceRow[];
}): CombinedLegacyCity[] => {
  const byCode = new Map<string, CombinedLegacyCity>();

  const apply = (row: SourceRow, table: string) => {
    const cityCode =
      toNullableString(row.CITYCODE) ?? toNullableString(row.CityCode);
    const name =
      toNullableString(row.CITYNAME) ?? toNullableString(row.CityName);
    if (!cityCode || !name) {
      return;
    }
    const existing = byCode.get(cityCode) ?? {
      cityCode,
      name,
      customerStateId: null,
      stateName: null,
      districtCode: null,
      districtName: null,
      sourceTables: [],
    };
    existing.name = preferDisplayName(existing.name, name);
    existing.customerStateId =
      existing.customerStateId ??
      toNullableString(row.STATECODE) ??
      toNullableString(row.StateCode);
    existing.stateName =
      preferDisplayName(
        existing.stateName,
        toNullableString(row.STATENAME) ?? toNullableString(row.StateName),
      ) || existing.stateName;
    existing.districtCode =
      existing.districtCode ??
      toNullableString(row.DISTRICTCODE) ??
      toNullableString(row.DistrictCode);
    existing.districtName =
      preferDisplayName(
        existing.districtName,
        toNullableString(row.DISTRICTNAME) ??
          toNullableString(row.DistrictName),
      ) || existing.districtName;
    if (!existing.sourceTables.includes(table)) {
      existing.sourceTables.push(table);
    }
    byCode.set(cityCode, existing);
  };

  for (const row of params.cityRows ?? []) {
    apply(row, "CTRCITY");
  }
  for (const row of params.city2Rows ?? []) {
    apply(row, "CTRCITY2");
  }
  return [...byCode.values()];
};

export const cityNameLookupFromCities = (
  cities: CombinedLegacyCity[],
): LegacyPlaceLookup => {
  const lookup: LegacyPlaceLookup = new Map();
  for (const city of cities) {
    if (!lookup.has(city.cityCode)) {
      lookup.set(city.cityCode, city.name);
    }
    const nameKey = canonicalGeographyName(city.name);
    if (!lookup.has(nameKey)) {
      lookup.set(nameKey, city.name);
    }
  }
  return lookup;
};

export const districtLookupFromCities = (
  cities: CombinedLegacyCity[],
): LegacyPlaceLookup => {
  const lookup: LegacyPlaceLookup = new Map();
  for (const city of cities) {
    if (city.districtCode && city.districtName && !lookup.has(city.districtCode)) {
      lookup.set(city.districtCode, city.districtName);
    }
  }
  return lookup;
};

export const mapLegacyLocationType = (row: SourceRow): MappedLocationType => {
  const oldId = row.LId ?? row.LID ?? row.lid ?? row.id ?? row.ID ?? null;
  const value = toNullableString(oldId) ?? "0";
  return {
    value,
    label: toNullableString(row.LName) ?? toNullableString(row.lname) ?? value,
    sortOrder: toNullableNumber(oldId) ?? 0,
    oldId,
  };
};

export const countryLookupKeys = (
  country: CombinedLegacyCountry,
): string[] => {
  const keys = [
    country.code ? `code:${country.code}` : null,
    country.lrsCountryCode ? `lrs-code:${country.lrsCountryCode}` : null,
    country.ctrCountryCode ? `ctr:${country.ctrCountryCode}` : null,
    country.ctrNumericCode ? `ctr:${country.ctrNumericCode}` : null,
    country.mstCtrCode ? `mst-ctr:${country.mstCtrCode}` : null,
    country.mstCountryId ? `mst:${country.mstCountryId}` : null,
    country.lrsCountryId ? `lrs:${country.lrsCountryId}` : null,
    country.ctrNumericCode,
    country.mstCountryId,
    country.lrsCountryId,
    country.code,
    `name:${canonicalGeographyName(country.name)}`,
  ];
  return [...new Set(keys.filter((key): key is string => Boolean(key)))];
};

export const stateLookupKeys = (state: CombinedLegacyState): string[] => {
  const keys = [
    state.code ? `code:${state.code}` : null,
    state.ctrStateCode ? `ctr:${state.ctrStateCode}` : null,
    state.gstStateCode ? `gst:${state.gstStateCode}` : null,
    state.customerStateId ? `cust:${state.customerStateId}` : null,
    state.code,
    state.ctrStateCode,
    state.gstStateCode,
    `name:${canonicalGeographyName(state.name)}`,
  ];
  return [...new Set(keys.filter((key): key is string => Boolean(key)))];
};

export const looksLikeLegacyLookupId = (value: any): boolean => {
  const text = toNullableString(value);
  return Boolean(text && /^\d+$/.test(text));
};

export const pickFirstSourceField = (
  row: SourceRow,
  keys: string[],
): { key: string; value: string } | null => {
  for (const key of keys) {
    const value = toNullableString(row[key]);
    if (value) {
      return { key, value };
    }
  }
  return null;
};

export type LegacyPlaceLookup = Map<string, string>;

export const indexLegacyPlaceRows = (
  rows: SourceRow[],
): LegacyPlaceLookup => {
  const lookup: LegacyPlaceLookup = new Map();
  for (const row of rows) {
    const name = pickSourceString(row, PLACE_ROW_NAME_KEYS);
    if (!name) {
      continue;
    }
    for (const key of PLACE_ROW_ID_KEYS) {
      const id = toNullableString(row[key]);
      if (id && !lookup.has(id)) {
        lookup.set(id, name);
      }
    }
    const nameKey = canonicalGeographyName(name);
    if (!lookup.has(nameKey)) {
      lookup.set(nameKey, name);
    }
  }
  return lookup;
};

export const mergeLegacyPlaceLookups = (
  lookups: LegacyPlaceLookup[],
): LegacyPlaceLookup => {
  const merged: LegacyPlaceLookup = new Map();
  for (const lookup of lookups) {
    for (const [key, value] of lookup) {
      if (!merged.has(key)) {
        merged.set(key, value);
      }
    }
  }
  return merged;
};

export type ResolvedLegacyPlace = {
  value: string;
  raw: string | null;
  sourceColumn: string | null;
  resolvedFrom: "id" | "name" | "passthrough" | "missing" | "unresolved-id";
};

export const resolveLegacyPlaceText = (
  raw: { key: string; value: string } | string | null | undefined,
  lookup: LegacyPlaceLookup,
  fallback: string,
): ResolvedLegacyPlace => {
  let field: { key: string; value: string } | null = null;
  if (typeof raw === "string") {
    field = { key: "value", value: raw };
  } else if (raw) {
    field = raw;
  }
  if (!field) {
    return {
      value: fallback,
      raw: null,
      sourceColumn: null,
      resolvedFrom: "missing",
    };
  }

  const fromId = lookup.get(field.value);
  if (fromId) {
    return {
      value: fromId,
      raw: field.value,
      sourceColumn: field.key,
      resolvedFrom: looksLikeLegacyLookupId(field.value) ? "id" : "name",
    };
  }

  const fromName = lookup.get(canonicalGeographyName(field.value));
  if (fromName) {
    return {
      value: fromName,
      raw: field.value,
      sourceColumn: field.key,
      resolvedFrom: "name",
    };
  }

  if (looksLikeLegacyLookupId(field.value)) {
    return {
      value: fallback,
      raw: field.value,
      sourceColumn: field.key,
      resolvedFrom: "unresolved-id",
    };
  }

  return {
    value: field.value,
    raw: field.value,
    sourceColumn: field.key,
    resolvedFrom: "passthrough",
  };
};

export const pickLegacyCityReference = (
  row: SourceRow,
): { key: string; value: string } | null =>
  pickFirstSourceField(row, [
    ...LEGACY_CITY_ID_KEYS,
    "vCity",
    ...LEGACY_CITY_NAME_KEYS,
  ]);

export const pickLegacyDistrictReference = (
  row: SourceRow,
): { key: string; value: string } | null =>
  pickFirstSourceField(row, [
    ...LEGACY_DISTRICT_ID_KEYS,
    "vDistrict",
    ...LEGACY_DISTRICT_NAME_KEYS,
  ]);

export const findLegacyCity = (
  raw: string | null | undefined,
  cityByCode: Map<string, CombinedLegacyCity>,
): CombinedLegacyCity | null => {
  const text = toNullableString(raw);
  if (!text) {
    return null;
  }
  return (
    cityByCode.get(text) ??
    [...cityByCode.values()].find(
      (city) => canonicalGeographyName(city.name) === canonicalGeographyName(text),
    ) ??
    null
  );
};

export type ResolvedLegacyCity = ResolvedLegacyPlace & {
  city: CombinedLegacyCity | null;
};

export const resolveLegacyRecordCity = (
  row: SourceRow,
  params: {
    nameLookup: LegacyPlaceLookup;
    cityByCode?: Map<string, CombinedLegacyCity>;
    fallback?: string;
  },
): ResolvedLegacyCity => {
  const fallback = params.fallback ?? "UNKNOWN";
  const resolved = resolveLegacyPlaceText(
    pickLegacyCityReference(row),
    params.nameLookup,
    fallback,
  );
  const city = params.cityByCode
    ? findLegacyCity(resolved.raw, params.cityByCode) ??
      findLegacyCity(resolved.value, params.cityByCode)
    : null;
  return {
    ...resolved,
    city,
  };
};

export const collectBranchStateLookupValues = (
  row: SourceRow,
  cityByCode?: Map<string, CombinedLegacyCity>,
): string[] => {
  const values: string[] = [];
  const gstNo = toNullableString(row.vServiceTaxRegNo);
  if (gstNo && gstNo.length >= 2) {
    values.push(padGstStateCode(gstNo.slice(0, 2)) ?? gstNo.slice(0, 2));
  }
  const std = padGstStateCode(row.STDCode);
  if (std) {
    values.push(std);
  }
  const location = toNullableString(row.vLocation);
  if (location) {
    values.push(location);
  }
  const city = findLegacyCity(
    pickLegacyCityReference(row)?.value,
    cityByCode ?? new Map(),
  );
  if (city?.customerStateId) {
    values.push(city.customerStateId);
  }
  if (city?.stateName) {
    values.push(city.stateName);
  }
  return [...new Set(values)];
};
