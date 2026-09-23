import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import * as mssql from "mssql";
import * as bcrypt from "bcrypt";
import * as XLSX from "xlsx";
import { createHash, randomUUID } from "crypto";
import { DataSourceOptions } from "typeorm";
import { SnakeNamingStrategy } from "typeorm-naming-strategies";
import {
  MigrationConnectionConfigDto,
  MigrationRunRequestDto,
} from "./dto/migration-run-request.dto";
import { Company } from "../company/company.entity";
import { Branch } from "../branches/branch.entity";
import { BranchCounter } from "../branches/entities/branch-counter.entity";
import { Counter } from "../counters/counter.entity";
import { Menu } from "../menu/menu.entity";
import { Permission } from "../permissions/permission.entity";
import { User } from "../users/user.entity";
import { Role } from "../roles/role.entity";
import { UserRole } from "../user-roles/user-role.entity";
import { RolesMenuPermission } from "../roles-menu-permission/roles-menu-permission.entity";
import { SelectOption } from "../category-options/category-option.entity";
import { CategoryOptionCodeEnum } from "../category-options/category-option-code.enum";
import { Country } from "../country/country.entity";
import { CountryGroup } from "../country-groups/country-group.entity";
import { Currency } from "../currencies/currency.entity";
import { State } from "../state/state.entity";
import {
  PartyProfile,
} from "../party-profiles/party-profile.entity";
import { ProductIssuer } from "../products/entities/product-issuer.entity";
import { WorkflowStatus } from "../common/enums/workflow-status.enum";
import { normalizeMenuPath } from "../menu/menu-path.util";
import {
  BRANCH_CODE_LENGTH,
  extractPanFromLegacyTaxId,
  mapLegacyBranchRecord,
  mapLegacyCompanyRecord,
  pickSourceString,
  toBoolean,
  toNullableDate,
  toNullableNumber,
  toNullableString,
  toStringOrFallback,
  type SourceRow,
} from "./migration-tool.mapping";
import {
  LEGACY_CURRENCY_TABLE_CANDIDATES,
  indexCurrencyListCodes,
  indexMastCurrByCode,
  mapLegacyCurrencyRecord,
} from "./migration-tool.currency";
import {
  LEGACY_ACCOUNT_TABLE_CANDIDATES,
  accountCategoryCodes,
  mapLegacyAccountProfile,
} from "./migration-tool.account";
import {
  LEGACY_FINANCIAL_TABLE_CANDIDATES,
  defaultSignCategoryCode,
  financialTypeCategoryCode,
  mapLegacyFinancialProfile,
  mapLegacyFinancialSubProfile,
} from "./migration-tool.financial";
import {
  LEGACY_PRODUCT_TABLE_CANDIDATES,
  mapLegacyCurrencyProductLink,
  mapLegacyProductRecord,
} from "./migration-tool.product";
import {
  LEGACY_PARTY_TABLE_CANDIDATES,
  mapLegacyPartyProfile,
  mapLegacyProductIssuerLink,
  sortPartyRowsForMigration,
  type MappedPartyProfile,
} from "./migration-tool.party";
import {
  LEGACY_RATE_TABLE_CANDIDATES,
  RATE_MIGRATION_SKIPPED_TABLES,
  CurrencyRateProvider,
  aggregateMarginMasterForProductCurrency,
  aggregateMstRatesForProductCurrency,
  mapLegacyMarginMasterRow,
  mapLegacyMstRateRow,
  mapLegacyTickerLiveRate,
  mapLegacyTmpLiveRate,
  selectCurrencyBaseRateRows,
} from "./migration-tool.rates";
import {
  LEGACY_PURPOSE_TABLE_CANDIDATES,
  PURPOSE_MIGRATION_SKIPPED_TABLES,
  collapseMstPurposesByDescription,
  mapLegacyMstPurposeRow,
} from "./migration-tool.purpose";
import {
  LEGACY_TAX_TABLE_CANDIDATES,
  TAX_MIGRATION_SKIPPED_TABLES,
  mapLegacyGstInfoRow,
  mapLegacyMstTaxRow,
  mapLegacyTcsPerMasterRow,
  selectTcsPerMasterRowsForSlabs,
} from "./migration-tool.tax";
import {
  DAY_END_POLICY_CATEGORY_CODE,
  LEGACY_SETTINGS_TABLE_CANDIDATES,
  MAIL_PASSWORD_DUMMY_PLAINTEXT,
  PASSWORD_POLICY_CATEGORY_CODE,
  PASSWORD_POLICY_MAX_LENGTH_DEFAULT,
  SETTINGS_MIGRATION_SKIPPED_TABLES,
  collapseAdvSettingsByDataCode,
  inferAdvSettingValue,
  isPasswordPolicyChildCode,
  mapEodQuestionRow,
  mapMailConfigRow,
  mapPasswordPolicyRow,
  normalizeSettingCategoryCode,
} from "./migration-tool.settings";
import {
  LEGACY_DOCUMENT_TABLE_CANDIDATES,
  disambiguateDocumentCode,
  mapScanDocMasterRow,
} from "./migration-tool.document";
import {
  LEGACY_LOCK_TABLE_CANDIDATES,
  mapMonthLockRow,
  mapMLockBrnUserLinkRow,
  pickFirstMonthLockPerBranch,
} from "./migration-tool.lock";
import {
  DocumentProfile,
  DocumentSpecificationType,
} from "../document-profiles/document-profile.entity";
import { MailConfig } from "../mail/entities/mail-config.entity";
import { EncryptionUtil } from "../mail/utils/encryption.util";
import { MonthlyLockWindow } from "../monthly-locks/entities/monthly-lock-window.entity";
import { PasswordPolicyCodeEnum } from "../password-policy/password-policy.enum";
import { Purpose } from "../purpose/purpose.entity";
import { PurposeSlab } from "../purpose/purpose-slab.entity";
import { PurposeRateType } from "../purpose/purpose.enums";
import {
  AdvancedSetting,
  NodeType,
  ValueType,
} from "../additional-settings/advanced-setting.entity";
import { CurrencyRate } from "../currency-rates/currency-rate.entity";
import { FinancialCode } from "../financial-codes/financial-code.entity";
import { FinancialSubProfile } from "../financial-sub-profiles/financial-sub-profile.entity";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { Product } from "../products/product.entity";
import { ProductCurrencyRate } from "../currency-rates/product-currency-rate.entity";
import {
  LEGACY_CITY_TABLE_CANDIDATES,
  LEGACY_COUNTRY_TABLE_CANDIDATES,
  LEGACY_DISTRICT_TABLE_CANDIDATES,
  LEGACY_LOCATION_TYPE_TABLE_CANDIDATES,
  LEGACY_STATE_TABLE_CANDIDATES,
  canonicalGeographyName,
  cityNameLookupFromCities,
  collectBranchStateLookupValues,
  combineLegacyCities,
  combineLegacyCountries,
  combineLegacyStates,
  countryLookupKeys,
  districtLookupFromCities,
  mapLegacyLocationType,
  padGstStateCode,
  pickLegacyDistrictReference,
  resolveLegacyPlaceText,
  resolveLegacyRecordCity,
  stateLookupKeys,
  type CombinedLegacyCity,
  type CombinedLegacyCountry,
  type CombinedLegacyState,
  type LegacyPlaceLookup,
} from "./migration-tool.geography";

type MigrationMode = "mock" | "real";

type MigrationConnectionConfig =
  | { connectionString: string }
  | {
      user: string;
      password: string;
      server: string;
      port: number;
      database: string;
      options: {
        encrypt: boolean;
        trustServerCertificate: boolean;
      };
    };

type InternalTask =
  | "company"
  | "country"
  | "state"
  | "locationType"
  | "currency"
  | "financialCode"
  | "account"
  | "product"
  | "currencyProductLink"
  | "branch"
  | "counter"
  | "user"
  | "role"
  | "userRoleLinks"
  | "branchCounterLinks"
  | "branchUserLinks"
  | "counterUserLinks"
  | "party"
  | "productIssuerLink"
  | "mstRate"
  | "marginMaster"
  | "tickerRate"
  | "rateDeferredSkip"
  | "purpose"
  | "purposeDeferredSkip"
  | "gstRate"
  | "gstInfo"
  | "tcsPerMaster"
  | "taxDeferredSkip"
  | "advSettings"
  | "passwordPolicy"
  | "mailConfig"
  | "documentProfile"
  | "monthlyLock"
  | "dayEndPolicy"
  | "settingsDeferredSkip";

interface MigrationSummary {
  tables: number;
  rowsScanned: number;
  rowsInserted: number;
  rowsSkipped: number;
  rowsFailed: number;
  transformations: number;
  softDeletedRows: number;
}

interface ReportRow {
  [key: string]: string | number | boolean | null;
}

interface MigrationContext {
  mode: MigrationMode;
  actorUserId: string;
  selectedTables: string[];
  expandedTables: string[];
  sourceConnection: string;
  connectionSummary: string;
  bootstrapAdminUserId: string | null;
  bootstrapAdminRoleId: string | null;
  bootstrapAdminSourceOldId: string | number | null;
  summary: MigrationSummary;
  tableResults: ReportRow[];
  rowResults: ReportRow[];
  columnMappings: ReportRow[];
  transformations: ReportRow[];
  unmappedOldColumns: ReportRow[];
  skippedRows: ReportRow[];
  errors: ReportRow[];
  warnings: ReportRow[];
  idMap: ReportRow[];
  fieldStatus: ReportRow[];
  sourceCache: Record<string, SourceRow[]>;
  companyMap: Map<string, string>;
  countryMap: Map<string, string>;
  stateMap: Map<string, string>;
  cityLookup: LegacyPlaceLookup;
  districtLookup: LegacyPlaceLookup;
  cityByCode: Map<string, CombinedLegacyCity>;
  placeLookupsLoaded: boolean;
  currencyMap: Map<string, string>;
  financialCodeMap: Map<string, string>;
  financialSubProfileMap: Map<string, string>;
  accountMap: Map<string, string>;
  accountCodeMap: Map<string, string>;
  productMap: Map<string, string>;
  productCodeMap: Map<string, string>;
  branchMap: Map<string, string>;
  counterMap: Map<string, string>;
  userMap: Map<string, string>;
  roleMap: Map<string, string>;
  partyMap: Map<string, string>;
  partyCodeMap: Map<string, string>;
  branchCounters: Map<string, string[]>;
  branchUserLinks: Array<SourceRow>;
  counterUserLinks: Array<SourceRow>;
  userRows: Array<SourceRow>;
  createdRoleCodes: Set<string>;
}

interface ResolvedRecord {
  id: string;
  created: boolean;
  sourceId: string | number | null | undefined;
  targetTable: string;
  lookupKey: string;
  softDeleted?: boolean;
}

const TEMP_INITIAL_PASSWORD = "Temp@1234";

const TABLE_DEPENDENCIES: Record<string, InternalTask[]> = {
  company: ["company"],
  mstcompanyrecord: ["company"],
  country: ["country"],
  countries: ["country"],
  ctrcountry: ["country"],
  ctrcountry2: ["country"],
  tb_MstCountry: ["country"],
  tb_mstcountry: ["country"],
  LRSCountry: ["country"],
  lrscountry: ["country"],
  LRSCOUNTRY: ["country"],
  state: ["country", "state"],
  states: ["country", "state"],
  CTRSTATE: ["country", "state"],
  ctrstate: ["country", "state"],
  CTR_CUSTOMERSTATE: ["country", "state"],
  GSTSTATE: ["country", "state"],
  mstLocationType: ["locationType"],
  mstlocationtype: ["locationType"],
  currency: ["country", "currency"],
  mcurrency: ["country", "currency"],
  mCurrency: ["country", "currency"],
  MASTCURR: ["country", "currency"],
  mastcurr: ["country", "currency"],
  MCURRENCYLIST: ["country", "currency"],
  mcurrencylist: ["country", "currency"],
  FinancialProfile: ["financialCode"],
  financialprofile: ["financialCode"],
  FinancialSubProfile: ["financialCode"],
  financialsubprofile: ["financialCode"],
  financialCode: ["financialCode"],
  AccountsProfile: ["country", "currency", "financialCode", "account"],
  accountsprofile: ["country", "currency", "financialCode", "account"],
  account: ["country", "currency", "financialCode", "account"],
  mProductM: [
    "country",
    "currency",
    "financialCode",
    "account",
    "product",
  ],
  mproductm: [
    "country",
    "currency",
    "financialCode",
    "account",
    "product",
  ],
  product: ["country", "currency", "financialCode", "account", "product"],
  mCurrencyProductLink: [
    "country",
    "currency",
    "financialCode",
    "account",
    "product",
    "currencyProductLink",
  ],
  mcurrencyproductlink: [
    "country",
    "currency",
    "financialCode",
    "account",
    "product",
    "currencyProductLink",
  ],
  currencyProductLink: [
    "country",
    "currency",
    "financialCode",
    "account",
    "product",
    "currencyProductLink",
  ],
  branches: ["company", "country", "state", "locationType", "branch"],
  mstcompany: ["company", "country", "state", "locationType", "branch"],
  branch: ["company", "country", "state", "locationType", "branch"],
  locationType: ["locationType"],
  counters: ["company", "country", "state", "locationType", "branch", "counter", "branchCounterLinks"],
  mstcounter: [
    "company",
    "country",
    "state",
    "locationType",
    "branch",
    "counter",
    "branchCounterLinks",
  ],
  users: [
    "company",
    "branch",
    "counter",
    "user",
    "role",
    "userRoleLinks",
    "branchUserLinks",
    "counterUserLinks",
    "branchCounterLinks",
  ],
  mstuser: [
    "company",
    "branch",
    "counter",
    "user",
    "role",
    "userRoleLinks",
    "branchUserLinks",
    "counterUserLinks",
    "branchCounterLinks",
  ],
  roles: [
    "company",
    "branch",
    "counter",
    "user",
    "role",
    "userRoleLinks",
    "branchUserLinks",
    "counterUserLinks",
    "branchCounterLinks",
  ],
  user_roles: [
    "company",
    "branch",
    "counter",
    "user",
    "role",
    "userRoleLinks",
    "branchUserLinks",
    "counterUserLinks",
    "branchCounterLinks",
  ],
  "user-roles": [
    "company",
    "branch",
    "counter",
    "user",
    "role",
    "userRoleLinks",
    "branchUserLinks",
    "counterUserLinks",
    "branchCounterLinks",
  ],
  "user-role": [
    "company",
    "branch",
    "counter",
    "user",
    "role",
    "userRoleLinks",
    "branchUserLinks",
    "counterUserLinks",
    "branchCounterLinks",
  ],
  mstBranchCounterLink: ["company", "branch", "counter", "branchCounterLinks"],
  mstBranchUserLink: [
    "company",
    "branch",
    "counter",
    "user",
    "role",
    "branchUserLinks",
    "userRoleLinks",
  ],
  mstCounterUserLink: [
    "company",
    "branch",
    "counter",
    "user",
    "role",
    "counterUserLinks",
    "userRoleLinks",
  ],

  mstCodes: ["company", "branch", "party"],
  mstcodes: ["company", "branch", "party"],
  party: ["company", "branch", "party"],
  mProductIssuerLink: [
    "company",
    "branch",
    "country",
    "currency",
    "financialCode",
    "account",
    "product",
    "party",
    "productIssuerLink",
  ],
  mproductissuerlink: [
    "company",
    "branch",
    "country",
    "currency",
    "financialCode",
    "account",
    "product",
    "party",
    "productIssuerLink",
  ],
  productIssuerLink: [
    "company",
    "branch",
    "country",
    "currency",
    "financialCode",
    "account",
    "product",
    "party",
    "productIssuerLink",
  ],
  mstRates: ["currency", "product", "currencyProductLink", "mstRate"],
  mstrates: ["currency", "product", "currencyProductLink", "mstRate"],
  MarginMaster: ["currency", "product", "currencyProductLink", "marginMaster"],
  marginmaster: ["currency", "product", "currencyProductLink", "marginMaster"],
  tickerliverate: ["currency", "tickerRate"],
  tmpliverate: ["currency", "tickerRate"],
  StockCurrencyRate: ["rateDeferredSkip"],
  stockcurrencyrate: ["rateDeferredSkip"],
  PreMarginMaster: ["rateDeferredSkip"],
  premarginmaster: ["rateDeferredSkip"],
  MARGINMASTERTT: ["rateDeferredSkip"],
  marginmastertt: ["rateDeferredSkip"],
  mstRate: ["currency", "product", "currencyProductLink", "mstRate"],
  marginMaster: ["currency", "product", "currencyProductLink", "marginMaster"],
  tickerRate: ["currency", "tickerRate"],
  rateDeferredSkip: ["rateDeferredSkip"],
  mstPurpose: ["purpose"],
  MstPurpose: ["purpose"],
  MSTPURPOSE: ["purpose"],
  purpose: ["purpose"],
  mstAppPurpose: ["purposeDeferredSkip"],
  SubPurpose: ["purposeDeferredSkip"],
  subpurpose: ["purposeDeferredSkip"],
  PurposeLimit: ["purposeDeferredSkip"],
  purposelimit: ["purposeDeferredSkip"],
  ADIPurposeMaster: ["purposeDeferredSkip"],
  AD1Referral_Inc: ["purposeDeferredSkip"],
  IBPurposes: ["purposeDeferredSkip"],
  RBIPurpose: ["purposeDeferredSkip"],
  RBIPURPOSE: ["purposeDeferredSkip"],
  MstLRSPurpose: ["purposeDeferredSkip"],
  TPPurpose: ["purposeDeferredSkip"],
  TTPurpose: ["purposeDeferredSkip"],
  TTSubPurpose: ["purposeDeferredSkip"],
  purposeDeferredSkip: ["purposeDeferredSkip"],
  mstTax: ["gstRate"],
  MstTax: ["gstRate"],
  gstRate: ["gstRate"],
  GSTInfo: ["company", "branch", "party", "gstInfo"],
  gstinfo: ["company", "branch", "party", "gstInfo"],
  gstInfo: ["company", "branch", "party", "gstInfo"],
  TCSPERMASTER: ["purpose", "tcsPerMaster"],
  tcspermaster: ["purpose", "tcsPerMaster"],
  tcsPerMaster: ["purpose", "tcsPerMaster"],
  TCSApplyFor: ["taxDeferredSkip"],
  tcsapplyfor: ["taxDeferredSkip"],
  TCSPANTRANS: ["taxDeferredSkip"],
  tcspantrans: ["taxDeferredSkip"],
  tb_TCSAPI: ["taxDeferredSkip"],
  mstTaxd: ["taxDeferredSkip"],
  mstTaxExampt: ["taxDeferredSkip"],
  GSTNoExempt: ["taxDeferredSkip"],
  GSTNOUPDATE: ["taxDeferredSkip"],
  gstrcmslab: ["taxDeferredSkip"],
  gstexepmpt: ["taxDeferredSkip"],
  taxDeferredSkip: ["taxDeferredSkip"],
  advsettings: [
    "country",
    "currency",
    "financialCode",
    "account",
    "product",
    "company",
    "branch",
    "user",
    "party",
    "purpose",
    "advSettings",
  ],
  AdvSettings: [
    "country",
    "currency",
    "financialCode",
    "account",
    "product",
    "company",
    "branch",
    "user",
    "party",
    "purpose",
    "advSettings",
  ],
  ADVSETTINGS: [
    "country",
    "currency",
    "financialCode",
    "account",
    "product",
    "company",
    "branch",
    "user",
    "party",
    "purpose",
    "advSettings",
  ],
  advSettings: [
    "country",
    "currency",
    "financialCode",
    "account",
    "product",
    "company",
    "branch",
    "user",
    "party",
    "purpose",
    "advSettings",
  ],
  mstPasswordPolicy: ["passwordPolicy"],
  MstPasswordPolicy: ["passwordPolicy"],
  passwordPolicy: ["passwordPolicy"],
  MailConfig: ["mailConfig"],
  mailconfig: ["mailConfig"],
  mailConfig: ["mailConfig"],
  ScanDocMaster: ["documentProfile"],
  scandocmaster: ["documentProfile"],
  documentProfile: ["documentProfile"],
  monthlock: ["company", "branch", "user", "monthlyLock"],
  MonthLock: ["company", "branch", "user", "monthlyLock"],
  MLockBrnUserLink: ["company", "branch", "user", "monthlyLock"],
  mlockbrnuserlink: ["company", "branch", "user", "monthlyLock"],
  monthlyLock: ["company", "branch", "user", "monthlyLock"],
  tb_EODQuestion: ["dayEndPolicy"],
  TB_EODQUESTION: ["dayEndPolicy"],
  dayEndPolicy: ["dayEndPolicy"],
  DOCCHECK: ["settingsDeferredSkip"],
  UpdateSettings: ["settingsDeferredSkip"],
  tb_ConsoParameter: ["settingsDeferredSkip"],
  yrMaster: ["settingsDeferredSkip"],
  yrDetails: ["settingsDeferredSkip"],
  ScannedDocs: ["settingsDeferredSkip"],
  PreScannedDocs: ["settingsDeferredSkip"],
  DOCCOLLECTED: ["settingsDeferredSkip"],
  PAYDATALOCK: ["settingsDeferredSkip"],
  MLRECORD: ["settingsDeferredSkip"],
  tb_RestrictedMenuVsCounter: ["settingsDeferredSkip"],
  tb_HolidayList: ["settingsDeferredSkip"],
  mstShifts: ["settingsDeferredSkip"],
  mstUserLogin: ["settingsDeferredSkip"],
  mstUserLogonHours: ["settingsDeferredSkip"],
  LOGUSERLOGIN: ["settingsDeferredSkip"],
  settingsDeferredSkip: ["settingsDeferredSkip"],
};

const escapeIdentifier = (value: string): string =>
  `[${value.replace(/]/g, "]]")}]`;

const normalizeCode = (value: string): string =>
  value.trim().replace(/\s+/g, "_").toUpperCase();

const normalizeMatchText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const isPersistedUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const insertion = current[j - 1] + 1;
      const deletion = previous[j] + 1;
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min(insertion, deletion, substitution));
    }
    for (let j = 0; j < previous.length; j += 1) {
      previous[j] = current[j] ?? previous[j];
    }
  }
  return previous[b.length] ?? 0;
};

const stringSimilarity = (left: string, right: string): number => {
  const a = normalizeMatchText(left);
  const b = normalizeMatchText(right);
  if (!a || !b) {
    return 0;
  }
  const maxLen = Math.max(a.length, b.length);
  if (!maxLen) {
    return 0;
  }
  const distance = levenshteinDistance(a, b);
  return Math.max(0, 1 - distance / maxLen);
};

const splitLegacyTokens = (value: any): string[] => {
  if (value === null || value === undefined) {
    return [];
  }

  const text = String(value).trim();
  if (!text) {
    return [];
  }

  if (
    (text.startsWith("{") && text.endsWith("}")) ||
    (text.startsWith("[") && text.endsWith("]"))
  ) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) => splitLegacyTokens(item));
      }
      if (parsed && typeof parsed === "object") {
        return Object.values(parsed).flatMap((item) => splitLegacyTokens(item));
      }
      return splitLegacyTokens(parsed);
    } catch {
      // fall through to plain tokenization
    }
  }

  return text
    .split(/[^a-zA-Z0-9_\/.-]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
};

const legacyActionAliases: Array<{ code: string; aliases: string[] }> = [
  { code: "add", aliases: ["add", "create", "insert", "new"] },
  { code: "modify", aliases: ["modify", "update", "edit", "change", "alter"] },
  { code: "delete", aliases: ["delete", "remove", "del"] },
  { code: "view", aliases: ["view", "read", "show", "list", "display"] },
  { code: "export", aliases: ["export", "download"] },
  {
    code: "authorized",
    aliases: ["authorized", "authorised", "approve", "approved", "authorize"],
  },
  { code: "rejected", aliases: ["rejected", "reject", "denied", "deny"] },
];

const legacyPermissionActionSet = new Set(
  legacyActionAliases.flatMap((item) =>
    item.aliases.map((alias) => normalizeMatchText(alias)),
  ),
);

interface MenuSeedDefinition {
  path: string;
  name: string;
  parentPath: string | null;
  isAdmin: boolean;
  sortOrder: number;
  icon?: string | null;
}

const buildCrudMenuSeeds = (params: {
  basePath: string;
  name: string;
  isAdmin: boolean;
  parentPath?: string | null;
  createPath?: string;
  editPath?: string;
  detailPath?: string;
  extraChildren?: Array<{
    path: string;
    name: string;
    sortOrder?: number;
    isAdmin?: boolean;
  }>;
}): MenuSeedDefinition[] => {
  const {
    basePath,
    name,
    isAdmin,
    parentPath = null,
    createPath,
    editPath,
    detailPath,
    extraChildren = [],
  } = params;

  const seeds: MenuSeedDefinition[] = [
    {
      path: basePath,
      name,
      parentPath,
      isAdmin,
      sortOrder: 0,
    },
  ];

  if (createPath) {
    seeds.push({
      path: createPath,
      name: `Create ${name}`,
      parentPath: basePath,
      isAdmin,
      sortOrder: 1,
    });
  }

  if (editPath) {
    seeds.push({
      path: editPath,
      name: `Edit ${name}`,
      parentPath: basePath,
      isAdmin,
      sortOrder: 2,
    });
  }

  if (detailPath) {
    seeds.push({
      path: detailPath,
      name: `${name} Details`,
      parentPath: basePath,
      isAdmin,
      sortOrder: 3,
    });
  }

  extraChildren.forEach((child, index) => {
    seeds.push({
      path: child.path,
      name: child.name,
      parentPath: basePath,
      isAdmin: child.isAdmin ?? isAdmin,
      sortOrder: child.sortOrder ?? 10 + index,
    });
  });

  return seeds;
};

const PARTY_PROFILE_MENU_TYPES: Array<{ routeType: string; label: string }> = [
  { routeType: "corporate-client", label: "Corporate Client" },
  { routeType: "ffmc", label: "FFMC" },
  { routeType: "rf", label: "RF" },
  { routeType: "authorised-dealer", label: "Authorised Dealer" },
  { routeType: "rmc", label: "RMC" },
  { routeType: "franchise", label: "Franchise" },
  { routeType: "agent", label: "Agent" },
  { routeType: "foreign-correspondent", label: "Foreign Correspondent" },
  { routeType: "forex-correspondent", label: "Forex Correspondent" },
  { routeType: "marketing-executive", label: "Marketing Executive" },
  { routeType: "card-issuer-profile", label: "Card Issuer" },
  { routeType: "misc-supplier-profile", label: "Misc Supplier" },
];

const buildPartyProfileMenuSeeds = (): MenuSeedDefinition[] =>
  PARTY_PROFILE_MENU_TYPES.map(({ routeType, label }, index) => ({
    path: `/party-profiles/${routeType}`,
    name: `${label} Profile`,
    parentPath: "/party-profiles",
    isAdmin: false,
    sortOrder: 20 + index,
  }));

const FRONTEND_MENU_SEEDS: MenuSeedDefinition[] = [
  {
    path: "/",
    name: "Dashboard",
    parentPath: null,
    isAdmin: false,
    sortOrder: 0,
  },
  ...buildCrudMenuSeeds({
    basePath: "/users/list",
    name: "Users",
    isAdmin: false,
    parentPath: null,
    createPath: "/users/create",
    editPath: "/users/edit/:id",
    detailPath: "/users/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/company-profile",
    name: "Company Profile",
    isAdmin: true,
    createPath: "/admin/company-profile/create",
    editPath: "/admin/company-profile/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/branch-profile",
    name: "Branch Profile",
    isAdmin: true,
    createPath: "/admin/branch-profile/create",
    editPath: "/admin/branch-profile/edit/:id",
  }),
  {
    path: "/review/branch-profile",
    name: "Branch Review",
    parentPath: "/admin/branch-profile",
    isAdmin: true,
    sortOrder: 20,
  },
  ...buildCrudMenuSeeds({
    basePath: "/admin/counter-profile",
    name: "Counter Profile",
    isAdmin: true,
    createPath: "/admin/counter-profile/create",
    editPath: "/admin/counter-profile/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/document-profile",
    name: "Document Profile",
    isAdmin: true,
    createPath: "/admin/document-profile/create",
    editPath: "/admin/document-profile/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/miscellaneous-profile",
    name: "Miscellaneous Profile",
    isAdmin: true,
    createPath: "/admin/miscellaneous-profile/create",
    editPath: "/admin/miscellaneous-profile/edit/:code",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/purpose",
    name: "Purpose",
    isAdmin: true,
    createPath: "/admin/purpose/create",
    editPath: "/admin/purpose/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/purpose-group",
    name: "Purpose Group",
    isAdmin: true,
    createPath: "/admin/purpose-group/create",
    editPath: "/admin/purpose-group/edit/:id",
  }),
  {
    path: "/admin/menu-management",
    name: "Menu Management",
    parentPath: null,
    isAdmin: true,
    sortOrder: 40,
  },
  {
    path: "/admin/day-end-start-process",
    name: "Day End/Start Process",
    parentPath: null,
    isAdmin: true,
    sortOrder: 41,
  },
  {
    path: "/admin/monthwise-locking",
    name: "Monthwise Locking",
    parentPath: null,
    isAdmin: true,
    sortOrder: 42,
  },
  {
    path: "/reports",
    name: "Reports",
    parentPath: null,
    isAdmin: false,
    sortOrder: 43,
  },
  {
    path: "/reports/:slug",
    name: "Report Detail",
    parentPath: "/reports",
    isAdmin: false,
    sortOrder: 1,
  },
  {
    path: "/reports/currency-balance-report",
    name: "Currency Balance",
    parentPath: "/reports",
    isAdmin: false,
    sortOrder: 2,
  },
  {
    path: "/reports/bank-report",
    name: "Bank Report",
    parentPath: "/reports",
    isAdmin: false,
    sortOrder: 2,
  },
  {
    path: "/reports/cash-report",
    name: "Cash Report",
    parentPath: "/reports",
    isAdmin: false,
    sortOrder: 2,
  },
  {
    path: "/reports/generate-ledger",
    name: "Generate Ledger",
    parentPath: "/reports",
    isAdmin: false,
    sortOrder: 2,
  },
  {
    path: "/reports/stock-revaluations",
    name: "Stock Revaluation",
    parentPath: "/reports",
    isAdmin: false,
    sortOrder: 3,
  },
  {
    path: "/reports/card-unsettled-report",
    name: "Unsettled CARD",
    parentPath: "/reports",
    isAdmin: false,
    sortOrder: 4,
  },
  {
    path: "/reports/card-settled-report",
    name: "Settled CARD",
    parentPath: "/reports",
    isAdmin: false,
    sortOrder: 5,
  },
  {
    path: "/reports/card-blank-stock-report",
    name: "Blank Stock CARD",
    parentPath: "/reports",
    isAdmin: false,
    sortOrder: 6,
  },
  {
    path: "/reports/flm",
    name: "FLM",
    parentPath: "/reports",
    isAdmin: false,
    sortOrder: 7,
  },
  {
    path: "/reports/flm1-daily-cn-summary",
    name: "FLM1 Daily CN Summary",
    parentPath: "/reports/flm",
    isAdmin: false,
    sortOrder: 1,
  },
  {
    path: "/reports/flm2-daily-et-summary",
    name: "Encashed TC Balance",
    parentPath: "/reports/flm",
    isAdmin: false,
    sortOrder: 2,
  },
  {
    path: "/reports/flm3-purchase-from-public",
    name: "FLM 3 - Purchase from Public",
    parentPath: "/reports/flm",
    isAdmin: false,
    sortOrder: 3,
  },
  {
    path: "/reports/flm4-purchase-from-ffmc",
    name: "FLM 4 - Purchase from FFMC",
    parentPath: "/reports/flm",
    isAdmin: false,
    sortOrder: 4,
  },
  {
    path: "/reports/flm5-sales-to-public",
    name: "FLM 5 - Sales to Public",
    parentPath: "/reports/flm",
    isAdmin: false,
    sortOrder: 5,
  },
  {
    path: "/reports/flm6-sales-to-ffmc",
    name: "FLM 6 - Sales to FFMC",
    parentPath: "/reports/flm",
    isAdmin: false,
    sortOrder: 6,
  },
  {
    path: "/reports/flm7-surrender-statement",
    name: "FLM 7 - Surrender Statement",
    parentPath: "/reports/flm",
    isAdmin: false,
    sortOrder: 7,
  },
  {
    path: "/reports/flm8-cn-statement",
    name: "FLM 8 - CN Statement",
    parentPath: "/reports/flm",
    isAdmin: false,
    sortOrder: 8,
  },
  ...buildCrudMenuSeeds({
    basePath: "/admin/manual-bill-books",
    name: "Manual Bill Books",
    isAdmin: true,
    createPath: "/admin/manual-bill-books/create",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/manual-bill-books",
    name: "Manual Bill Books",
    isAdmin: false,
    createPath: "/manual-bill-books/create",
    extraChildren: [
      {
        path: "/manual-bill-books/acknowledgement",
        name: "Branch Acknowledgement",
        isAdmin: false,
        sortOrder: 52,
      },
      {
        path: "/manual-bill-books/allocation",
        name: "Manager To Cashier Allocation",
        isAdmin: false,
        sortOrder: 53,
      },
      {
        path: "/manual-bill-books/dp-mapping",
        name: "Manual Bill DP Mapping",
        isAdmin: false,
        sortOrder: 54,
      },
      {
        path: "/manual-bill-books/dp-unmapping",
        name: "Manual Bill DP Unmapping",
        isAdmin: false,
        sortOrder: 55,
      },
      {
        path: "/manual-bill-books/delivery-persons",
        name: "Delivery Person Management",
        isAdmin: false,
        sortOrder: 56,
      },
    ],
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/chequebooks",
    name: "Cheque Books Admin",
    isAdmin: true,
    createPath: "/admin/chequebooks/create",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/cheque-books",
    name: "Cheque Books",
    isAdmin: false,
    createPath: "/cheque-books/create",
    extraChildren: [
      {
        path: "/cheque-books/acknowledgement",
        name: "Cheque Book Acknowledgement",
        isAdmin: false,
        sortOrder: 60,
      },
      {
        path: "/cheque-books/allocation",
        name: "Cheque Book Allocation",
        isAdmin: false,
        sortOrder: 61,
      },
      {
        path: "/cheque-books/return",
        name: "Cheque Book Return",
        isAdmin: false,
        sortOrder: 62,
      },
    ],
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/additional-settings",
    name: "Additional Settings",
    isAdmin: true,
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/transaction-account-postings",
    name: "Transaction Account Postings",
    isAdmin: true,
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/migrations",
    name: "Migration Tool",
    isAdmin: true,
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/currency-rates",
    name: "Currency Rates",
    isAdmin: true,
  }),
  ...buildCrudMenuSeeds({
    basePath: "/financial-profile",
    name: "Financial Profile",
    isAdmin: false,
    createPath: "/financial-profile/create",
    editPath: "/financial-profile/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/accounts-profile",
    name: "Accounts Profile",
    isAdmin: true,
    createPath: "/admin/accounts-profile/create",
    editPath: "/admin/accounts-profile/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/party-profiles",
    name: "Party Profiles",
    isAdmin: false,
  }),
  ...buildPartyProfileMenuSeeds(),
  ...buildCrudMenuSeeds({
    basePath: "/ad1",
    name: "AD1",
    isAdmin: false,
    createPath: "/ad1/create",
    editPath: "/ad1/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/purchase/:slug",
    name: "Purchase",
    isAdmin: false,
    createPath: "/purchase/:slug/create",
    editPath: "/purchase/:slug/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/sale/:slug",
    name: "Sale",
    isAdmin: false,
    createPath: "/sale/:slug/create",
    editPath: "/sale/:slug/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/receipts",
    name: "Receipts",
    isAdmin: false,
  }),
  ...buildCrudMenuSeeds({
    basePath: "/payments",
    name: "Payments",
    isAdmin: false,
  }),
  ...buildCrudMenuSeeds({
    basePath: "/journal-vouchers",
    name: "Journal Vouchers",
    isAdmin: false,
  }),
  ...buildCrudMenuSeeds({
    basePath: "/deposit-withdrawals",
    name: "Deposit / Withdrawals",
    isAdmin: false,
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/country-profile",
    name: "Country Profile",
    isAdmin: true,
    createPath: "/admin/country-profile/create",
    editPath: "/admin/country-profile/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/state-profile",
    name: "State Profile",
    isAdmin: true,
    createPath: "/admin/state-profile/create",
    editPath: "/admin/state-profile/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/expense-booking",
    name: "Expense Booking Master",
    isAdmin: false,
    createPath: "/expense-booking/create",
    editPath: "/expense-booking/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/income-booking",
    name: "Income Booking Master",
    isAdmin: false,
    createPath: "/income-booking/create",
    editPath: "/income-booking/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/product-profile",
    name: "Product Profile",
    isAdmin: true,
    createPath: "/admin/product-profile/create",
    editPath: "/admin/product-profile/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/currency-profile",
    name: "Currency Profile",
    isAdmin: false,
    createPath: "/currency-profile/create",
    editPath: "/currency-profile/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/tds-profile",
    name: "TDS Profile",
    isAdmin: true,
    createPath: "/admin/tds-profile/create",
    editPath: "/admin/tds-profile/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/master-pages",
    name: "Page Builder",
    isAdmin: true,
  }),
  ...buildCrudMenuSeeds({
    basePath: "/user-profile",
    name: "User Profile",
    isAdmin: false,
    createPath: "/user-profile/create",
    editPath: "/user-profile/edit/:id",
  }),
  ...buildCrudMenuSeeds({
    basePath: "/admin/user-role",
    name: "User Role",
    isAdmin: true,
    createPath: "/admin/user-role/create",
    editPath: "/admin/user-role/edit/:id",
  }),
];

type ConnectionSlot =
  | "currentMaster"
  | "currentTransaction"
  | "oldMaster"
  | "oldTransaction";

const MAX_WORKBOOK_CELL_LENGTH = 32000;

const sanitizeWorkbookValue = (value: any): any => {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > MAX_WORKBOOK_CELL_LENGTH
      ? `${value.slice(0, MAX_WORKBOOK_CELL_LENGTH - 20)}...[truncated]`
      : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value) || typeof value === "object") {
    const text = JSON.stringify(value);
    return text.length > MAX_WORKBOOK_CELL_LENGTH
      ? `${text.slice(0, MAX_WORKBOOK_CELL_LENGTH - 20)}...[truncated]`
      : text;
  }

  const text = String(value);
  return text.length > MAX_WORKBOOK_CELL_LENGTH
    ? `${text.slice(0, MAX_WORKBOOK_CELL_LENGTH - 20)}...[truncated]`
    : text;
};

const sanitizeWorkbookRow = (row: ReportRow): ReportRow =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      sanitizeWorkbookValue(value),
    ]),
  );

interface ResolvedAuditFields {
  deletedAt: Date | null;
  deletedBy: string | null;
  wasDeleted: boolean;
  deletedAtSource: string;
}

interface BootstrapAdminResult {
  userId: string;
  roleId: string;
  sourceOldId: string | number | null | undefined;
  reusedExistingUser: boolean;
}

@Injectable()
export class MigrationToolService {
  private readonly logger = new Logger(MigrationToolService.name);
  private activeContext: MigrationContext | null = null;
  private activeTargetDataSource: DataSource | null = null;

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectDataSource()
    private readonly currentMasterDataSource: DataSource,
    @InjectDataSource("database2")
    private readonly currentTransactionDataSource: DataSource,
  ) {}

  private get companyMap() {
    return this.activeContext?.companyMap ?? new Map<string, string>();
  }

  private get branchMap() {
    return this.activeContext?.branchMap ?? new Map<string, string>();
  }

  private get countryMap() {
    return this.activeContext?.countryMap ?? new Map<string, string>();
  }

  private get stateMap() {
    return this.activeContext?.stateMap ?? new Map<string, string>();
  }

  private get cityLookup() {
    return this.activeContext?.cityLookup ?? new Map<string, string>();
  }

  private get districtLookup() {
    return this.activeContext?.districtLookup ?? new Map<string, string>();
  }

  private get currencyMap() {
    return this.activeContext?.currencyMap ?? new Map<string, string>();
  }

  private get financialCodeMap() {
    return this.activeContext?.financialCodeMap ?? new Map<string, string>();
  }

  private get financialSubProfileMap() {
    return (
      this.activeContext?.financialSubProfileMap ?? new Map<string, string>()
    );
  }

  private get accountMap() {
    return this.activeContext?.accountMap ?? new Map<string, string>();
  }

  private get accountCodeMap() {
    return this.activeContext?.accountCodeMap ?? new Map<string, string>();
  }

  private get productMap() {
    return this.activeContext?.productMap ?? new Map<string, string>();
  }

  private get productCodeMap() {
    return this.activeContext?.productCodeMap ?? new Map<string, string>();
  }

  private get counterMap() {
    return this.activeContext?.counterMap ?? new Map<string, string>();
  }

  private get userMap() {
    return this.activeContext?.userMap ?? new Map<string, string>();
  }

  private get roleMap() {
    return this.activeContext?.roleMap ?? new Map<string, string>();
  }

  private get partyMap() {
    return this.activeContext?.partyMap ?? new Map<string, string>();
  }

  private get partyCodeMap() {
    return this.activeContext?.partyCodeMap ?? new Map<string, string>();
  }

  private get branchCounters() {
    return this.activeContext?.branchCounters ?? new Map<string, string[]>();
  }

  private get branchUserLinks() {
    return this.activeContext?.branchUserLinks ?? [];
  }

  private get counterUserLinks() {
    return this.activeContext?.counterUserLinks ?? [];
  }

  private get userRows() {
    return this.activeContext?.userRows ?? [];
  }

  private get targetDataSource() {
    return this.activeTargetDataSource ?? this.currentMasterDataSource;
  }

  private get targetCompanyRepository() {
    return this.targetDataSource.getRepository(Company);
  }

  private get targetBranchRepository() {
    return this.targetDataSource.getRepository(Branch);
  }

  private get targetCounterRepository() {
    return this.targetDataSource.getRepository(Counter);
  }

  private get targetBranchCounterRepository() {
    return this.targetDataSource.getRepository(BranchCounter);
  }

  private get targetUserRepository() {
    return this.targetDataSource.getRepository(User);
  }

  private get targetRoleRepository() {
    return this.targetDataSource.getRepository(Role);
  }

  private get targetUserRoleRepository() {
    return this.targetDataSource.getRepository(UserRole);
  }

  private get targetMenuRepository() {
    return this.targetDataSource.getRepository(Menu);
  }

  private get targetPermissionRepository() {
    return this.targetDataSource.getRepository(Permission);
  }

  private get targetRolesMenuPermissionRepository() {
    return this.targetDataSource.getRepository(RolesMenuPermission);
  }

  private get targetSelectOptionRepository() {
    return this.targetDataSource.getRepository(SelectOption);
  }

  private get targetCountryRepository() {
    return this.targetDataSource.getRepository(Country);
  }

  private get targetCountryGroupRepository() {
    return this.targetDataSource.getRepository(CountryGroup);
  }

  private get targetStateRepository() {
    return this.targetDataSource.getRepository(State);
  }

  private get targetCurrencyRepository() {
    return this.targetDataSource.getRepository(Currency);
  }

  private get targetFinancialCodeRepository() {
    return this.targetDataSource.getRepository(FinancialCode);
  }

  private get targetFinancialSubProfileRepository() {
    return this.targetDataSource.getRepository(FinancialSubProfile);
  }

  private get targetAccountProfileRepository() {
    return this.targetDataSource.getRepository(AccountProfile);
  }

  private get targetProductRepository() {
    return this.targetDataSource.getRepository(Product);
  }

  private get targetProductCurrencyRateRepository() {
    return this.targetDataSource.getRepository(ProductCurrencyRate);
  }

  private get targetCurrencyRateRepository() {
    return this.targetDataSource.getRepository(CurrencyRate);
  }

  private get targetPartyProfileRepository() {
    return this.targetDataSource.getRepository(PartyProfile);
  }

  private get targetProductIssuerRepository() {
    return this.targetDataSource.getRepository(ProductIssuer);
  }

  private get targetPurposeRepository() {
    return this.targetDataSource.getRepository(Purpose);
  }

  private get targetPurposeSlabRepository() {
    return this.targetDataSource.getRepository(PurposeSlab);
  }

  private get targetAdvancedSettingRepository() {
    return this.targetDataSource.getRepository(AdvancedSetting);
  }

  private get targetDocumentProfileRepository() {
    return this.targetDataSource.getRepository(DocumentProfile);
  }

  private get targetMailConfigRepository() {
    return this.targetDataSource.getRepository(MailConfig);
  }

  private get targetMonthlyLockWindowRepository() {
    return this.currentTransactionDataSource.getRepository(MonthlyLockWindow);
  }

  private getConnectionProfiles(
    dto: MigrationRunRequestDto,
  ): Record<ConnectionSlot, MigrationConnectionConfigDto | undefined> {
    return {
      currentMaster: dto.currentMasterConnection,
      currentTransaction: dto.currentTransactionConnection,
      oldMaster: dto.oldMasterConnection,
      oldTransaction: dto.oldTransactionConnection,
    };
  }

  private connectionSummary(
    connection?: MigrationConnectionConfigDto | null,
  ): string {
    if (!connection) {
      return "not provided";
    }

    if (connection.connectionMode === "string") {
      return connection.connectionString?.trim()
        ? "connection string"
        : "connection string (empty)";
    }

    const host = connection.host?.trim() ?? "";
    const database = connection.database?.trim() ?? "";
    return `${host || "unknown-host"} / ${database || "unknown-db"}`;
  }

  private buildMssqlConfig(
    connection?: MigrationConnectionConfigDto | null,
  ): MigrationConnectionConfig {
    if (!connection) {
      throw new BadRequestException("Old database connection is required");
    }

    if (connection.connectionMode === "string") {
      if (!connection.connectionString?.trim()) {
        throw new BadRequestException("Connection string is required");
      }
      return { connectionString: connection.connectionString.trim() };
    }

    if (
      !connection.host?.trim() ||
      !connection.username?.trim() ||
      !connection.password?.trim() ||
      !connection.database?.trim()
    ) {
      throw new BadRequestException(
        "Host, port, username, password, and database are required in options mode",
      );
    }

    return {
      server: connection.host.trim(),
      port: connection.port ?? 1433,
      user: connection.username.trim(),
      password: connection.password,
      database: connection.database.trim(),
      options: {
        encrypt: connection.ssl === true,
        trustServerCertificate: connection.ssl !== true,
      },
    };
  }

  private buildPostgresConfig(
    connection: MigrationConnectionConfigDto,
  ): DataSourceOptions {
    if (connection.connectionMode === "string") {
      if (!connection.connectionString?.trim()) {
        throw new BadRequestException("Connection string is required");
      }
      return {
        type: "postgres",
        url: connection.connectionString.trim(),
      };
    }

    if (
      !connection.host?.trim() ||
      !connection.username?.trim() ||
      !connection.password?.trim() ||
      !connection.database?.trim()
    ) {
      throw new BadRequestException(
        "Host, port, username, password, and database are required in options mode",
      );
    }

    return {
      type: "postgres",
      host: connection.host.trim(),
      port: connection.port ?? 5432,
      username: connection.username.trim(),
      password: connection.password,
      database: connection.database.trim(),
      ssl: connection.ssl === true ? { rejectUnauthorized: false } : false,
    };
  }

  private async verifyMssqlConnection(
    label: string,
    connection?: MigrationConnectionConfigDto | null,
  ): Promise<string> {
    if (!connection) {
      return `${label}: not provided`;
    }

    const pool = new mssql.ConnectionPool(
      this.buildMssqlConfig(connection) as mssql.config,
    );
    try {
      await pool.connect();
      const result = await pool.request().query("SELECT 1 AS ok");
      const verified =
        Array.isArray(result.recordset) && result.recordset.length > 0;
      return `${label}: ${verified ? "verified" : "failed verification"}`;
    } finally {
      await pool.close().catch(() => undefined);
    }
  }

  private async verifyPostgresConnection(
    label: string,
    connection?: MigrationConnectionConfigDto | null,
  ): Promise<string> {
    if (!connection) {
      return `${label}: not provided`;
    }

    const dataSource = new DataSource(this.buildPostgresConfig(connection));
    try {
      await dataSource.initialize();
      await dataSource.query("SELECT 1");
      return `${label}: verified`;
    } finally {
      if (dataSource.isInitialized) {
        await dataSource.destroy().catch(() => undefined);
      }
    }
  }

  private buildCurrentMasterDataSourceOptions(
    connection: MigrationConnectionConfigDto,
  ): DataSourceOptions {
    const baseOptions = this.buildPostgresConfig(
      connection,
    ) as DataSourceOptions;
    return {
      ...baseOptions,
      type: "postgres",
      entities: [
        __dirname +
          "/../!(manual-bill-books|chequebooks|transactions)/**/*.entity{.ts,.js}",
      ],
      migrations: [__dirname + "/../migrations/*{.ts,.js}"],
      synchronize: false,
      namingStrategy: new SnakeNamingStrategy(),
      logging: true,
    } as DataSourceOptions;
  }

  private buildCurrentTransactionDataSourceOptions(
    connection: MigrationConnectionConfigDto,
  ): DataSourceOptions {
    const baseOptions = this.buildPostgresConfig(
      connection,
    ) as DataSourceOptions;
    return {
      ...baseOptions,
      type: "postgres",
      entities: [
        __dirname + "/../manual-bill-books/**/*.entity{.ts,.js}",
        __dirname + "/../chequebooks/**/*.entity{.ts,.js}",
        __dirname + "/../transactions/**/*.entity{.ts,.js}",
      ],
      migrations: [__dirname + "/../migrations2/*{.ts,.js}"],
      synchronize: false,
      namingStrategy: new SnakeNamingStrategy(),
      logging: true,
    } as DataSourceOptions;
  }

  private async runCurrentDatabaseMigrationsForSlot(
    label: "currentMaster" | "currentTransaction",
    connection?: MigrationConnectionConfigDto | null,
  ): Promise<{ label: string; migrations: string[]; source: string }> {
    if (!connection) {
      throw new BadRequestException(
        `A UI connection is required to run schema migrations for ${label}`,
      );
    }

    const dataSource =
      label === "currentMaster"
        ? new DataSource(this.buildCurrentMasterDataSourceOptions(connection))
        : new DataSource(
            this.buildCurrentTransactionDataSourceOptions(connection),
          );

    const source = this.connectionSummary(connection);
    this.logger.log(`[schema-migrate] ${label} starting source=${source}`);

    let shouldDestroy = true;
    try {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      const migrations = await dataSource.runMigrations();
      const names = migrations.map((migration) => migration.name);
      this.logger.log(
        `[schema-migrate] ${label} finished applied=${names.length} names=${names.join(", ") || "none"}`,
      );

      return {
        label,
        migrations: names,
        source,
      };
    } finally {
      if (shouldDestroy && dataSource.isInitialized) {
        await dataSource.destroy().catch(() => undefined);
      }
    }
  }

  private async withLegacyConnections<T>(
    dto: MigrationRunRequestDto,
    handler: (connections: {
      master: mssql.ConnectionPool;
      transaction: mssql.ConnectionPool;
    }) => Promise<T>,
  ): Promise<T> {
    const masterConnection =
      dto.oldMasterConnection ?? dto.oldTransactionConnection;
    const transactionConnection =
      dto.oldTransactionConnection ?? dto.oldMasterConnection;
    const masterPool = new mssql.ConnectionPool(
      this.buildMssqlConfig(masterConnection) as mssql.config,
    );
    const transactionPool = new mssql.ConnectionPool(
      this.buildMssqlConfig(transactionConnection) as mssql.config,
    );

    try {
      await Promise.all([masterPool.connect(), transactionPool.connect()]);
      return await handler({
        master: masterPool,
        transaction: transactionPool,
      });
    } finally {
      await Promise.all([
        masterPool.close().catch(() => undefined),
        transactionPool.close().catch(() => undefined),
      ]);
    }
  }

  private async withTargetDatabase<T>(
    dto: MigrationRunRequestDto,
    handler: (targetDataSource: DataSource) => Promise<T>,
  ): Promise<T> {
    const connection = dto.currentMasterConnection ?? null;
    const targetDataSource = connection
      ? new DataSource(this.buildCurrentMasterDataSourceOptions(connection))
      : this.currentMasterDataSource;
    const shouldDestroy = connection !== null;
    const previousTargetDataSource = this.activeTargetDataSource;

    if (shouldDestroy && !targetDataSource.isInitialized) {
      await targetDataSource.initialize();
    }

    this.activeTargetDataSource = targetDataSource;

    try {
      return await handler(targetDataSource);
    } finally {
      this.activeTargetDataSource = previousTargetDataSource;
      if (shouldDestroy && targetDataSource.isInitialized) {
        await targetDataSource.destroy().catch(() => undefined);
      }
    }
  }

  async verifyConnection(dto: MigrationRunRequestDto) {
    this.logger.log(`Verify connection started`);
    const connectionResults = await Promise.all([
      this.verifyPostgresConnection(
        "currentMaster",
        dto.currentMasterConnection,
      ),
      this.verifyPostgresConnection(
        "currentTransaction",
        dto.currentTransactionConnection,
      ),
      this.verifyMssqlConnection("oldMaster", dto.oldMasterConnection),
      this.verifyMssqlConnection(
        "oldTransaction",
        dto.oldTransactionConnection,
      ),
    ]);
    const verified = !connectionResults.some((result) =>
      result.includes("failed verification"),
    );
    this.logger.log(
      `Verify connection finished verified=${verified} results=${connectionResults.join(" | ")}`,
    );
    return {
      verified,
      message: connectionResults.join(" | "),
    };
  }

  async runCurrentDatabaseMigrations(dto: MigrationRunRequestDto) {
    this.logger.log("[schema-migrate] current database migration requested");
    const target =
      dto.schemaTarget ??
      (dto.currentMasterConnection ? "currentMaster" : "currentTransaction");

    const connection =
      target === "currentMaster"
        ? dto.currentMasterConnection
        : dto.currentTransactionConnection;

    const result = await this.runCurrentDatabaseMigrationsForSlot(
      target,
      connection,
    );
    const message = `${target}: ${
      result.migrations.length > 0
        ? `applied ${result.migrations.length} migration(s)`
        : "up to date"
    }`;

    this.logger.log(
      `[schema-migrate] current database migration finished ${message}`,
    );

    return {
      message,
      [target]: result,
    };
  }

  private createContext(
    dto: MigrationRunRequestDto,
    mode: MigrationMode,
    actorUserId: string,
  ): MigrationContext {
    const selectedTables = dto.selectedTables ?? [];
    const expandedTables = this.expandSelectedTables(selectedTables);
    const profiles = this.getConnectionProfiles(dto);
    return {
      mode,
      actorUserId,
      selectedTables,
      expandedTables,
      sourceConnection: "multi-profile",
      connectionSummary: [
        `currentMaster=${this.connectionSummary(profiles.currentMaster)}`,
        `currentTransaction=${this.connectionSummary(profiles.currentTransaction)}`,
        `oldMaster=${this.connectionSummary(profiles.oldMaster)}`,
        `oldTransaction=${this.connectionSummary(profiles.oldTransaction)}`,
      ].join(" | "),
      bootstrapAdminUserId: null,
      bootstrapAdminRoleId: null,
      bootstrapAdminSourceOldId: null,
      summary: {
        tables: 0,
        rowsScanned: 0,
        rowsInserted: 0,
        rowsSkipped: 0,
        rowsFailed: 0,
        transformations: 0,
        softDeletedRows: 0,
      },
      tableResults: [],
      rowResults: [],
      columnMappings: [],
      transformations: [],
      unmappedOldColumns: [],
      skippedRows: [],
      errors: [],
      warnings: [],
      idMap: [],
      fieldStatus: [],
      sourceCache: {},
      companyMap: new Map(),
      countryMap: new Map(),
      stateMap: new Map(),
      cityLookup: new Map(),
      districtLookup: new Map(),
      cityByCode: new Map(),
      placeLookupsLoaded: false,
      currencyMap: new Map(),
      financialCodeMap: new Map(),
      financialSubProfileMap: new Map(),
      accountMap: new Map(),
      accountCodeMap: new Map(),
      productMap: new Map(),
      productCodeMap: new Map(),
      branchMap: new Map(),
      counterMap: new Map(),
      userMap: new Map(),
      roleMap: new Map(),
      partyMap: new Map(),
      partyCodeMap: new Map(),
      branchCounters: new Map(),
      branchUserLinks: [],
      counterUserLinks: [],
      userRows: [],
      createdRoleCodes: new Set(),
    };
  }

  private expandSelectedTables(selectedTables: string[]): string[] {
    const result = new Set<string>();
    const visit = (table: string) => {
      const dependencies = TABLE_DEPENDENCIES[table];
      if (!dependencies) {
        return;
      }
      for (const dep of dependencies) {
        if (result.has(dep)) {
        continue;
      }
        result.add(dep);
        visit(dep);
      }
    };

    for (const table of selectedTables) {
      visit(table);
    }

    return [...result];
  }

  private resolveTargetTableLabel(task: InternalTask): string {
    switch (task) {
      case "company":
        return "company";
      case "country":
        return "countries";
      case "state":
        return "states";
      case "locationType":
        return "category_options";
      case "currency":
        return "currencies";
      case "financialCode":
        return "financial_codes";
      case "account":
        return "account_profiles";
      case "product":
        return "products";
      case "currencyProductLink":
        return "product_currency_rates";
      case "branch":
        return "branches";
      case "counter":
        return "counters";
      case "user":
        return "users";
      case "role":
        return "roles";
      case "userRoleLinks":
        return "user_roles";
      case "branchCounterLinks":
        return "branch_counters";
      case "branchUserLinks":
        return "mstBranchUserLink";
      case "counterUserLinks":
        return "mstCounterUserLink";
      case "party":
        return "party_profiles";
      case "productIssuerLink":
        return "product_issuers";
      case "mstRate":
        return "currency_rates";
      case "marginMaster":
        return "product_currency_rates";
      case "tickerRate":
        return "currency_rates";
      case "rateDeferredSkip":
        return "(deferred)";
      case "purpose":
        return "purposes";
      case "purposeDeferredSkip":
        return "(deferred)";
      case "gstRate":
        return "advanced_settings";
      case "gstInfo":
        return "party_profiles";
      case "tcsPerMaster":
        return "purpose_slabs";
      case "taxDeferredSkip":
        return "(deferred)";
      case "advSettings":
        return "advanced_settings";
      case "passwordPolicy":
        return "advanced_settings";
      case "mailConfig":
        return "mail_configurations";
      case "documentProfile":
        return "document_profiles";
      case "monthlyLock":
        return "monthly_lock_windows";
      case "dayEndPolicy":
        return "advanced_settings";
      case "settingsDeferredSkip":
        return "(deferred)";
      default:
        return task;
    }
  }

  private sourceTableName(task: InternalTask): string {
    switch (task) {
      case "company":
        return "mstcompanyrecord";
      case "country":
        return "ctrcountry2";
      case "state":
        return "CTRSTATE";
      case "locationType":
        return "mstLocationType";
      case "currency":
        return "mcurrency";
      case "financialCode":
        return "FinancialProfile";
      case "account":
        return "AccountsProfile";
      case "product":
        return "mProductM";
      case "currencyProductLink":
        return "mCurrencyProductLink";
      case "branch":
        return "mstcompany";
      case "counter":
        return "mstcounter";
      case "user":
        return "mstuser";
      case "branchCounterLinks":
        return "mstBranchCounterLink";
      case "branchUserLinks":
        return "mstBranchUserLink";
      case "counterUserLinks":
        return "mstCounterUserLink";
      case "role":
      case "userRoleLinks":
        return "mstuser";
      case "party":
        return "mstCodes";
      case "productIssuerLink":
        return "mProductIssuerLink";
      case "mstRate":
        return "mstRates";
      case "marginMaster":
        return "MarginMaster";
      case "tickerRate":
        return "tickerliverate";
      case "rateDeferredSkip":
        return "StockCurrencyRate";
      case "purpose":
        return "mstPurpose";
      case "purposeDeferredSkip":
        return "PurposeLimit";
      case "gstRate":
        return "mstTax";
      case "gstInfo":
        return "GSTInfo";
      case "tcsPerMaster":
        return "TCSPERMASTER";
      case "taxDeferredSkip":
        return "TCSApplyFor";
      case "advSettings":
        return "advsettings";
      case "passwordPolicy":
        return "mstPasswordPolicy";
      case "mailConfig":
        return "MailConfig";
      case "documentProfile":
        return "ScanDocMaster";
      case "monthlyLock":
        return "monthlock";
      case "dayEndPolicy":
        return "tb_EODQuestion";
      case "settingsDeferredSkip":
        return "DOCCHECK";
      default:
        return "";
    }
  }

  private isTaskIncluded(
    context: MigrationContext,
    task: InternalTask,
  ): boolean {
    return context.expandedTables.includes(task);
  }

  private addFieldStatus(
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourceColumn: string;
      sourceValue: any;
      targetColumn?: string | null;
      targetValue?: any;
      status: "saved" | "transformed" | "skipped" | "unmapped";
      note?: string;
    },
  ) {
    context.fieldStatus.push({
      sourceTable: params.sourceTable,
      sourceColumn: params.sourceColumn,
      sourceValue: params.sourceValue ?? null,
      targetColumn: params.targetColumn ?? null,
      targetValue: params.targetValue ?? null,
      status: params.status,
      note: params.note ?? "",
    });
  }

  private addColumnMapping(
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourceColumn: string;
      sourceValue: any;
      targetColumn: string;
      targetValue: any;
      transformApplied?: string;
      result: string;
    },
  ) {
    context.columnMappings.push({
      sourceTable: params.sourceTable,
      sourceColumn: params.sourceColumn,
      sourceValue: params.sourceValue ?? null,
      targetColumn: params.targetColumn,
      targetValue: params.targetValue ?? null,
      transformApplied: params.transformApplied ?? "",
      result: params.result,
    });
  }

  private addTransformation(
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourceField: string;
      ruleName: string;
      originalValue: any;
      transformedValue: any;
      result: string;
    },
  ) {
    context.transformations.push({
      sourceTable: params.sourceTable,
      sourceField: params.sourceField,
      ruleName: params.ruleName,
      originalValue: params.originalValue ?? null,
      transformedValue: params.transformedValue ?? null,
      result: params.result,
    });
    context.summary.transformations += 1;
  }

  private addUnmappedColumn(
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourceColumn: string;
      sourceValue: any;
      reason: string;
    },
  ) {
    context.unmappedOldColumns.push({
      sourceTable: params.sourceTable,
      sourceColumn: params.sourceColumn,
      sourceValue: params.sourceValue ?? null,
      reason: params.reason,
    });
  }

  private addWarning(
    context: MigrationContext,
    params: {
      sourceTable?: string;
      sourceColumn?: string;
      note: string;
    },
  ) {
    context.warnings.push({
      sourceTable: params.sourceTable ?? "",
      sourceColumn: params.sourceColumn ?? "",
      note: params.note,
    });
  }

  private addError(
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourceRowIdentifier?: string;
      fieldName: string;
      errorMessage: string;
      technicalNote?: string;
    },
  ) {
    context.errors.push({
      sourceTable: params.sourceTable,
      sourceRowIdentifier: params.sourceRowIdentifier ?? "?",
      fieldName: params.fieldName,
      errorMessage: params.errorMessage,
      technicalNote: params.technicalNote ?? "",
    });
    context.summary.rowsFailed += 1;
    this.logger.error(
      `[${params.sourceTable}] row=${params.sourceRowIdentifier} field=${params.fieldName} error=${params.errorMessage}` +
        (params.technicalNote ? ` note=${params.technicalNote}` : ""),
    );
  }

  private addSkippedRow(
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourceRowIdentifier?: string;
      reason: string;
      fallbackAction: string;
    },
  ) {
    context.skippedRows.push({
      sourceTable: params.sourceTable,
      sourceRowIdentifier: params.sourceRowIdentifier ?? "?",
      reason: params.reason,
      fallbackAction: params.fallbackAction,
    });
    context.summary.rowsSkipped += 1;
    this.logger.warn(
      `[${params.sourceTable}] row=${params.sourceRowIdentifier} skipped reason=${params.reason} fallback=${params.fallbackAction}`,
    );
  }

  private addRowResult(
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourcePrimaryKey: string;
      targetId: string;
      status: string;
      note: string;
    },
  ) {
    context.rowResults.push({
      sourceTable: params.sourceTable,
      sourcePrimaryKey: params.sourcePrimaryKey,
      targetId: params.targetId,
      status: params.status,
      note: params.note,
    });
  }

  private getSourceDate(row: SourceRow, keys: string[]): Date | null {
    for (const key of keys) {
      const date = toNullableDate(row[key]);
      if (date) {
        return date;
      }
    }
    return null;
  }

  private getSourceString(row: SourceRow, keys: string[]): string | null {
    return pickSourceString(row, keys);
  }

  private resolveAuditFields(
    row: SourceRow,
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourceRowIdentifier?: string;
    },
  ): ResolvedAuditFields {
    const deletedFlag = toBoolean(row.bIsDeleted ?? row.bIsdeleted);
    const deletedDate =
      this.getSourceDate(row, [
        "dDeletedDate",
        "dDeleteddate",
        "dDeletedAt",
        "dDeletedat",
      ]) ??
      this.getSourceDate(row, [
        "dLastUpdateDate",
        "dlastupdatedDate",
        "dCreationDate",
        "dCreatedDate",
      ]) ??
      (deletedFlag ? new Date() : null);
    const deletedBySource = this.getSourceString(row, [
      "nDeletedBy",
      "nDeletedBY",
      "nDeletedby",
    ]);
    const deletedBy = deletedBySource
      ? this.resolveAuditUserId(context, deletedBySource, {
          sourceTable: params.sourceTable,
          sourceRowIdentifier: params.sourceRowIdentifier ?? "?",
          fieldName: "nDeletedBy",
        })
      : (context.bootstrapAdminUserId ?? context.actorUserId);

    if (deletedFlag) {
      context.summary.softDeletedRows += 1;
      const auditSource = this.getSourceDate(row, [
        "dDeletedDate",
        "dDeleteddate",
        "dDeletedAt",
        "dDeletedat",
      ])
        ? "source delete date"
        : this.getSourceDate(row, [
              "dLastUpdateDate",
              "dlastupdatedDate",
              "dCreationDate",
              "dCreatedDate",
            ])
          ? "row audit date"
          : "current migration timestamp";

      this.addFieldStatus(context, {
        sourceTable: params.sourceTable,
        sourceColumn: "bIsDeleted",
        sourceValue: true,
        targetColumn: "deletedAt",
        targetValue: deletedDate,
        status: "transformed",
        note: `Soft-delete inferred from old row; deletedAt resolved from ${auditSource}`,
      });

      if (deletedBy) {
        this.addFieldStatus(context, {
          sourceTable: params.sourceTable,
          sourceColumn: "nDeletedBy",
          sourceValue: deletedBySource,
          targetColumn: "deletedBy",
          targetValue: deletedBy,
          status: "saved",
          note: "Soft-delete actor preserved as source reference only",
        });
      } else {
        this.addWarning(context, {
          sourceTable: params.sourceTable,
          sourceColumn: "nDeletedBy",
          note: `Deleted row ${params.sourceRowIdentifier} has no resolvable deletedBy reference`,
        });
      }
    }

    return {
      deletedAt: deletedFlag ? deletedDate : null,
      deletedBy: deletedFlag ? deletedBy : null,
      wasDeleted: deletedFlag,
      deletedAtSource: deletedFlag
        ? this.getSourceDate(row, [
            "dDeletedDate",
            "dDeleteddate",
            "dDeletedAt",
            "dDeletedat",
          ])
          ? "source delete date"
          : this.getSourceDate(row, [
                "dLastUpdateDate",
                "dlastupdatedDate",
                "dCreationDate",
                "dCreatedDate",
              ])
            ? "row audit date"
            : "current migration timestamp"
        : "not deleted",
    };
  }

  private logLegacyPermissionBlob(
    row: SourceRow,
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourceRowIdentifier: string;
    },
  ) {
    const permissionValue = row.Permission ?? row.permission;
    if (
      permissionValue === undefined ||
      permissionValue === null ||
      String(permissionValue).trim() === ""
    ) {
      return;
    }

    this.addFieldStatus(context, {
      sourceTable: params.sourceTable,
      sourceColumn: "Permission",
      sourceValue: permissionValue,
      targetColumn: "permissions / roles_menu_permissions",
      targetValue: null,
      status: "unmapped",
      note: "Legacy sidebar/menu permission blob captured for manual review; exact decode depends on business rule",
    });
    this.addWarning(context, {
      sourceTable: params.sourceTable,
      sourceColumn: "Permission",
      note: `Permission blob captured for row ${params.sourceRowIdentifier}; review required to map into current permission tables`,
    });
  }

  private addTableResult(
    context: MigrationContext,
    params: {
      sourceTable: string;
      targetTable: string;
      rowCountScanned: number;
      rowCountInserted: number;
      rowCountSkipped: number;
      rowCountFailed: number;
      note: string;
    },
  ) {
    context.tableResults.push({
      sourceTable: params.sourceTable,
      targetTable: params.targetTable,
      rowCountScanned: params.rowCountScanned,
      rowCountInserted: params.rowCountInserted,
      rowCountSkipped: params.rowCountSkipped,
      rowCountFailed: params.rowCountFailed,
      note: params.note,
    });
  }

  private addIdMap(
    context: MigrationContext,
    params: {
      oldTable: string;
      oldId: string | number | null | undefined;
      newTable: string;
      newUuid: string;
      lookupKey: string;
    },
  ) {
    context.idMap.push({
      oldTable: params.oldTable,
      oldId: params.oldId ?? null,
      newTable: params.newTable,
      newUuid: params.newUuid,
      lookupKey: params.lookupKey,
    });
  }

  private async readSourceRows(
    pool: mssql.ConnectionPool,
    tableName: string,
  ): Promise<SourceRow[]> {
    this.logger.log(`Reading source table ${tableName}`);
    const query = `SELECT * FROM ${escapeIdentifier(tableName)}`;
    const result = await pool.request().query(query);
    const rows = result.recordset ?? [];
    this.logger.log(`Read ${rows.length} row(s) from ${tableName}`);
    return rows;
  }

  private async findSourceTableName(
    pool: mssql.ConnectionPool,
    candidates: readonly string[],
  ): Promise<string | null> {
    const lowered = candidates.map((name) =>
      name.replace(/'/g, "''").toLowerCase(),
    );
    const result = await pool.request().query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND LOWER(TABLE_NAME) IN (${lowered
        .map((name) => `'${name}'`)
        .join(", ")})`,
    );
    const names = (result.recordset ?? []).flatMap((row) => {
      const tableName = toNullableString((row as SourceRow).TABLE_NAME);
      return tableName ? [tableName] : [];
    });
    const byLower = new Map<string, string>(
      names.map((name) => [name.toLowerCase(), name]),
    );
    for (const candidate of candidates) {
      const matched = byLower.get(candidate.toLowerCase());
      if (matched) {
        return matched;
      }
    }
    return null;
  }

  private async readSourceTableIfExists(
    pool: mssql.ConnectionPool,
    candidates: readonly string[],
  ): Promise<{ tableName: string; rows: SourceRow[] } | null> {
    const tableName = await this.findSourceTableName(pool, candidates);
    if (!tableName) {
      return null;
    }
    const rows = await this.readSourceRows(pool, tableName);
    return { tableName, rows };
  }

  private async ensureLegacyPlaceLookups(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (context.placeLookupsLoaded) {
      return;
    }

    const city = await this.readSourceTableIfExists(
      pool,
      LEGACY_CITY_TABLE_CANDIDATES.city,
    );
    const city2 = await this.readSourceTableIfExists(
      pool,
      LEGACY_CITY_TABLE_CANDIDATES.city2,
    );
    const combinedCities = combineLegacyCities({
      cityRows: city?.rows ?? [],
      city2Rows: city2?.rows ?? [],
    });
    const cityLookup = cityNameLookupFromCities(combinedCities);
    const districtLookup = districtLookupFromCities(combinedCities);
    const cityByCode = new Map(
      combinedCities.map((item) => [item.cityCode, item]),
    );

    const districtTables: Array<{ tableName: string; rows: SourceRow[] }> = [];
    const loadedDistrictTables = new Set<string>();
    for (const candidate of LEGACY_DISTRICT_TABLE_CANDIDATES) {
      const source = await this.readSourceTableIfExists(pool, [candidate]);
      if (
        source &&
        !loadedDistrictTables.has(source.tableName.toLowerCase())
      ) {
        loadedDistrictTables.add(source.tableName.toLowerCase());
        districtTables.push(source);
      }
    }
    for (const table of districtTables) {
      for (const row of table.rows) {
        const code =
          toNullableString(row.DISTRICTCODE) ??
          toNullableString(row.DistrictCode);
        const name =
          toNullableString(row.DISTRICTNAME) ??
          toNullableString(row.DistrictName);
        if (code && name && !districtLookup.has(code)) {
          districtLookup.set(code, name);
        }
      }
    }

    context.cityLookup = cityLookup;
    context.districtLookup = districtLookup;
    context.cityByCode = cityByCode;
    context.placeLookupsLoaded = true;

    if (!city && !city2) {
      this.addWarning(context, {
        sourceTable: "CTRCITY",
        note: "No CTRCITY/CTRCITY2 table found. City IDs on later records cannot be resolved to names until those tables exist on the old master.",
      });
    } else {
      this.logger.log(
        `[cities] loaded lookup from ${[city, city2]
          .filter(Boolean)
          .map((table) => `${table!.tableName}:${table!.rows.length}`)
          .join(", ")} cities=${combinedCities.length}`,
      );
    }

    if (districtTables.length === 0 && districtLookup.size === 0) {
      this.addWarning(context, {
        sourceTable: "CTRDISTRICT",
        note: "No CTRDISTRICT table found. District names still resolve from CTRCITY2 when a city id is present.",
      });
    }
  }

  private resolveRecordCityText(
    row: SourceRow,
    context: MigrationContext,
    params: {
      sourceTable: string;
      fallback: string;
      targetColumn: string;
    },
  ): string {
    const resolved = resolveLegacyRecordCity(row, {
      nameLookup: context.cityLookup,
      cityByCode: context.cityByCode,
      fallback: params.fallback,
    });

    if (resolved.resolvedFrom === "id") {
      const city = resolved.city;
      this.addTransformation(context, {
        sourceTable: params.sourceTable,
        sourceField: resolved.sourceColumn ?? "nCityID",
        ruleName: "city-id-to-name",
        originalValue: resolved.raw,
        transformedValue: resolved.value,
        result: "transformed",
      });
      this.addFieldStatus(context, {
        sourceTable: params.sourceTable,
        sourceColumn: resolved.sourceColumn ?? "nCityID",
        sourceValue: resolved.raw,
        targetColumn: params.targetColumn,
        targetValue: resolved.value,
        status: "transformed",
        note: city
          ? `Old city id ${city.cityCode} resolved to ${city.name}. CTRCITY2 state=${city.stateName ?? ""} customerStateId=${city.customerStateId ?? ""} district=${city.districtName ?? ""}. Name stored; no cities table is created.`
          : "Old city id resolved through CTRCITY/CTRCITY2; name stored on the new record. No cities table is created.",
      });
    } else if (resolved.resolvedFrom === "unresolved-id") {
      this.addUnmappedColumn(context, {
        sourceTable: params.sourceTable,
        sourceColumn: resolved.sourceColumn ?? "nCityID",
        sourceValue: resolved.raw,
        reason:
          "City id was not found in CTRCITY/CTRCITY2; the numeric id was not stored as city text",
      });
    }

    const district = resolveLegacyPlaceText(
      pickLegacyDistrictReference(row),
      context.districtLookup,
      "",
    );
    if (district.raw) {
      this.addUnmappedColumn(context, {
        sourceTable: params.sourceTable,
        sourceColumn: district.sourceColumn ?? "nDistrictID",
        sourceValue:
          district.resolvedFrom === "id" || district.resolvedFrom === "name"
            ? `${district.raw} -> ${district.value}`
            : district.raw,
        reason:
          "No district column on the new record; resolved district name is logged only",
      });
    }

    return resolved.value;
  }

  private rememberLookup(
    map: Map<string, string>,
    keys: string[],
    id: string,
  ) {
    for (const key of keys) {
      map.set(key, id);
    }
  }

  private ensureSourceRows(
    context: MigrationContext,
    task: InternalTask,
    rows: SourceRow[],
  ) {
    context.sourceCache[task] = rows;
  }

  private getSourceRows(
    context: MigrationContext,
    task: InternalTask,
  ): SourceRow[] {
    return context.sourceCache[task] ?? [];
  }

  private resolveAuditUserId(
    context: MigrationContext,
    sourceValue: any,
    params: {
      sourceTable: string;
      sourceRowIdentifier?: string;
      fieldName: string;
    },
  ): string {
    const sourceKey = toNullableString(sourceValue);
    if (sourceKey) {
      const mapped = this.userMap.get(sourceKey);
      if (mapped) {
        return mapped;
      }

      if (
        sourceKey !== "0" &&
        sourceKey !== "null" &&
        sourceKey !== "undefined"
      ) {
        this.logger.warn(
          `[${params.sourceTable}] row=${params.sourceRowIdentifier} field=${params.fieldName} unresolved user reference=${sourceKey}; using bootstrap fallback`,
        );
      }
    }

    return context.bootstrapAdminUserId ?? context.actorUserId;
  }

  private pickBootstrapUserRow(rows: SourceRow[]): SourceRow | null {
    if (rows.length === 0) {
      return null;
    }

    const ranked = rows
      .map((row) => {
        const code = toNullableString(row.vUID)?.toUpperCase() ?? "";
        const name = toNullableString(row.vName)?.toUpperCase() ?? "";
        const email = toNullableString(row.vMailID)?.toUpperCase() ?? "";
        let score = 0;
        if (toBoolean(row.bIsAdministrator)) score += 100;
        if (code === "ADMIN" || code === "HO" || code === "ALLR") score += 80;
        if (name.includes("ADMIN") || name.includes("HO")) score += 30;
        if (email.includes("ADMIN") || email.includes("HO")) score += 20;
        if (toBoolean(row.bActive)) score += 5;
        if (toBoolean(row.bIsGroup)) score -= 10;
        return { row, score };
      })
      .sort((left, right) => right.score - left.score);

    return ranked[0]?.score > 0 ? ranked[0].row : rows[0];
  }

  private async resolveCompany(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const oldId = row.nCompID ?? row.ncompid ?? row.id ?? row.ID;
    const lookupKey = toNullableString(row.vCompanyName) || `company-${oldId}`;
    const targetTable = "company";
    this.logger.log(
      `[mstcompanyrecord] resolving company oldId=${String(oldId ?? "")} lookupKey=${lookupKey}`,
    );

    if (this.companyMap.has(String(oldId))) {
      return {
        id: this.companyMap.get(String(oldId))!,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
      };
    }

    const mapped = mapLegacyCompanyRecord(row);
    const name = mapped.name;
    const legacyTaxId = mapped.legacyTaxId;
    const extractedPan = {
      pan: mapped.panKind === "invalid" ? null : mapped.panNo,
      kind: mapped.panKind,
    };
    const panNo = mapped.panNo;
    const licenseNo = mapped.fxRegNo;
    const fromDate = mapped.fromDate;
    const toDate = mapped.toDate;
    const createdBy = this.resolveAuditUserId(
      context,
      row.nCreatedBy ?? row.vCreatedBy,
      {
        sourceTable: "mstcompanyrecord",
        sourceRowIdentifier: String(oldId ?? ""),
        fieldName: "nCreatedBy",
      },
    );
    const updatedBy = this.resolveAuditUserId(
      context,
      row.nLastupdatedby ?? row.nLastUpdateBy,
      {
        sourceTable: "mstcompanyrecord",
        sourceRowIdentifier: String(oldId ?? ""),
        fieldName: "nLastupdatedby",
      },
    );
    const audit = this.resolveAuditFields(row, context, {
      sourceTable: "mstcompanyrecord",
      sourceRowIdentifier: String(oldId ?? ""),
    });
    let existing = await this.targetCompanyRepository.findOne({
      where: {
        panNo,
        name,
        fromDate,
        toDate,
      },
    });
    if (!existing && extractedPan.kind === "gstin" && legacyTaxId) {
      existing = await this.targetCompanyRepository.findOne({
        where: {
          panNo: legacyTaxId,
          name,
          fromDate,
          toDate,
        },
      });
    }

    if (existing) {
      this.logger.log(
        `[mstcompanyrecord] reused company oldId=${String(oldId ?? "")} targetId=${existing.id}`,
      );
      let reusedChanged = false;
      if (audit.wasDeleted && context.mode === "real") {
        existing.deletedAt = audit.deletedAt;
        existing.deletedBy = audit.deletedBy;
        reusedChanged = true;
        this.logger.warn(
          `[mstcompanyrecord] applied soft-delete to reused company id=${existing.id}`,
        );
      }
      const legacyRbiName = toNullableString(row.vRBIName);
      if (
        legacyRbiName &&
        toNullableString(existing.cinNo) === legacyRbiName
      ) {
        existing.cinNo = null;
        reusedChanged = true;
        this.addWarning(context, {
          sourceTable: "mstcompanyrecord",
          sourceColumn: "vRBIName",
          note: `Cleared company.cinNo on reused row ${existing.id} because it previously stored vRBIName`,
        });
      }
      if (
        extractedPan.pan &&
        toNullableString(existing.panNo)?.toUpperCase() !== extractedPan.pan
      ) {
        existing.panNo = extractedPan.pan;
        reusedChanged = true;
        this.addWarning(context, {
          sourceTable: "mstcompanyrecord",
          sourceColumn: "cgstno",
          note: `Updated company.panNo on reused row ${existing.id} to extracted PAN ${extractedPan.pan}`,
        });
      }
      if (reusedChanged && context.mode === "real") {
        await this.targetCompanyRepository.save(existing);
      }
      this.companyMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: "mstcompanyrecord",
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      this.logUnmappedCompanyColumns(row, context);
      this.logCompanyPanMapping(row, context, legacyTaxId, extractedPan, panNo);
      return {
        id: existing.id,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
        softDeleted: audit.wasDeleted,
      };
    }
    const company = this.targetCompanyRepository.create({
      name: mapped.name,
      shortCode: null,
      formerlyKnownName: mapped.formerlyKnownName,
      cinNo: mapped.cinNo,
      panNo: mapped.panNo,
      fxRegNo: mapped.fxRegNo,
      fxRegDate: mapped.fxRegDate,
      fromDate: mapped.fromDate,
      toDate: mapped.toDate,
      logo: mapped.logo,
      aeonLicNo: mapped.aeonLicNo,
      website: null,
      email: null,
      createdBy,
      updatedBy,
      deletedAt: audit.deletedAt,
      deletedBy: audit.deletedBy,
    });

    this.logUnmappedCompanyColumns(row, context);
    this.logCompanyPanMapping(row, context, legacyTaxId, extractedPan, panNo);

    if (context.mode === "real") {
      const saved = await this.targetCompanyRepository.save(company);
      this.logger.log(
        `[mstcompanyrecord] created company id=${saved.id} version=${String(fromDate ?? "")}..${String(toDate ?? "")}`,
      );
      this.companyMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: "mstcompanyrecord",
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      return {
        id: saved.id,
        created: true,
        sourceId: oldId,
        targetTable,
        lookupKey,
        softDeleted: audit.wasDeleted,
      };
    }

    const mockId = `mock-company-${oldId ?? randomUUID()}`;
    this.logger.log(
      `[mstcompanyrecord] mock company id=${mockId} version=${String(fromDate ?? "")}..${String(toDate ?? "")}`,
    );
    this.companyMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: "mstcompanyrecord",
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    return {
      id: mockId,
      created: true,
      sourceId: oldId,
      targetTable,
      lookupKey,
      softDeleted: audit.wasDeleted,
    };
  }

  private logUnmappedCompanyColumns(row: SourceRow, context: MigrationContext) {
    const unmapped: Array<[string, any, string]> = [
      [
        "vRBIName",
        row.vRBIName,
        "RBI person name is not CIN No.; company.cinNo stays empty unless a real CIN source exists",
      ],
      [
        "vRBIDesig",
        row.vRBIDesig,
        "RBI designation has no matching company column",
      ],
      [
        "vRBIPlace",
        row.vRBIPlace,
        "RBI place has no matching company column",
      ],
      [
        "vRBIAdd1",
        row.vRBIAdd1,
        "RBI address has no matching company column",
      ],
      [
        "vRBIAdd2",
        row.vRBIAdd2,
        "RBI address has no matching company column",
      ],
      [
        "vRBIAdd3",
        row.vRBIAdd3,
        "RBI address has no matching company column",
      ],
      [
        "vBranchCode",
        row.vBranchCode,
        "Branch code is kept for sheet review only and is not stored on company",
      ],
    ];

    for (const [sourceColumn, sourceValue, reason] of unmapped) {
      if (sourceValue === undefined || sourceValue === null || sourceValue === "") {
        continue;
      }
      this.addUnmappedColumn(context, {
        sourceTable: "mstcompanyrecord",
        sourceColumn,
        sourceValue,
        reason,
      });
    }
  }

  private logCompanyPanMapping(
    row: SourceRow,
    context: MigrationContext,
    legacyTaxId: string | null,
    extractedPan: { pan: string | null; kind: "pan" | "gstin" | "invalid" },
    panNo: string,
  ) {
    if (!legacyTaxId) {
      this.addWarning(context, {
        sourceTable: "mstcompanyrecord",
        sourceColumn: "cgstno",
        note: `No tax id on source row; panNo fell back to ${panNo}`,
      });
      return;
    }

    if (extractedPan.kind === "gstin" && extractedPan.pan) {
      this.addTransformation(context, {
        sourceTable: "mstcompanyrecord",
        sourceField: "cgstno",
        ruleName: "gstin-to-pan",
        originalValue: legacyTaxId,
        transformedValue: extractedPan.pan,
        result: "transformed",
      });
      this.addFieldStatus(context, {
        sourceTable: "mstcompanyrecord",
        sourceColumn: "cgstno",
        sourceValue: legacyTaxId,
        targetColumn: "panNo",
        targetValue: extractedPan.pan,
        status: "transformed",
        note: "GSTIN is not PAN; characters 3-12 stored as company.panNo. Company has no GST column",
      });
      this.addUnmappedColumn(context, {
        sourceTable: "mstcompanyrecord",
        sourceColumn: "cgstno",
        sourceValue: legacyTaxId,
        reason:
          "Full GSTIN is not stored on company; PAN was extracted. Branch GST stays on branches.gstNo from vServiceTaxRegNo",
      });
      return;
    }

    this.addFieldStatus(context, {
      sourceTable: "mstcompanyrecord",
      sourceColumn: "cgstno",
      sourceValue: legacyTaxId,
      targetColumn: "panNo",
      targetValue: panNo,
      status: extractedPan.kind === "pan" ? "saved" : "transformed",
      note:
        extractedPan.kind === "pan"
          ? "Source value was already a PAN"
          : `Source tax id was not a PAN or GSTIN; panNo used ${panNo}`,
    });
  }

  private getSourceLocationType(row: SourceRow): string | null {
    return (
      toNullableString(row.vLocationType) ??
      toNullableString(row.nLocationType) ??
      toNullableString(row.locationType) ??
      null
    );
  }

  private async resolveBranchLocationType(
    row: SourceRow,
    context: MigrationContext,
    oldId: string | number | null | undefined,
  ): Promise<{
    id: string | null;
    created: boolean;
    lookupKey: string | null;
  } | null> {
    const raw = this.getSourceLocationType(row);
    if (!raw) {
      return null;
    }

    const lookupKey = `LOCATIONTYPE:${normalizeCode(raw)}`;
    const existing = await this.targetSelectOptionRepository.findOne({
      where: {
        code: "LOCATIONTYPE",
        value: raw,
      },
    });

    if (existing) {
      this.addFieldStatus(context, {
        sourceTable: "mstcompany",
        sourceColumn: "vLocationType",
        sourceValue: raw,
        targetColumn: "locationType",
        targetValue: existing.id,
        status: "saved",
        note: "Resolved through category_options.LOCATIONTYPE and reused existing option",
      });
      this.addColumnMapping(context, {
        sourceTable: "mstcompany",
        sourceColumn: "vLocationType",
        sourceValue: raw,
        targetColumn: "locationType",
        targetValue: existing.id,
        result: "reused",
      });
      return { id: existing.id, created: false, lookupKey };
    }

    if (context.mode === "real") {
      const createdBy = context.bootstrapAdminUserId ?? context.actorUserId;
      const option = this.targetSelectOptionRepository.create({
        code: "LOCATIONTYPE",
        value: raw,
        label: raw,
        sortOrder: 0,
        isActive: true,
        createdBy,
        updatedBy: createdBy,
      });
      const saved = await this.targetSelectOptionRepository.save(option);
      this.logger.log(
        `[mstcompany] created lookup category option LOCATIONTYPE value=${raw} id=${saved.id}`,
      );
      this.addFieldStatus(context, {
        sourceTable: "mstcompany",
        sourceColumn: "vLocationType",
        sourceValue: raw,
        targetColumn: "locationType",
        targetValue: saved.id,
        status: "transformed",
        note: "Created missing category_options row for branch location type",
      });
      this.addColumnMapping(context, {
        sourceTable: "mstcompany",
        sourceColumn: "vLocationType",
        sourceValue: raw,
        targetColumn: "locationType",
        targetValue: saved.id,
        result: "created",
      });
      this.addIdMap(context, {
        oldTable: "mstcompany",
        oldId,
        newTable: "category_options",
        newUuid: saved.id,
        lookupKey,
      });
      return { id: saved.id, created: true, lookupKey };
    }

    const mockId = `mock-location-type-${normalizeCode(raw)}-${String(oldId ?? randomUUID())}`;
    this.logger.log(
      `[mstcompany] mock create lookup category option LOCATIONTYPE value=${raw} id=${mockId}`,
    );
    this.addFieldStatus(context, {
      sourceTable: "mstcompany",
      sourceColumn: "vLocationType",
      sourceValue: raw,
      targetColumn: "locationType",
      targetValue: mockId,
      status: "transformed",
      note: "Mock run would create category_options row for branch location type",
    });
    this.addColumnMapping(context, {
      sourceTable: "mstcompany",
      sourceColumn: "vLocationType",
      sourceValue: raw,
      targetColumn: "locationType",
      targetValue: mockId,
      result: "mock-created",
    });
    return { id: mockId, created: true, lookupKey };
  }

  private async resolveBranchGeography(
    row: SourceRow,
    context: MigrationContext,
    oldId: string | number | null | undefined,
  ): Promise<{
    country: Country | null;
    state: State | null;
    gstState: string | null;
    note: string;
  }> {
    const lookupValues = collectBranchStateLookupValues(
      row,
      context.cityByCode,
    );
    const gstNo = toNullableString(row.vServiceTaxRegNo);
    const indianGst =
      extractPanFromLegacyTaxId(gstNo).kind === "gstin" ||
      (gstNo !== null && gstNo.length === 15);

    const findState = async (value: string): Promise<State | null> => {
      const mappedId =
        this.stateMap.get(`gst:${padGstStateCode(value) ?? value}`) ??
        this.stateMap.get(`code:${value}`) ??
        this.stateMap.get(`ctr:${value}`) ??
        this.stateMap.get(value) ??
        this.stateMap.get(`name:${canonicalGeographyName(value)}`);
      if (mappedId) {
        if (!isPersistedUuid(mappedId)) {
          return { id: mappedId } as State;
        }
        const fromMap = await this.targetStateRepository.findOne({
          where: { id: mappedId },
          relations: { country: true },
        });
        if (fromMap) {
          return fromMap;
        }
        return { id: mappedId } as State;
      }

      return this.targetStateRepository.findOne({
      where: [
          { code: value },
          { name: value },
          { gstStateCode: padGstStateCode(value) ?? value },
          { ctrStateCode: value },
        ],
        relations: { country: true },
      });
    };

    for (const value of lookupValues) {
      const stateMatch = await findState(value);
      if (!stateMatch) {
        continue;
      }
      const indiaId = indianGst ? await this.resolveIndiaCountryId() : null;
      const country =
        stateMatch.country ?? (indiaId ? ({ id: indiaId } as Country) : null);
      this.addFieldStatus(context, {
        sourceTable: "mstcompany",
        sourceColumn: "vServiceTaxRegNo / STDCode / vLocation",
        sourceValue: lookupValues.join(", "),
        targetColumn: "state_id / country_id / gstState",
        targetValue: {
          stateId: stateMatch.id,
          countryId: country?.id ?? stateMatch.country?.id ?? null,
          gstState: stateMatch.gstStateCode ?? stateMatch.name,
        },
        status: "saved",
        note: `Resolved branch geography through state lookup using ${value}`,
      });
      this.addColumnMapping(context, {
        sourceTable: "mstcompany",
        sourceColumn: "vLocation",
        sourceValue: row.vLocation,
        targetColumn: "state_id",
        targetValue: stateMatch.id,
        result: "reused",
      });
      return {
        country: country ?? stateMatch.country ?? null,
        state: stateMatch,
        gstState: stateMatch.gstStateCode ?? stateMatch.name,
        note: `Resolved as state reference via ${value}`,
      };
    }

    const indiaId = indianGst ? await this.resolveIndiaCountryId() : null;
    if (indiaId) {
      return {
        country: { id: indiaId } as Country,
        state: null,
        gstState:
          padGstStateCode(gstNo?.slice(0, 2)) ??
          toNullableString(row.vLocation) ??
          toNullableString(row.vCity),
        note: "Indian GSTIN present; country_id set to India. State was not matched.",
      };
    }

    const rawLocation = toNullableString(row.vLocation);
    const city = toNullableString(row.vCity);
    if (!rawLocation) {
      return {
        country: null,
        state: null,
        gstState: city ?? null,
        note: "No vLocation value supplied; city preserved as fallback geography text",
      };
    }

    const countryMatch = await this.targetCountryRepository.findOne({
      where: [
        { code: rawLocation },
        { name: rawLocation },
        { lrsCountryCode: rawLocation },
        { ctrCountryCode: rawLocation },
      ],
    });

    if (countryMatch) {
      return {
        country: countryMatch,
        state: null,
        gstState: city ?? rawLocation,
        note: "Resolved as country reference",
      };
    }

    this.addUnmappedColumn(context, {
      sourceTable: "mstcompany",
      sourceColumn: "vLocation",
      sourceValue: rawLocation,
      reason: "No safe state/country match found in current lookup tables",
    });
    return {
      country: null,
      state: null,
      gstState: rawLocation,
      note: "Raw location preserved as fallback text",
    };
  }

  private getLegacyCountryIdentifier(
    row: SourceRow,
  ): string | number | null | undefined {
    return (
      row.nCountryID ??
      row.nCountryId ??
      row.ncountryid ??
      row.countryId ??
      row.country_id ??
      row.CountryID ??
      row.id ??
      row.ID
    );
  }

  private getLegacyCountrySourceRows(context: MigrationContext): SourceRow[] {
    return context.sourceCache.legacyCountryCandidates ?? [];
  }

  private async loadLegacyCountryCandidates(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<SourceRow[]> {
    const cached = this.getLegacyCountrySourceRows(context);
    if (cached.length > 0) {
      return cached;
    }

    const discoveredTables: string[] = [];
    try {
      const result = await pool
        .request()
        .query(
          `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND LOWER(TABLE_NAME) LIKE '%country%'`,
        );
      for (const row of result.recordset ?? []) {
        const tableName = toNullableString(row.TABLE_NAME);
        if (tableName) {
          discoveredTables.push(tableName);
        }
      }
    } catch (error) {
      this.logger.warn(
        `[mcurrency] could not inspect INFORMATION_SCHEMA.TABLES for country lookup candidates: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }

    const fallbackTables = [
      "mstcountry",
      "mcountry",
      "country",
      "countries",
      "mst_country",
      "tblcountry",
    ];
    const tableNames = [...new Set([...discoveredTables, ...fallbackTables])];
    const rows: SourceRow[] = [];

    for (const tableName of tableNames) {
      try {
        const tableRows = await this.readSourceRows(pool, tableName);
        for (const row of tableRows) {
          rows.push({
            ...row,
            __legacySourceTable: tableName,
          });
        }
      } catch (error) {
        this.logger.warn(
          `[mcurrency] skipping legacy country candidate table ${tableName}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }

    context.sourceCache.legacyCountryCandidates = rows;
    this.logger.log(
      `[mcurrency] loaded ${rows.length} legacy country candidate row(s)`,
    );
    return rows;
  }

  private async resolveCountryGroupFromLegacyRow(
    row: SourceRow,
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourceRowIdentifier: string;
    },
  ): Promise<CountryGroup | null> {
    const rawName =
      this.getSourceString(row, [
        "vCountryGroup",
        "countryGroup",
        "countryGroupName",
        "groupName",
        "group",
      ]) ?? null;
    if (!rawName) {
      return null;
    }

    const normalizedCode = normalizeCode(rawName);
    const existing = await this.targetCountryGroupRepository.findOne({
      where: [{ code: normalizedCode }, { name: rawName }],
    });
    if (existing) {
      return existing;
    }

    const group = this.targetCountryGroupRepository.create({
      code: normalizedCode,
      name: rawName,
      createdBy: this.resolveAuditUserId(
        context,
        row.nCreatedBy ?? row.nCreatedBY,
        {
          sourceTable: params.sourceTable,
          sourceRowIdentifier: params.sourceRowIdentifier ?? "?",
          fieldName: "nCreatedBy",
        },
      ),
      updatedBy: this.resolveAuditUserId(
        context,
        row.nLastUpdateBy ?? row.nLastupdatedBy,
        {
          sourceTable: params.sourceTable,
          sourceRowIdentifier: params.sourceRowIdentifier ?? "?",
          fieldName: "nLastUpdateBy",
        },
      ),
    });

    if (context.mode === "real") {
      return this.targetCountryGroupRepository.save(group);
    }

    return {
      ...group,
      id: `mock-country-group-${normalizedCode}`,
    } as CountryGroup;
  }

  private async resolveLegacyCountryReference(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
    legacyCountryId: string | number | null | undefined,
    params: {
      sourceTable: string;
      sourceRowIdentifier: string;
    },
  ): Promise<Country | null> {
    if (
      legacyCountryId === null ||
      legacyCountryId === undefined ||
      legacyCountryId === ""
    ) {
      this.addSkippedRow(context, {
        sourceTable: params.sourceTable,
        sourceRowIdentifier: params.sourceRowIdentifier ?? "?",
        reason: "Currency country reference missing",
        fallbackAction: "Currency row skipped",
      });
      return null;
    }

    const legacyKey = String(legacyCountryId);
    const lookupKeys = [
      legacyKey,
      `ctr:${legacyKey}`,
      `mst:${legacyKey}`,
      `lrs:${legacyKey}`,
      `code:${legacyKey}`,
      `lrs-code:${legacyKey}`,
    ];
    for (const key of lookupKeys) {
      const cachedTargetId = this.countryMap.get(key);
      if (!cachedTargetId) {
        continue;
      }
      const cachedCountry = isPersistedUuid(cachedTargetId)
        ? await this.targetCountryRepository.findOne({
            where: { id: cachedTargetId },
            relations: { countryGroup: true },
          })
        : null;
      if (cachedCountry) {
        return cachedCountry;
      }
      return {
        id: cachedTargetId,
      } as Country;
    }

    const existingByCode = await this.targetCountryRepository.findOne({
      where: [
        { code: legacyKey },
        { lrsCountryCode: legacyKey },
        { ctrCountryCode: legacyKey },
      ],
      relations: { countryGroup: true },
    });
    if (existingByCode) {
      this.countryMap.set(legacyKey, existingByCode.id);
      return existingByCode;
    }

    if (this.isTaskIncluded(context, "country")) {
      this.addSkippedRow(context, {
        sourceTable: params.sourceTable,
        sourceRowIdentifier: params.sourceRowIdentifier ?? "?",
        reason: `Could not resolve legacy country id ${legacyKey} from combined country migration`,
        fallbackAction: "Currency row skipped",
      });
      this.addUnmappedColumn(context, {
        sourceTable: params.sourceTable,
        sourceColumn: "nCountryID",
        sourceValue: legacyCountryId,
        reason:
          "Country id was not present in CTRCOUNTRY/ctrcountry2/tb_MstCountry/LRSCountry maps",
      });
      return null;
    }

    const cachedTargetId = this.countryMap.get(legacyKey);
    if (cachedTargetId) {
      const cachedCountry = isPersistedUuid(cachedTargetId)
        ? await this.targetCountryRepository.findOne({
        where: { id: cachedTargetId },
        relations: { countryGroup: true },
          })
        : null;
      if (cachedCountry) {
        return cachedCountry;
      }
      return {
        id: cachedTargetId,
      } as Country;
    }

    const candidates = await this.loadLegacyCountryCandidates(pool, context);
    const sourceRow = candidates.find((candidate) => {
      const candidateId = this.getLegacyCountryIdentifier(candidate);
      return (
        candidateId !== undefined &&
        candidateId !== null &&
        String(candidateId) === legacyKey
      );
    });

    if (!sourceRow) {
      this.addSkippedRow(context, {
        sourceTable: params.sourceTable,
        sourceRowIdentifier: params.sourceRowIdentifier ?? "?",
        reason: `Could not resolve legacy country id ${legacyKey} from available source tables`,
        fallbackAction: "Currency row skipped",
      });
      this.addUnmappedColumn(context, {
        sourceTable: params.sourceTable,
        sourceColumn: "nCountryID",
        sourceValue: legacyCountryId,
        reason:
          "Legacy country source row was not found in the connected MSSQL database",
      });
      return null;
    }

    const sourceTableName =
      toNullableString(sourceRow.__legacySourceTable) ?? "legacy-country";
    const countryCode =
      this.getSourceString(sourceRow, [
        "vCncode",
        "vCountryCode",
        "countryCode",
        "code",
        "isoCode",
        "alpha2Code",
      ]) ??
      normalizeCode(
        this.getSourceString(sourceRow, [
          "vCnName",
          "vCountryName",
          "countryName",
          "name",
        ]) ?? `COUNTRY_${legacyKey}`,
      );
    const countryName =
      this.getSourceString(sourceRow, [
        "vCnName",
        "vCountryName",
        "countryName",
        "name",
        "description",
      ]) ?? countryCode;
    const countryGroup = await this.resolveCountryGroupFromLegacyRow(
      sourceRow,
      context,
      {
        sourceTable: sourceTableName,
        sourceRowIdentifier: String(
          this.getLegacyCountryIdentifier(sourceRow) ?? legacyKey,
        ),
      },
    );
    const existing = await this.targetCountryRepository.findOne({
      where: [
        { code: countryCode },
        { name: countryName },
        { lrsCountryCode: countryCode },
        { ctrCountryCode: countryCode },
      ],
      relations: {
        countryGroup: true,
      },
    });

    if (existing) {
      if (
        countryGroup &&
        (!existing.countryGroup || existing.countryGroup.id !== countryGroup.id)
      ) {
        existing.countryGroup = { id: countryGroup.id } as CountryGroup;
      }
      if (context.mode === "real" && countryGroup) {
        await this.targetCountryRepository.save(existing);
      }
      this.countryMap.set(legacyKey, existing.id);
      this.addIdMap(context, {
        oldTable: sourceTableName,
        oldId: this.getLegacyCountryIdentifier(sourceRow),
        newTable: "countries",
        newUuid: existing.id,
        lookupKey: `${countryCode}:${countryName}`,
      });
      return existing;
    }

    const country = {
      code: countryCode,
      name: countryName,
      countryGroup: countryGroup
        ? ({ id: countryGroup.id } as CountryGroup)
        : null,
      lrsCountryCode: countryCode,
      ctrCountryCode: countryCode,
      riskCategory: "low",
      restrictedCountry: false,
      greyListCountry: false,
      baseCountry: false,
      createdBy: this.resolveAuditUserId(
        context,
        sourceRow.nCreatedBy ?? sourceRow.nCreatedBY,
        {
          sourceTable: sourceTableName,
          sourceRowIdentifier: String(
            this.getLegacyCountryIdentifier(sourceRow) ?? legacyKey,
          ),
          fieldName: "nCreatedBy",
        },
      ),
      updatedBy: this.resolveAuditUserId(
        context,
        sourceRow.nLastUpdateBy ?? sourceRow.nLastupdatedBy,
        {
          sourceTable: sourceTableName,
          sourceRowIdentifier: String(
            this.getLegacyCountryIdentifier(sourceRow) ?? legacyKey,
          ),
          fieldName: "nLastUpdateBy",
        },
      ),
    } as Country;

    if (context.mode === "real") {
      const saved = await this.targetCountryRepository.save(country);
      this.countryMap.set(legacyKey, saved.id);
      this.addIdMap(context, {
        oldTable: sourceTableName,
        oldId: this.getLegacyCountryIdentifier(sourceRow),
        newTable: "countries",
        newUuid: saved.id,
        lookupKey: `${countryCode}:${countryName}`,
      });
      this.addFieldStatus(context, {
        sourceTable: params.sourceTable,
        sourceColumn: "nCountryID",
        sourceValue: legacyCountryId,
        targetColumn: "country_id",
        targetValue: saved.id,
        status: "saved",
        note: `Resolved and created/reused country from legacy table ${sourceTableName}`,
      });
      return saved;
    }

    const mockId = `mock-country-${legacyKey}`;
    this.countryMap.set(legacyKey, mockId);
    this.addIdMap(context, {
      oldTable: sourceTableName,
      oldId: this.getLegacyCountryIdentifier(sourceRow),
      newTable: "countries",
      newUuid: mockId,
      lookupKey: `${countryCode}:${countryName}`,
    });
    this.addFieldStatus(context, {
      sourceTable: params.sourceTable,
      sourceColumn: "nCountryID",
      sourceValue: legacyCountryId,
      targetColumn: "country_id",
      targetValue: mockId,
      status: "saved",
      note: `Would resolve country from legacy table ${sourceTableName}`,
    });
    return { ...country, id: mockId } as Country;
  }

  private async resolveBranch(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const oldId = row.nBranchID ?? row.nbranchid ?? row.id ?? row.ID;
    const mappedBranch = mapLegacyBranchRecord(row);
    const lookupKey = toNullableString(row.vBranchCode) || `branch-${oldId}`;
    const targetTable = "branches";
    this.logger.log(
      `[mstcompany] resolving branch oldId=${String(oldId ?? "")} lookupKey=${lookupKey}`,
    );

    if (this.branchMap.has(String(oldId))) {
      return {
        id: this.branchMap.get(String(oldId))!,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
      };
    }

    const transformedCode = {
      value: mappedBranch.code,
      transformed: mappedBranch.codeTransformed,
      sourceField: mappedBranch.codeSourceField,
    };
    const branchNumber =
      toNullableNumber(row.nBranchID) ?? toNullableNumber(oldId) ?? 0;
    const companyOldId = mappedBranch.companyOldId;
    const companyId =
      companyOldId !== undefined && companyOldId !== null
        ? (this.companyMap.get(String(companyOldId)) ?? null)
        : null;
    const locationType = await this.resolveBranchLocationType(
      row,
      context,
      oldId,
    );
    const geography = await this.resolveBranchGeography(row, context, oldId);
    const createdBy = this.resolveAuditUserId(
      context,
      row.nCreatedBy ?? row.nCreatedBY ?? row.vCreatedBy,
      {
        sourceTable: "mstcompany",
        sourceRowIdentifier: String(oldId ?? ""),
        fieldName: "nCreatedBy",
      },
    );
    const updatedBy = this.resolveAuditUserId(
      context,
      row.nLastUpdateBy ?? row.nLastupdatedBy,
      {
        sourceTable: "mstcompany",
        sourceRowIdentifier: String(oldId ?? ""),
        fieldName: "nLastUpdateBy",
      },
    );
    const audit = this.resolveAuditFields(row, context, {
      sourceTable: "mstcompany",
      sourceRowIdentifier: String(oldId ?? ""),
    });
    const existing = await this.targetBranchRepository.findOne({
      where: [{ code: transformedCode.value }, { branchNumber }],
    });

    if (existing) {
      this.logger.log(
        `[mstcompany] reused branch oldId=${String(oldId ?? "")} targetId=${existing.id}`,
      );
      if (audit.wasDeleted && context.mode === "real") {
        existing.deletedAt = audit.deletedAt;
        existing.deletedBy = audit.deletedBy;
        await this.targetBranchRepository.save(existing);
        this.logger.warn(
          `[mstcompany] applied soft-delete to reused branch id=${existing.id}`,
        );
      }
      this.branchMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: "mstcompany",
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      return {
        id: existing.id,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
        softDeleted: audit.wasDeleted,
      };
    }

    const branch = this.targetBranchRepository.create({
      company: companyId ? ({ id: companyId } as Company) : null,
      country: geography.country
        ? ({ id: geography.country.id } as Country)
        : null,
      state: geography.state ? ({ id: geography.state.id } as State) : null,
      code: mappedBranch.code,
      name: mappedBranch.name,
      branchNumber,
      address1: toStringOrFallback(row.vAddress1, "UNKNOWN"),
      address2: toNullableString(row.vAddress2),
      address3: toNullableString(row.vAddress3),
      city: this.resolveRecordCityText(row, context, {
        sourceTable: "mstcompany",
        fallback: mappedBranch.city,
        targetColumn: "city",
      }),
      gstState: geography.gstState,
      pinCode: mappedBranch.pinCode,
      gstNo: mappedBranch.gstNo,
      fxRegNo: mappedBranch.fxRegNo,
      fxRegDate: mappedBranch.fxRegDate,
      contactName: mappedBranch.contactName,
      contactNo: mappedBranch.contactNo,
      branchEmail: mappedBranch.branchEmail,
      aeonBranchLic: mappedBranch.fxRegNo,
      locationType: locationType?.id ? ({ id: locationType.id } as any) : null,
      cashHolding: toNullableNumber(row.nCashLimit),
      cashHoldingTemp: toNullableNumber(row.ntempCashLimit),
      currHolding: toNullableNumber(row.nCurrencyLimit),
      currHoldingTemp: toNullableNumber(row.ntempCurrencyLimit),
      isHeadOffice: mappedBranch.isHeadOffice,
      isActive: mappedBranch.isActive,
      createdBy,
      updatedBy,
      deletedAt: audit.deletedAt,
      deletedBy: audit.deletedBy,
    });

    this.addFieldStatus(context, {
      sourceTable: "mstcompany",
      sourceColumn: "vLocation",
      sourceValue: row.vLocation,
      targetColumn: "state_id / country_id / gstState",
      targetValue: {
        stateId: geography.state?.id ?? null,
        countryId: geography.country?.id ?? null,
        gstState: geography.gstState,
      },
      status: geography.state || geography.country ? "saved" : "unmapped",
      note: geography.note,
    });

    if (
      row.nAttachedToBranchID !== undefined ||
      row.nWUBranchID !== undefined ||
      row.nReportingBranchID !== undefined ||
      row.nAccountUSERID !== undefined ||
      row.nOperationalUserID !== undefined ||
      row.nBranchBMID !== undefined ||
      row.vBranchID !== undefined
    ) {
      const branchRelationFields = [
        ["nAttachedToBranchID", row.nAttachedToBranchID],
        ["nWUBranchID", row.nWUBranchID],
        ["nReportingBranchID", row.nReportingBranchID],
        ["nAccountUSERID", row.nAccountUSERID],
        ["nOperationalUserID", row.nOperationalUserID],
        ["nBranchBMID", row.nBranchBMID],
        ["vBranchID", row.vBranchID],
      ] as const;

      for (const [fieldName, value] of branchRelationFields) {
        if (value === undefined || value === null || value === "") {
          continue;
        }

        const isUserField =
          fieldName === "nAccountUSERID" || fieldName === "nOperationalUserID";
        const resolvedValue = isUserField
          ? await this.resolveAuditUserId(context, value, {
              sourceTable: "mstcompany",
              sourceRowIdentifier: String(oldId ?? ""),
              fieldName,
            })
          : (this.branchMap.get(String(value)) ?? null);

        this.addFieldStatus(context, {
          sourceTable: "mstcompany",
          sourceColumn: fieldName,
          sourceValue: value,
          targetColumn: "relation metadata",
          targetValue: resolvedValue,
          status: resolvedValue ? "saved" : "unmapped",
          note: "Relation-only source field logged for branch review; not written directly to branches table",
        });
      }
    }

    if (transformedCode.transformed) {
      this.addTransformation(context, {
        sourceTable: "mstcompany",
        sourceField: transformedCode.sourceField,
        ruleName: "branch-code-normalization",
        originalValue: row[transformedCode.sourceField],
        transformedValue: transformedCode.value,
        result: "transformed",
      });
      this.addFieldStatus(context, {
        sourceTable: "mstcompany",
        sourceColumn: transformedCode.sourceField,
        sourceValue: row[transformedCode.sourceField],
        targetColumn: "code",
        targetValue: transformedCode.value,
        status: "transformed",
        note: `Branch code normalized to ${BRANCH_CODE_LENGTH} characters`,
      });
    }

    if (context.mode === "real") {
      const saved = await this.targetBranchRepository.save(branch);
      this.logger.log(`[mstcompany] created branch id=${saved.id}`);
      this.branchMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: "mstcompany",
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      return {
        id: saved.id,
        created: true,
        sourceId: oldId,
        targetTable,
        lookupKey,
        softDeleted: audit.wasDeleted,
      };
    }

    const mockId = `mock-branch-${oldId ?? randomUUID()}`;
    this.logger.log(`[mstcompany] mock branch id=${mockId}`);
    this.branchMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: "mstcompany",
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    return {
      id: mockId,
      created: true,
      sourceId: oldId,
      targetTable,
      lookupKey,
      softDeleted: audit.wasDeleted,
    };
  }

  private async resolveCounter(
    row: SourceRow,
    context: MigrationContext,
    pool?: mssql.ConnectionPool,
  ): Promise<ResolvedRecord> {
    const oldId =
      row.nCounterID ?? row.nCounterId ?? row.ncounterid ?? row.id ?? row.ID;
    const lookupKey =
      toNullableString(row.vCounterID) ||
      toNullableString(row.vCounterId) ||
      toNullableString(row.vCounterName) ||
      `counter-${oldId}`;
    const targetTable = "counters";
    this.logger.log(
      `[mstcounter] resolving counter oldId=${String(oldId ?? "")} lookupKey=${lookupKey}`,
    );

    if (this.counterMap.has(String(oldId))) {
      const mapped = {
        id: this.counterMap.get(String(oldId))!,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
      };
      await this.linkCounterHintBranch(row, mapped.id, context, pool);
      return mapped;
    }

    const counterNo =
      toNullableNumber(row.vCounterID) ??
      toNullableNumber(row.vCounterId) ??
      toNullableNumber(row.nCounterID) ??
      toNullableNumber(row.nCounterId) ??
      1;
    const createdBy = this.resolveAuditUserId(
      context,
      row.nCreatedBy ?? row.nCreatedBY,
      {
        sourceTable: "mstcounter",
        sourceRowIdentifier: String(oldId ?? ""),
        fieldName: "nCreatedBy",
      },
    );
    const updatedBy = this.resolveAuditUserId(
      context,
      row.nLastUpdateBy ?? row.nLastupdatedBy,
      {
        sourceTable: "mstcounter",
        sourceRowIdentifier: String(oldId ?? ""),
        fieldName: "nLastUpdateBy",
      },
    );
    const audit = this.resolveAuditFields(row, context, {
      sourceTable: "mstcounter",
      sourceRowIdentifier: String(oldId ?? ""),
    });
    const existing = await this.targetCounterRepository.findOne({
      where: [
        {
          counterNo,
          name: toStringOrFallback(
            row.vCounterName || row.vDescription,
            `Counter ${oldId}`,
          ),
        },
      ],
    });

    if (existing) {
      this.logger.log(
        `[mstcounter] reused counter oldId=${String(oldId ?? "")} targetId=${existing.id}`,
      );
      if (audit.wasDeleted && context.mode === "real") {
        existing.deletedAt = audit.deletedAt;
        existing.deletedBy = audit.deletedBy;
        await this.targetCounterRepository.save(existing);
        this.logger.warn(
          `[mstcounter] applied soft-delete to reused counter id=${existing.id}`,
        );
      }
      this.counterMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: "mstcounter",
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      await this.linkCounterHintBranch(row, existing.id, context, pool);
      return {
        id: existing.id,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
        softDeleted: audit.wasDeleted,
      };
    }

    const counter = this.targetCounterRepository.create({
      counterNo,
      name: toStringOrFallback(
        row.vCounterName || row.vDescription,
        `Counter ${oldId}`,
      ),
      isActive: toBoolean(row.bIsActive),
      isRetail: false,
      isBulk: false,
      isCombine: false,
      createdBy,
      updatedBy,
      deletedAt: audit.deletedAt,
      deletedBy: audit.deletedBy,
    });

    if (context.mode === "real") {
      const saved = await this.targetCounterRepository.save(counter);
      this.logger.log(`[mstcounter] created counter id=${saved.id}`);
      this.counterMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: "mstcounter",
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      await this.linkCounterHintBranch(row, saved.id, context, pool);
      return {
        id: saved.id,
        created: true,
        sourceId: oldId,
        targetTable,
        lookupKey,
        softDeleted: audit.wasDeleted,
      };
    }

    const mockId = `mock-counter-${oldId ?? randomUUID()}`;
    this.logger.log(`[mstcounter] mock counter id=${mockId}`);
    this.counterMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: "mstcounter",
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    await this.linkCounterHintBranch(row, mockId, context, pool);
    return {
      id: mockId,
      created: true,
      sourceId: oldId,
      targetTable,
      lookupKey,
      softDeleted: audit.wasDeleted,
    };
  }

  private auditActorId(context: MigrationContext): string {
    return context.bootstrapAdminUserId ?? context.actorUserId;
  }

  private rememberBranchCounter(
    context: MigrationContext,
    branchId: string,
    counterId: string,
  ) {
    const counters = context.branchCounters.get(branchId) ?? [];
    if (!counters.includes(counterId)) {
      counters.push(counterId);
      context.branchCounters.set(branchId, counters);
    }
  }

  private async linkCounterHintBranch(
    row: SourceRow,
    counterId: string,
    context: MigrationContext,
    pool?: mssql.ConnectionPool,
  ) {
    const branchOldId = row.nBranchID ?? row.nbranchid;
    if (branchOldId === undefined || branchOldId === null || branchOldId === "") {
      return;
    }

    let branchId = this.branchMap.get(String(branchOldId)) ?? null;
    if (!branchId && pool) {
      branchId = await this.resolveBranchByOldId(pool, context, branchOldId);
    }
    if (!branchId) {
      this.addWarning(context, {
        sourceTable: "mstcounter",
        sourceColumn: "nBranchID",
        note: `Counter ${counterId} had nBranchID=${String(branchOldId)} but the branch is not resolved yet; mstBranchCounterLink can still attach it`,
      });
      return;
    }

    await this.upsertBranchCounterLink(context, {
      sourceTable: "mstcounter",
      sourceRowIdentifier: String(
        row.nCounterID ?? row.nCounterId ?? row.id ?? row.ID ?? "",
      ),
      branchId,
      counterId,
      sourceValue: { nBranchID: branchOldId },
    });
  }

  private async upsertBranchCounterLink(
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourceRowIdentifier: string;
      branchId: string;
      counterId: string;
      sourceValue?: Record<string, unknown>;
    },
  ): Promise<{ created: boolean }> {
    this.rememberBranchCounter(context, params.branchId, params.counterId);

    const targetValue = {
      branchId: params.branchId,
      counterId: params.counterId,
    };

    if (context.mode !== "real") {
      this.addFieldStatus(context, {
        sourceTable: params.sourceTable,
        sourceColumn: "nBranchID / nCounterID",
        sourceValue: params.sourceValue ?? null,
        targetColumn:
          "branch_counters.branch_id / branch_counters.counter_id",
        targetValue,
        status: "saved",
        note: "Mock run would create a branch_counters many-to-many link",
      });
      return { created: true };
    }

    const existingLink = await this.targetBranchCounterRepository.findOne({
      where: { branchId: params.branchId, counterId: params.counterId },
    });
    if (existingLink) {
      this.addFieldStatus(context, {
        sourceTable: params.sourceTable,
        sourceColumn: "nBranchID / nCounterID",
        sourceValue: params.sourceValue ?? null,
        targetColumn:
          "branch_counters.branch_id / branch_counters.counter_id",
        targetValue,
        status: "saved",
        note: "Reused existing branch_counters link",
      });
      return { created: false };
    }

    const actorId = this.auditActorId(context);
    await this.targetBranchCounterRepository.save(
      this.targetBranchCounterRepository.create({
        branchId: params.branchId,
        counterId: params.counterId,
        createdBy: actorId,
        updatedBy: actorId,
      }),
    );
    this.logger.log(
      `[${params.sourceTable}] created branch_counters link counterId=${params.counterId} branchId=${params.branchId}`,
    );
    this.addFieldStatus(context, {
      sourceTable: params.sourceTable,
      sourceColumn: "nBranchID / nCounterID",
      sourceValue: params.sourceValue ?? null,
      targetColumn: "branch_counters.branch_id / branch_counters.counter_id",
      targetValue,
      status: "saved",
      note: "Created branch_counters many-to-many link",
    });
    return { created: true };
  }

  private getOldIdFromRow(
    row: SourceRow,
    primaryKeyFields: string[],
  ): string | number | null | undefined {
    for (const field of primaryKeyFields) {
      if (
        row[field] !== undefined &&
        row[field] !== null &&
        row[field] !== ""
      ) {
        return row[field];
      }
    }
    return row.id ?? row.ID;
  }

  private findSourceRowByOldId(
    context: MigrationContext,
    task: InternalTask,
    oldId: string | number | null | undefined,
    primaryKeyFields: string[],
  ): SourceRow | undefined {
    if (oldId === null || oldId === undefined || oldId === "") {
      return undefined;
    }

    const rows = this.getSourceRows(context, task);
    return rows.find((row) => {
      const candidate = this.getOldIdFromRow(row, primaryKeyFields);
      return (
        candidate !== undefined &&
        candidate !== null &&
        String(candidate) === String(oldId)
      );
    });
  }

  private async resolveBranchByOldId(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
    oldId: string | number | null | undefined,
  ): Promise<string | null> {
    if (oldId === null || oldId === undefined || oldId === "") {
      return null;
    }

    const key = String(oldId);
    const existing = this.branchMap.get(key);
    if (existing) {
      return existing;
    }

    this.logger.log(
      `[mstcompany] lazy resolving branch oldId=${key} from relation context`,
    );
    if (!this.getSourceRows(context, "branch").length) {
      const rows = await this.readSourceRows(pool, "mstcompany");
      this.ensureSourceRows(context, "branch", rows);
    }

    const row = this.findSourceRowByOldId(context, "branch", oldId, [
      "nBranchID",
      "nbranchid",
      "id",
      "ID",
    ]);
    if (!row) {
      this.logger.warn(
        `[mstcompany] could not locate source branch row for oldId=${key}`,
      );
      return null;
    }

    const resolved = await this.resolveBranch(row, context);
    return resolved.id;
  }

  private async resolveCounterByOldId(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
    oldId: string | number | null | undefined,
  ): Promise<string | null> {
    if (oldId === null || oldId === undefined || oldId === "") {
      return null;
    }

    const key = String(oldId);
    const existing = this.counterMap.get(key);
    if (existing) {
      return existing;
    }

    this.logger.log(
      `[mstcounter] lazy resolving counter oldId=${key} from relation context`,
    );
    if (!this.getSourceRows(context, "counter").length) {
      const rows = await this.readSourceRows(pool, "mstcounter");
      this.ensureSourceRows(context, "counter", rows);
    }

    const row = this.findSourceRowByOldId(context, "counter", oldId, [
      "nCounterID",
      "nCounterId",
      "ncounterid",
      "id",
      "ID",
    ]);
    if (!row) {
      this.logger.warn(
        `[mstcounter] could not locate source counter row for oldId=${key}`,
      );
      return null;
    }

    const resolved = await this.resolveCounter(row, context, pool);
    return resolved.id;
  }

  private async resolveUserByOldId(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
    oldId: string | number | null | undefined,
  ): Promise<string | null> {
    if (oldId === null || oldId === undefined || oldId === "") {
      return null;
    }

    const key = String(oldId);
    const existing = this.userMap.get(key);
    if (existing) {
      return existing;
    }

    this.logger.log(
      `[mstuser] lazy resolving user oldId=${key} from relation context`,
    );
    if (!this.getSourceRows(context, "user").length) {
      const rows = await this.readSourceRows(pool, "mstuser");
      this.ensureSourceRows(context, "user", rows);
    }

    const row = this.findSourceRowByOldId(context, "user", oldId, [
      "nUserID",
      "nuserid",
      "id",
      "ID",
    ]);
    if (!row) {
      this.logger.warn(
        `[mstuser] could not locate source user row for oldId=${key}`,
      );
      return null;
    }

    const resolved = await this.resolveUser(row, context);
    return resolved.id;
  }

  private roleFlagsFromUserRow(row: SourceRow) {
    return {
      isAdmin: toBoolean(row.bIsAdministrator),
      isMd: false,
      isCompliance: toBoolean(row.bComplianceAuthorization),
      isSrFinance: toBoolean(row.bCreditLimitAuthorization),
      isFinance:
        toBoolean(row.bCreditLimitAuthorization) ||
        toBoolean(row.bMiscLimitAuthorization),
      isBrnMgr:
        toBoolean(row.bCanClearCounter) ||
        toBoolean(row.bDataEntryAuthorization),
      isHoStaff: toBoolean(row.bCanOptCentralM),
      isExecutive: toBoolean(row.bSpecialRights) || toBoolean(row.bIsGroup),
      isCardStk: false,
      isDeliveryBoy: false,
      isCashier: toBoolean(row.bDataEntryAuthorization),
      isSalesMgr: false,
      isActive: toBoolean(row.bActive),
      isAeonAccess: toBoolean(row.nAPID),
      isDelPortalAccess: false,
      isDelAppAccess: false,
    };
  }

  private getLegacyPermissionText(row: SourceRow): string {
    return toNullableString(row.Permission ?? row.permission) ?? "";
  }

  private getLegacyPermissionTokens(row: SourceRow): string[] {
    return [
      ...new Set(
        splitLegacyTokens(this.getLegacyPermissionText(row))
          .map((token) => token.trim())
          .filter(Boolean),
      ),
    ];
  }

  private getLegacyRouteTokens(row: SourceRow): string[] {
    const tokens = this.getLegacyPermissionTokens(row);
    return tokens.filter(
      (token) => !legacyPermissionActionSet.has(normalizeMatchText(token)),
    );
  }

  private getLegacyActions(row: SourceRow): string[] {
    const tokens = this.getLegacyPermissionTokens(row).map((token) =>
      normalizeMatchText(token),
    );
    const actions = new Set<string>();

    for (const { code, aliases } of legacyActionAliases) {
      if (
        tokens.some((token) =>
          aliases.some((alias) => normalizeMatchText(alias) === token),
        )
      ) {
        actions.add(code);
      }
    }

    if (actions.size === 0) {
      actions.add("view");
    }

    return [...actions];
  }

  private buildRoleSignature(row: SourceRow): string {
    const flags = this.roleFlagsFromUserRow(row);
    const normalizedTokens = this.getLegacyPermissionTokens(row)
      .map((token) => normalizeMatchText(token))
      .filter(Boolean)
      .sort();
    return JSON.stringify({
      flags,
      permissions: normalizedTokens,
    });
  }

  private buildRoleCode(row: SourceRow): string {
    const signature = this.buildRoleSignature(row);
    return `LEGACY_ROLE_${createHash("sha1").update(signature).digest("hex").slice(0, 12).toUpperCase()}`;
  }

  private buildRoleName(row: SourceRow): string {
    if (toBoolean(row.bIsAdministrator)) {
      return "Legacy Administrator";
    }
    if (toBoolean(row.bCanOptCentralM)) {
      return "Legacy HO Staff";
    }
    return toStringOrFallback(row.vDescription || row.vName, "Legacy Role");
  }

  private async ensurePermissionCatalog(): Promise<Permission[]> {
    const permissions = await this.targetPermissionRepository.find({
      order: { code: "ASC" },
    });

    if (permissions.length > 0) {
      return permissions;
    }

    const requiredPermissions = [
      { code: "add", name: "Add", description: "Permission to add records" },
      {
        code: "modify",
        name: "Modify",
        description: "Permission to modify records",
      },
      {
        code: "delete",
        name: "Delete",
        description: "Permission to delete records",
      },
      { code: "view", name: "View", description: "Permission to view records" },
      {
        code: "export",
        name: "Export",
        description: "Permission to export data",
      },
      {
        code: "authorized",
        name: "Authorized",
        description: "Permission to authorize records",
      },
      {
        code: "rejected",
        name: "Rejected",
        description: "Permission to reject records",
      },
    ];

    const created = this.targetPermissionRepository.create(
      requiredPermissions.map((permission) => ({
        ...permission,
        createdBy:
          this.activeContext?.bootstrapAdminUserId ??
          this.activeContext?.actorUserId ??
          "",
        updatedBy:
          this.activeContext?.bootstrapAdminUserId ??
          this.activeContext?.actorUserId ??
          "",
      })),
    );
    const saved = await this.targetPermissionRepository.save(created);
    this.logger.log(
      `[mstuser] seeded ${saved.length} permission record(s) for role migration`,
    );
    return saved;
  }

  private async ensureFrontendMenuCatalog(
    context: MigrationContext,
  ): Promise<void> {
    const existingMenus = await this.targetMenuRepository.find({
      relations: { parent: true },
      order: { sortOrder: "ASC", name: "ASC" },
    });

    const existingEntityByPath = new Map<string, Menu>();
    const materializedByPath = new Map<
      string,
      {
        id: string;
        path: string;
        name: string;
        isAdmin: boolean;
        sortOrder: number;
        isActive: boolean;
      }
    >();

    for (const menu of existingMenus) {
      const key = normalizeMenuPath(menu.path);
      if (!key) {
        continue;
      }
      existingEntityByPath.set(key, menu);
      materializedByPath.set(key, {
        id: menu.id,
        path: key,
        name: menu.name,
        isAdmin: menu.isAdmin,
        sortOrder: menu.sortOrder,
        isActive: menu.isActive,
      });
    }

    let created = 0;
    let reused = 0;
    let updated = 0;

    for (const seed of FRONTEND_MENU_SEEDS) {
      const path = normalizeMenuPath(seed.path);
      if (!path) {
        continue;
      }

      const parentPath = seed.parentPath
        ? normalizeMenuPath(seed.parentPath)
        : null;
      const parentRef = parentPath
        ? (materializedByPath.get(parentPath) ?? null)
        : null;
      const existing = existingEntityByPath.get(path);

      if (seed.parentPath && !parentRef) {
        this.addWarning(context, {
          sourceTable: "frontend-menu-seed",
          sourceColumn: "parentPath",
          note: `Menu seed ${seed.name} skipped because parent ${seed.parentPath} is missing`,
        });
        continue;
      }

      if (existing) {
        let changed = false;
        const desiredParentId = parentRef?.id ?? null;

        if ((existing.parent?.id ?? null) !== desiredParentId) {
          existing.parent = desiredParentId
            ? ({ id: desiredParentId } as Menu)
            : null;
          changed = true;
        }
        if (existing.name !== seed.name) {
          existing.name = seed.name;
          changed = true;
        }
        if (existing.isAdmin !== seed.isAdmin) {
          existing.isAdmin = seed.isAdmin;
          changed = true;
        }
        if (existing.sortOrder !== seed.sortOrder) {
          existing.sortOrder = seed.sortOrder;
          changed = true;
        }
        if (normalizeMenuPath(existing.path) !== path) {
          existing.path = path;
          changed = true;
        }
        existing.updatedBy = context.actorUserId;

        if (changed && context.mode === "real") {
          await this.targetMenuRepository.save(existing);
          updated += 1;
        } else {
          reused += 1;
        }

        materializedByPath.set(path, {
          id: existing.id,
          path,
          name: existing.name,
          isAdmin: existing.isAdmin,
          sortOrder: existing.sortOrder,
          isActive: existing.isActive,
        });
        this.addFieldStatus(context, {
          sourceTable: "frontend-menu-seed",
          sourceColumn: "path",
          sourceValue: path,
          targetColumn: "menus",
          targetValue: {
            id: existing.id,
            parentId: parentRef?.id ?? null,
          },
          status: changed ? "transformed" : "saved",
          note: changed
            ? `Updated menu metadata to align with frontend route catalog (${seed.name})`
            : `Reused existing menu entry for ${seed.name}`,
        });
        continue;
      }

      const menuEntity = this.targetMenuRepository.create({
        isAdmin: seed.isAdmin,
        name: seed.name,
        path,
        icon: seed.icon ?? null,
        parent: parentRef ? ({ id: parentRef.id } as Menu) : null,
        sortOrder: seed.sortOrder,
        isActive: true,
        createdBy: context.actorUserId,
        updatedBy: context.actorUserId,
        deletedAt: null,
        deletedBy: null,
      });

      if (context.mode === "real") {
        const saved = await this.targetMenuRepository.save(menuEntity);
        materializedByPath.set(path, {
          id: saved.id,
          path,
          name: saved.name,
          isAdmin: saved.isAdmin,
          sortOrder: saved.sortOrder,
          isActive: saved.isActive,
        });
        created += 1;
        this.addRowResult(context, {
          sourceTable: "frontend-menu-seed",
          sourcePrimaryKey: path,
          targetId: saved.id,
          status: "inserted",
          note: `Seeded frontend menu ${seed.name}`,
        });
      } else {
        const mockId = `mock-menu-${createHash("sha1").update(path).digest("hex").slice(0, 12)}`;
        materializedByPath.set(path, {
          id: mockId,
          path,
          name: seed.name,
          isAdmin: seed.isAdmin,
          sortOrder: seed.sortOrder,
          isActive: true,
        });
        created += 1;
        this.addRowResult(context, {
          sourceTable: "frontend-menu-seed",
          sourcePrimaryKey: path,
          targetId: mockId,
          status: "mocked",
          note: `Would seed frontend menu ${seed.name}`,
        });
      }
    }

    this.logger.log(
      `[menus] frontend catalog sync finished created=${created} reused=${reused} updated=${updated}`,
    );
  }

  private async resolveRolePermissionCompanyId(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<string | null> {
    const explicitCompanyOldId =
      row.nCompID ?? row.ncompid ?? row.companyId ?? row.company_id;
    if (
      explicitCompanyOldId !== undefined &&
      explicitCompanyOldId !== null &&
      explicitCompanyOldId !== ""
    ) {
      const mapped = this.companyMap.get(String(explicitCompanyOldId));
      if (mapped) {
        return mapped;
      }
    }

    const branchOldId = row.nBranchID ?? row.nbranchid;
    if (
      branchOldId !== undefined &&
      branchOldId !== null &&
      branchOldId !== ""
    ) {
      const branchId = this.branchMap.get(String(branchOldId));
      if (branchId) {
        const branch = await this.targetBranchRepository.findOne({
          where: { id: branchId },
          relations: { company: true },
        });
        if (branch?.company?.id) {
          return branch.company.id;
        }
      }
    }

    const [firstCompany] = await this.targetCompanyRepository.find({
      take: 1,
      order: { createdAt: "ASC" },
    });
    if (firstCompany) {
      this.addWarning(context, {
        sourceTable: "mstuser",
        sourceColumn: "company resolution",
        note: `Role permissions fell back to first migrated company ${firstCompany.id} because no explicit company could be resolved`,
      });
      return firstCompany.id;
    }

    return null;
  }

  private async findBestMenuMatches(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<Menu[]> {
    const menus = await this.targetMenuRepository.find({
      order: { sortOrder: "ASC", name: "ASC" },
    });
    const activeMenus = menus.filter((menu) => menu.isActive);
    const routeTokens = this.getLegacyRouteTokens(row);
    if (routeTokens.length === 0) {
      return [];
    }

    const exactMatches = new Map<string, Menu>();
    const partialMatches = new Map<string, Menu>();

    for (const token of routeTokens) {
      const normalizedToken = normalizeMatchText(token);
      if (!normalizedToken) {
        continue;
      }

      const exact = activeMenus.find((menu) => {
        const path = normalizeMatchText(menu.path ?? "");
        const name = normalizeMatchText(menu.name ?? "");
        return normalizedToken === path || normalizedToken === name;
      });
      if (exact) {
        exactMatches.set(exact.id, exact);
        continue;
      }

      let bestMenu: Menu | null = null;
      let bestScore = 0;
      for (const menu of activeMenus) {
        const pathScore = stringSimilarity(token, menu.path ?? "");
        const nameScore = stringSimilarity(token, menu.name ?? "");
        const score = Math.max(pathScore, nameScore);
        if (score > bestScore) {
          bestScore = score;
          bestMenu = menu;
        }
      }

      if (bestMenu && bestScore >= 0.6) {
        partialMatches.set(bestMenu.id, bestMenu);
        this.addFieldStatus(context, {
          sourceTable: "mstuser",
          sourceColumn: "Permission",
          sourceValue: token,
          targetColumn: "menus.path",
          targetValue: bestMenu.path ?? bestMenu.name,
          status: "transformed",
          note: `Legacy permission token matched by partial route similarity (${Math.round(bestScore * 100)}%)`,
        });
      } else {
        this.addWarning(context, {
          sourceTable: "mstuser",
          sourceColumn: "Permission",
          note: `No safe route match found for legacy token "${token}"`,
        });
      }
    }

    return [...exactMatches.values(), ...partialMatches.values()];
  }

  private async syncRolePermissionsFromLegacyRow(
    row: SourceRow,
    role: Role,
    context: MigrationContext,
  ): Promise<void> {
    const roleCode = role.code;
    if (context.createdRoleCodes.has(roleCode)) {
      return;
    }

    const companyId = await this.resolveRolePermissionCompanyId(row, context);
    if (!companyId) {
      this.addWarning(context, {
        sourceTable: "mstuser",
        sourceColumn: "company resolution",
        note: `Role ${role.code} could not resolve a company; menu permissions were not written`,
      });
      return;
    }

    const permissions = await this.ensurePermissionCatalog();
    const permissionMap = new Map(
      permissions.map((permission) => [permission.code, permission]),
    );
    const isFullAccess =
      toBoolean(row.bIsAdministrator) || toBoolean(row.bCanOptCentralM);
    const menus = await this.targetMenuRepository.find({
      order: { sortOrder: "ASC", name: "ASC" },
    });

    const selectedMenus = isFullAccess
      ? menus.filter((menu) => menu.isActive)
      : await this.findBestMenuMatches(row, context);

    if (selectedMenus.length === 0) {
      this.addWarning(context, {
        sourceTable: "mstuser",
        sourceColumn: "Permission",
        note: `No menus matched legacy permission data for role ${role.code}`,
      });
      context.createdRoleCodes.add(roleCode);
      return;
    }

    const permissionCodes = isFullAccess
      ? [...permissionMap.keys()]
      : this.getLegacyActions(row).filter((code) => permissionMap.has(code));

    if (permissionCodes.length === 0) {
      permissionCodes.push("view");
    }

    const relationRepository = this.targetRolesMenuPermissionRepository;
    if (context.mode === "real") {
      await relationRepository
        .createQueryBuilder()
        .delete()
        .where('"role_id" = :roleId', { roleId: role.id })
        .andWhere('"company_id" = :companyId', { companyId })
        .execute();
    }

    const relations = selectedMenus
      .flatMap((menu) =>
        permissionCodes.map((permissionCode) => {
          const permission = permissionMap.get(permissionCode);
          if (!permission) {
            return null;
          }
          return relationRepository.create({
            role: { id: role.id } as Role,
            company: { id: companyId } as Company,
            menu: { id: menu.id } as Menu,
            permission: { id: permission.id } as Permission,
          });
        }),
      )
      .filter(Boolean) as RolesMenuPermission[];

    if (relations.length === 0) {
      this.addWarning(context, {
        sourceTable: "mstuser",
        sourceColumn: "Permission",
        note: `No role menu permission rows could be built for ${role.code}`,
      });
      context.createdRoleCodes.add(roleCode);
      return;
    }

    if (context.mode === "real") {
      await relationRepository.save(relations);
    }

    this.addFieldStatus(context, {
      sourceTable: "mstuser",
      sourceColumn: "Permission",
      sourceValue: this.getLegacyPermissionText(row),
      targetColumn: "roles_menu_permissions",
      targetValue: {
        roleId: role.id,
        companyId,
        menuCount: selectedMenus.length,
        permissionCodes,
      },
      status: "saved",
      note: isFullAccess
        ? "Granted full route access for admin/HO role"
        : "Mapped legacy permission data to current route permissions",
    });

    context.createdRoleCodes.add(roleCode);
  }

  private async resolveUserRoleBundle(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const oldId = row.nUserID ?? row.nuserid ?? row.id ?? row.ID;
    const lookupKey = toNullableString(row.vUID) || `user-${oldId}`;
    const targetTable = "roles";
    const roleCode = this.buildRoleCode(row);
    this.logger.log(
      `[mstuser] resolving role bundle oldId=${String(oldId ?? "")} roleCode=${roleCode}`,
    );

    if (this.roleMap.has(String(oldId))) {
      return {
        id: this.roleMap.get(String(oldId))!,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
      };
    }

    const existing = await this.targetRoleRepository.findOne({
      where: { code: roleCode },
    });
    const audit = this.resolveAuditFields(row, context, {
      sourceTable: "mstuser",
      sourceRowIdentifier: String(oldId ?? ""),
    });
    if (existing) {
      this.logger.log(
        `[mstuser] reused role oldId=${String(oldId ?? "")} targetId=${existing.id}`,
      );
      if (audit.wasDeleted && context.mode === "real") {
        existing.deletedAt = audit.deletedAt;
        existing.deletedBy = audit.deletedBy;
        await this.targetRoleRepository.save(existing);
        this.logger.warn(
          `[mstuser] applied soft-delete to reused role id=${existing.id}`,
        );
      }
      this.roleMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: "mstuser",
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      await this.syncRolePermissionsFromLegacyRow(row, existing, context);
      return {
        id: existing.id,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
        softDeleted: audit.wasDeleted,
      };
    }

    const role = this.targetRoleRepository.create({
      code: roleCode,
      name: this.buildRoleName(row),
      ...this.roleFlagsFromUserRow(row),
      createdBy: this.resolveAuditUserId(
        context,
        row.nCreatedBy ?? row.nCreatedBY,
        {
          sourceTable: "mstuser",
          sourceRowIdentifier: String(oldId ?? ""),
          fieldName: "nCreatedBy",
        },
      ),
      updatedBy: this.resolveAuditUserId(
        context,
        row.nLastUpdateBy ?? row.nLastupdatedBy,
        {
          sourceTable: "mstuser",
          sourceRowIdentifier: String(oldId ?? ""),
          fieldName: "nLastUpdateBy",
        },
      ),
      deletedAt: audit.deletedAt,
      deletedBy: audit.deletedBy,
    });

    if (context.mode === "real") {
      const saved = await this.targetRoleRepository.save(role);
      this.logger.log(`[mstuser] created role id=${saved.id}`);
      this.roleMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: "mstuser",
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      await this.syncRolePermissionsFromLegacyRow(row, saved, context);
      return {
        id: saved.id,
        created: true,
        sourceId: oldId,
        targetTable,
        lookupKey,
        softDeleted: audit.wasDeleted,
      };
    }

    const mockId = `mock-role-${oldId ?? randomUUID()}`;
    this.logger.log(`[mstuser] mock role id=${mockId}`);
    this.roleMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: "mstuser",
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    await this.syncRolePermissionsFromLegacyRow(row, role, context);
    return {
      id: mockId,
      created: true,
      sourceId: oldId,
      targetTable,
      lookupKey,
      softDeleted: audit.wasDeleted,
    };
  }

  private async resolveUser(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const oldId = row.nUserID ?? row.nuserid ?? row.id ?? row.ID;
    const lookupKey = toNullableString(row.vUID) || `user-${oldId}`;
    const targetTable = "users";
    this.logger.log(
      `[mstuser] resolving user oldId=${String(oldId ?? "")} lookupKey=${lookupKey}`,
    );

    if (this.userMap.has(String(oldId))) {
      return {
        id: this.userMap.get(String(oldId))!,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
      };
    }

    const code = toStringOrFallback(row.vUID, `USER_${oldId}`);
    const email =
      toNullableString(row.vMailID) ?? `user-${oldId}@migrated.local`;
    const createdBy = this.resolveAuditUserId(
      context,
      row.nCreatedBy ?? row.nCreatedBY,
      {
        sourceTable: "mstuser",
        sourceRowIdentifier: String(oldId ?? ""),
        fieldName: "nCreatedBy",
      },
    );
    const updatedBy = this.resolveAuditUserId(
      context,
      row.nLastUpdateBy ?? row.nLastupdatedBy,
      {
        sourceTable: "mstuser",
        sourceRowIdentifier: String(oldId ?? ""),
        fieldName: "nLastUpdateBy",
      },
    );
    const audit = this.resolveAuditFields(row, context, {
      sourceTable: "mstuser",
      sourceRowIdentifier: String(oldId ?? ""),
    });
    const existing = await this.targetUserRepository.findOne({
      where: [{ code }, { email }],
    });

    if (existing) {
      this.logger.log(
        `[mstuser] reused user oldId=${String(oldId ?? "")} targetId=${existing.id}`,
      );
      if (audit.wasDeleted && context.mode === "real") {
        existing.deletedAt = audit.deletedAt;
        existing.deletedBy = audit.deletedBy;
        await this.targetUserRepository.save(existing);
        this.logger.warn(
          `[mstuser] applied soft-delete to reused user id=${existing.id}`,
        );
      }
      this.userMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: "mstuser",
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      return {
        id: existing.id,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
        softDeleted: audit.wasDeleted,
      };
    }

    const hashedPassword = await bcrypt.hash(TEMP_INITIAL_PASSWORD, 10);
    const user = this.targetUserRepository.create({
      code,
      name: toStringOrFallback(row.vName, code),
      contactNo: toNullableString(row.vCellNo),
      email,
      employeeNo: toNullableString(row.nUserID),
      designation: toNullableString(row.vDescription),
      userLicNo: toNullableString(row.vUID),
      isActive: toBoolean(row.bActive),
      lastLoginDate: null,
      isLocked: false,
      failedPasswordAttempts: 0,
      isDormant: false,
      isAdmin: toBoolean(row.bIsAdministrator),
      password: hashedPassword,
      mustChangePassword: true,
      lastLoginAt: null,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      createdBy,
      updatedBy,
      deletedAt: audit.deletedAt,
      deletedBy: audit.deletedBy,
    });

    if (context.mode === "real") {
      const saved = await this.targetUserRepository.save(user);
      this.logger.log(`[mstuser] created user id=${saved.id}`);
      this.userMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: "mstuser",
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      return {
        id: saved.id,
        created: true,
        sourceId: oldId,
        targetTable,
        lookupKey,
        softDeleted: audit.wasDeleted,
      };
    }

    const mockId = `mock-user-${oldId ?? randomUUID()}`;
    this.logger.log(`[mstuser] mock user id=${mockId}`);
    this.userMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: "mstuser",
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    return {
      id: mockId,
      created: true,
      sourceId: oldId,
      targetTable,
      lookupKey,
      softDeleted: audit.wasDeleted,
    };
  }

  private async ensureBootstrapAdminUser(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<BootstrapAdminResult> {
    if (context.bootstrapAdminUserId) {
      return {
        userId: context.bootstrapAdminUserId,
        roleId: context.bootstrapAdminRoleId ?? context.bootstrapAdminUserId,
        sourceOldId: context.bootstrapAdminSourceOldId,
        reusedExistingUser: true,
      };
    }

    const existingAdmin = await this.targetUserRepository.findOne({
      where: { isAdmin: true },
      order: { createdAt: "ASC" },
    });

    if (existingAdmin) {
      context.bootstrapAdminUserId = existingAdmin.id;
      context.bootstrapAdminRoleId = existingAdmin.id;
      context.bootstrapAdminSourceOldId = null;
      this.logger.log(
        `[bootstrap] using existing admin user id=${existingAdmin.id}`,
      );
      return {
        userId: existingAdmin.id,
        roleId: existingAdmin.id,
        sourceOldId: null,
        reusedExistingUser: true,
      };
    }

    if (!this.getSourceRows(context, "user").length) {
      const rows = await this.readSourceRows(pool, "mstuser");
      this.ensureSourceRows(context, "user", rows);
    }

    const rows = this.getSourceRows(context, "user");
    const bootstrapRow = this.pickBootstrapUserRow(rows);

    if (!bootstrapRow) {
      this.logger.warn(
        "[bootstrap] no source user rows found; falling back to current actor for audit ownership",
      );
      context.bootstrapAdminUserId = context.actorUserId;
      context.bootstrapAdminRoleId = context.actorUserId;
      context.bootstrapAdminSourceOldId = null;
      return {
        userId: context.actorUserId,
        roleId: context.actorUserId,
        sourceOldId: null,
        reusedExistingUser: true,
      };
    }

    const sourceOldId =
      bootstrapRow.nUserID ??
      bootstrapRow.nuserid ??
      bootstrapRow.id ??
      bootstrapRow.ID;
    this.logger.log(
      `[bootstrap] seeding admin user from mstuser oldId=${String(sourceOldId ?? "")} uid=${toNullableString(bootstrapRow.vUID) ?? ""}`,
    );

    const userResolved = await this.resolveUser(bootstrapRow, context);
    const roleResolved = await this.resolveUserRoleBundle(
      bootstrapRow,
      context,
    );

    context.bootstrapAdminUserId = userResolved.id;
    context.bootstrapAdminRoleId = roleResolved.id;
    context.bootstrapAdminSourceOldId = sourceOldId;
    context.summary.rowsInserted += 2;

    const userRoleExists = await this.targetUserRoleRepository.findOne({
      where: {
        user: { id: userResolved.id } as User,
        role: { id: roleResolved.id } as Role,
      } as any,
    });

    if (!userRoleExists) {
      const assignment = this.targetUserRoleRepository.create({
        user: { id: userResolved.id } as User,
        role: { id: roleResolved.id } as Role,
        branch: null,
        counter: null,
        createdBy: context.actorUserId,
        updatedBy: context.actorUserId,
        deletedAt: null,
        deletedBy: null,
      });
      if (context.mode === "real") {
        await this.targetUserRoleRepository.save(assignment);
        context.summary.rowsInserted += 1;
      }
      this.logger.log(
        `[bootstrap] ${context.mode === "real" ? "saved" : "prepared"} admin role assignment userId=${userResolved.id} roleId=${roleResolved.id}`,
      );
    }

    this.addRowResult(context, {
      sourceTable: "mstuser",
      sourcePrimaryKey: String(sourceOldId ?? ""),
      targetId: userResolved.id,
      status: context.mode === "real" ? "inserted" : "mocked",
      note: "Bootstrap admin user seeded before the selected table migration",
    });
    this.addRowResult(context, {
      sourceTable: "roles",
      sourcePrimaryKey: String(sourceOldId ?? ""),
      targetId: roleResolved.id,
      status: context.mode === "real" ? "inserted" : "mocked",
      note: "Bootstrap admin role seeded before the selected table migration",
    });

    return {
      userId: userResolved.id,
      roleId: roleResolved.id,
      sourceOldId,
      reusedExistingUser: false,
    };
  }

  private logUnmappedGeographyFields(
    context: MigrationContext,
    fields: CombinedLegacyCountry["unmapped"] | CombinedLegacyState["unmapped"],
  ) {
    for (const field of fields) {
      this.addUnmappedColumn(context, {
        sourceTable: field.sourceTable,
        sourceColumn: field.sourceColumn,
        sourceValue: field.sourceValue,
        reason: field.reason,
      });
    }
  }

  private async resolveIndiaCountryId(): Promise<string | null> {
    return (
      this.countryMap.get("code:IN") ??
      this.countryMap.get("lrs-code:IN") ??
      this.countryMap.get("name:india") ??
      (
        await this.targetCountryRepository.findOne({
          where: [{ baseCountry: true }, { code: "IN" }, { name: "India" }],
        })
      )?.id ??
      null
    );
  }

  private async upsertMappedCountry(
    mapped: CombinedLegacyCountry,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const sourceTable = mapped.sourceTables.join("+") || "legacy-country";
    const lookupKey = `${mapped.code}:${mapped.name}`;
    const existing = await this.targetCountryRepository.findOne({
      where: [
        { code: mapped.code },
        { name: mapped.name },
        ...(mapped.lrsCountryCode
          ? [{ lrsCountryCode: mapped.lrsCountryCode }]
          : []),
        ...(mapped.ctrCountryCode
          ? [{ ctrCountryCode: mapped.ctrCountryCode }]
          : []),
      ],
    });
    const createdBy = context.bootstrapAdminUserId ?? context.actorUserId;

    const applyLookups = (id: string) => {
      this.rememberLookup(this.countryMap, countryLookupKeys(mapped), id);
    };

    if (existing) {
      let changed = false;
      if (!existing.lrsCountryCode && mapped.lrsCountryCode) {
        existing.lrsCountryCode = mapped.lrsCountryCode;
        changed = true;
      }
      if (!existing.ctrCountryCode && mapped.ctrCountryCode) {
        existing.ctrCountryCode = mapped.ctrCountryCode;
        changed = true;
      }
      if (!existing.baseCountry && mapped.baseCountry) {
        existing.baseCountry = true;
        changed = true;
      }
      if (!existing.restrictedCountry && mapped.restrictedCountry) {
        existing.restrictedCountry = true;
        changed = true;
      }
      if (!existing.greyListCountry && mapped.greyListCountry) {
        existing.greyListCountry = true;
        changed = true;
      }
      if (context.mode === "real" && changed) {
        await this.targetCountryRepository.save(existing);
      }
      applyLookups(existing.id);
      this.addIdMap(context, {
        oldTable: sourceTable,
        oldId: mapped.mstCountryId ?? mapped.ctrNumericCode ?? mapped.lrsCountryId,
        newTable: "countries",
        newUuid: existing.id,
        lookupKey,
      });
      return {
        id: existing.id,
        created: false,
        sourceId: mapped.mstCountryId ?? mapped.ctrNumericCode,
        targetTable: "countries",
        lookupKey,
      };
    }

    const country = this.targetCountryRepository.create({
      code: mapped.code,
      name: mapped.name,
      lrsCountryCode: mapped.lrsCountryCode,
      ctrCountryCode: mapped.ctrCountryCode,
      riskCategory: mapped.riskCategory,
      restrictedCountry: mapped.restrictedCountry,
      greyListCountry: mapped.greyListCountry,
      baseCountry: mapped.baseCountry,
      isCisCountry: false,
      isBlocked: false,
      createdBy,
      updatedBy: createdBy,
    });

    if (context.mode === "real") {
      const saved = await this.targetCountryRepository.save(country);
      applyLookups(saved.id);
      this.addIdMap(context, {
        oldTable: sourceTable,
        oldId: mapped.mstCountryId ?? mapped.ctrNumericCode ?? mapped.lrsCountryId,
        newTable: "countries",
        newUuid: saved.id,
        lookupKey,
      });
      return {
        id: saved.id,
        created: true,
        sourceId: mapped.mstCountryId ?? mapped.ctrNumericCode,
        targetTable: "countries",
        lookupKey,
      };
    }

    const mockId = `mock-country-${mapped.code}`;
    applyLookups(mockId);
    this.addIdMap(context, {
      oldTable: sourceTable,
      oldId: mapped.mstCountryId ?? mapped.ctrNumericCode ?? mapped.lrsCountryId,
      newTable: "countries",
      newUuid: mockId,
      lookupKey,
    });
    return {
      id: mockId,
      created: true,
      sourceId: mapped.mstCountryId ?? mapped.ctrNumericCode,
      targetTable: "countries",
      lookupKey,
    };
  }

  private async readSourceRowsFromCandidates(
    pool: mssql.ConnectionPool,
    candidates: readonly string[],
  ): Promise<{ tableName: string; rows: SourceRow[] }> {
    let lastError: unknown = null;
    for (const tableName of candidates) {
      try {
        const rows = await this.readSourceRows(pool, tableName);
        return { tableName, rows };
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Source table ${tableName} not readable: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    throw new BadRequestException(
      `Could not read any of [${candidates.join(", ")}]: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }

  private async ensureCategoryOptionByCode(
    context: MigrationContext,
    params: {
      code: CategoryOptionCodeEnum;
      value: string;
      sourceTable: string;
      sourceColumn: string;
      sourceRowIdentifier?: string;
    },
  ): Promise<string | null> {
    const existing = await this.targetSelectOptionRepository.findOne({
      where: { code: params.code, value: params.value },
    });
    if (existing) {
      return existing.id;
    }

    if (context.mode !== "real") {
      const mockId = `mock-opt-${params.code}-${params.value}`;
      this.addFieldStatus(context, {
        sourceTable: params.sourceTable,
        sourceColumn: params.sourceColumn,
        sourceValue: params.value,
        targetColumn: `category_options.${params.code}`,
        targetValue: mockId,
        status: "transformed",
        note: "Mock run would create category option",
      });
      return mockId;
    }

    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;
    const saved = await this.targetSelectOptionRepository.save(
      this.targetSelectOptionRepository.create({
        code: params.code,
        value: params.value,
        label: params.value,
        sortOrder: 0,
        isActive: true,
        createdBy: actorId,
        updatedBy: actorId,
      }),
    );
    this.addIdMap(context, {
      oldTable: "category_options",
      oldId: `${params.code}:${params.value}`,
      newTable: "category_options",
      newUuid: saved.id,
      lookupKey: `${params.code}:${params.value}`,
    });
    return saved.id;
  }

  private async resolvePartyBranchId(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
    mapped: MappedPartyProfile,
  ): Promise<string | null> {
    if (mapped.legacyBranchId) {
      const byId = await this.resolveBranchByOldId(
        pool,
        context,
        mapped.legacyBranchId,
      );
      if (byId) {
        return byId;
      }
      this.addWarning(context, {
        sourceTable: "mstCodes",
        sourceColumn: "nBranchID",
        note: `Branch oldId=${mapped.legacyBranchId} missing in MSSQL; trying HO fallback`,
      });
    }

    if (mapped.legacyBranchCode) {
      const code = mapped.legacyBranchCode.trim().toUpperCase();
      const existing = await this.targetBranchRepository.findOne({
        where: { code },
      });
      if (existing) {
        return existing.id;
      }
    }

    const ho = await this.targetBranchRepository.findOne({
      where: { isHeadOffice: true },
    });
    if (ho) {
      this.addWarning(context, {
        sourceTable: "mstCodes",
        sourceColumn: "nBranchID",
        note: `Using HO branch ${ho.code} for party ${mapped.code}`,
      });
      return ho.id;
    }

    return null;
  }

  private rememberParty(
    context: MigrationContext,
    oldId: string | number | null,
    code: string,
    id: string,
  ) {
    if (oldId != null && oldId !== "") {
      context.partyMap.set(String(oldId), id);
    }
    context.partyCodeMap.set(code.toUpperCase(), id);
  }

  private async resolveCurrencyIdByCode(
    code: string | null | undefined,
  ): Promise<string | null> {
    const currencyCode = toNullableString(code)?.toUpperCase() ?? null;
    if (!currencyCode) {
      return null;
    }
    const existing = await this.targetCurrencyRepository.findOne({
      where: { currencyCode },
    });
    return existing?.id ?? null;
  }

  private async resolveProductIdByCode(
    code: string | null | undefined,
  ): Promise<string | null> {
    const productCode = toNullableString(code)?.toUpperCase() ?? null;
    if (!productCode) {
      return null;
    }
    const mapped = this.productCodeMap.get(productCode);
    if (mapped) {
      return mapped;
    }
    const existing = await this.targetProductRepository.findOne({
      where: { productCode },
    });
    if (existing) {
      this.productCodeMap.set(productCode, existing.id);
      return existing.id;
    }
    return null;
  }


  private async processCountries(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "country")) {
      return;
    }

    this.logger.log(`[countries] combined country migration started mode=${context.mode}`);
    const ctr = await this.readSourceTableIfExists(
      pool,
      LEGACY_COUNTRY_TABLE_CANDIDATES.ctrcountry,
    );
    const ctr2 = await this.readSourceTableIfExists(
      pool,
      LEGACY_COUNTRY_TABLE_CANDIDATES.ctrcountry2,
    );
    const mst = await this.readSourceTableIfExists(
      pool,
      LEGACY_COUNTRY_TABLE_CANDIDATES.mstCountry,
    );
    const lrs = await this.readSourceTableIfExists(
      pool,
      LEGACY_COUNTRY_TABLE_CANDIDATES.lrsCountry,
    );

    if (!ctr) {
      this.addWarning(context, {
        sourceTable: "CTRCOUNTRY",
        note: "CTRCOUNTRY was not found; continuing with ctrcountry2 / tb_MstCountry / LRSCountry if present",
      });
    }
    if (!ctr2) {
      this.addWarning(context, {
        sourceTable: "ctrcountry2",
        note: "ctrcountry2 was not found",
      });
    }

    const combined = combineLegacyCountries({
      ctrRows: ctr?.rows ?? [],
      ctr2Rows: ctr2?.rows ?? [],
      mstRows: mst?.rows ?? [],
      lrsRows: lrs?.rows ?? [],
    });
    this.ensureSourceRows(context, "country", combined as unknown as SourceRow[]);

    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const scanned =
      (ctr?.rows.length ?? 0) +
      (ctr2?.rows.length ?? 0) +
      (mst?.rows.length ?? 0) +
      (lrs?.rows.length ?? 0);
    context.summary.rowsScanned += scanned;

    if (combined.length === 0) {
      skipped += 1;
      this.addWarning(context, {
        sourceTable: "countries",
        note: "No country source rows were found to combine",
      });
    }

    for (const mapped of combined) {
      try {
        this.logUnmappedGeographyFields(context, mapped.unmapped);
        const resolved = await this.upsertMappedCountry(mapped, context);
        this.addRowResult(context, {
          sourceTable: mapped.sourceTables.join("+"),
          sourcePrimaryKey: mapped.code,
          targetId: resolved.id,
          status:
            context.mode === "real" && resolved.created ? "inserted" : "mocked",
          note: `Combined country ${mapped.name} from ${mapped.sourceTables.join(", ")}`,
        });
        this.addColumnMapping(context, {
          sourceTable: mapped.sourceTables.join("+"),
          sourceColumn: "COUNTRYCODE/LRSCode/CountryCode",
          sourceValue: mapped.ctrNumericCode ?? mapped.lrsCountryCode,
          targetColumn: "code / lrsCountryCode / ctrCountryCode",
          targetValue: {
            code: mapped.code,
            lrsCountryCode: mapped.lrsCountryCode,
            ctrCountryCode: mapped.ctrCountryCode,
          },
          result: resolved.created ? "created" : "reused",
        });
        if (resolved.created) {
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: mapped.sourceTables.join("+"),
          sourceRowIdentifier: mapped.name,
          fieldName: "country",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown country migration failure",
        });
      }
    }

    context.summary.rowsInserted += inserted;
    this.addTableResult(context, {
      sourceTable: [ctr?.tableName, ctr2?.tableName, mst?.tableName, lrs?.tableName]
        .filter(Boolean)
        .join("+"),
      targetTable: "countries",
      rowCountScanned: scanned,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: "CTRCOUNTRY and ctrcountry2 are unioned by name, then overlaid with tb_MstCountry and LRSCountry. country_group_id left null this wave.",
    });
  }

  private async processStates(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "state")) {
      return;
    }

    this.logger.log(`[states] combined state migration started mode=${context.mode}`);
    const ctr = await this.readSourceTableIfExists(
      pool,
      LEGACY_STATE_TABLE_CANDIDATES.ctrState,
    );
    const customer = await this.readSourceTableIfExists(
      pool,
      LEGACY_STATE_TABLE_CANDIDATES.customerState,
    );
    const gst = await this.readSourceTableIfExists(
      pool,
      LEGACY_STATE_TABLE_CANDIDATES.gstState,
    );
    const combined = combineLegacyStates({
      ctrRows: ctr?.rows ?? [],
      customerRows: customer?.rows ?? [],
      gstRows: gst?.rows ?? [],
    });
    const indiaId = await this.resolveIndiaCountryId();
    const createdBy = context.bootstrapAdminUserId ?? context.actorUserId;
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const scanned =
      (ctr?.rows.length ?? 0) +
      (customer?.rows.length ?? 0) +
      (gst?.rows.length ?? 0);
    context.summary.rowsScanned += scanned;

    if (!indiaId) {
      this.addWarning(context, {
        sourceTable: "states",
        note: "India country row is required for states.country_id; states were skipped",
      });
      this.addTableResult(context, {
        sourceTable: [ctr?.tableName, customer?.tableName, gst?.tableName]
          .filter(Boolean)
          .join("+"),
        targetTable: "states",
        rowCountScanned: scanned,
        rowCountInserted: 0,
        rowCountSkipped: combined.length,
        rowCountFailed: 0,
        note: "Skipped because countries.India was not resolved",
      });
      return;
    }

    for (const mapped of combined) {
      if (!mapped.code) {
        skipped += 1;
        this.addSkippedRow(context, {
          sourceTable: mapped.sourceTables.join("+"),
          sourceRowIdentifier: mapped.name,
          reason: "Combined state had no CTR letter code, GST code, or customer id",
          fallbackAction: "State row skipped",
        });
        continue;
      }

      try {
        this.logUnmappedGeographyFields(context, mapped.unmapped);
        const existing =
          isPersistedUuid(indiaId)
            ? await this.targetStateRepository.findOne({
                where: [
                  { country: { id: indiaId }, code: mapped.code },
                  { country: { id: indiaId }, name: mapped.name },
                ],
                relations: { country: true },
              })
            : null;

        const persistLookups = (id: string) => {
          this.rememberLookup(this.stateMap, stateLookupKeys(mapped), id);
        };

        if (existing) {
          let changed = false;
          if (!existing.gstStateCode && mapped.gstStateCode) {
            existing.gstStateCode = mapped.gstStateCode;
            changed = true;
          }
          if (!existing.ctrStateCode && mapped.ctrStateCode) {
            existing.ctrStateCode = mapped.ctrStateCode;
            changed = true;
          }
          if (context.mode === "real" && changed) {
            await this.targetStateRepository.save(existing);
          }
          persistLookups(existing.id);
          this.addIdMap(context, {
            oldTable: mapped.sourceTables.join("+"),
            oldId: mapped.customerStateId ?? mapped.ctrStateCode,
            newTable: "states",
            newUuid: existing.id,
            lookupKey: `${mapped.code}:${mapped.name}`,
          });
          continue;
        }

        const state = this.targetStateRepository.create({
          country: { id: indiaId } as Country,
          code: mapped.code,
          name: mapped.name,
          gstStateCode: mapped.gstStateCode,
          ctrStateCode: mapped.ctrStateCode,
          createdBy,
          updatedBy: createdBy,
        });

        if (context.mode === "real") {
          const saved = await this.targetStateRepository.save(state);
          persistLookups(saved.id);
          inserted += 1;
          this.addIdMap(context, {
            oldTable: mapped.sourceTables.join("+"),
            oldId: mapped.customerStateId ?? mapped.ctrStateCode,
            newTable: "states",
            newUuid: saved.id,
            lookupKey: `${mapped.code}:${mapped.name}`,
          });
        } else {
          const mockId = `mock-state-IN-${mapped.code}`;
          persistLookups(mockId);
          inserted += 1;
          this.addIdMap(context, {
            oldTable: mapped.sourceTables.join("+"),
            oldId: mapped.customerStateId ?? mapped.ctrStateCode,
            newTable: "states",
            newUuid: mockId,
            lookupKey: `${mapped.code}:${mapped.name}`,
          });
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: mapped.sourceTables.join("+"),
          sourceRowIdentifier: mapped.name,
          fieldName: "state",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown state migration failure",
        });
      }
    }

    context.summary.rowsInserted += inserted;
    this.addTableResult(context, {
      sourceTable: [ctr?.tableName, customer?.tableName, gst?.tableName]
        .filter(Boolean)
        .join("+"),
      targetTable: "states",
      rowCountScanned: scanned,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: "Indian states only. states.country_id is the migrated India country UUID.",
    });
  }

  private async processLocationTypes(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "locationType")) {
      return;
    }

    this.logger.log(
      `[mstLocationType] category_options LOCATIONTYPE migration started mode=${context.mode}`,
    );
    const source = await this.readSourceTableIfExists(
      pool,
      LEGACY_LOCATION_TYPE_TABLE_CANDIDATES,
    );
    if (!source) {
      this.addWarning(context, {
        sourceTable: "mstLocationType",
        note: "mstLocationType was not found; branch rows may still create LOCATIONTYPE options from nLocationType",
      });
      this.addTableResult(context, {
        sourceTable: "mstLocationType",
        targetTable: "category_options",
        rowCountScanned: 0,
        rowCountInserted: 0,
        rowCountSkipped: 1,
        rowCountFailed: 0,
        note: "Lookup table missing",
      });
      return;
    }

    const createdBy = context.bootstrapAdminUserId ?? context.actorUserId;
    let inserted = 0;
    let failed = 0;
    context.summary.rowsScanned += source.rows.length;
    this.ensureSourceRows(context, "locationType", source.rows);

    for (const row of source.rows) {
      const mapped = mapLegacyLocationType(row);
      try {
        const existing = await this.targetSelectOptionRepository.findOne({
          where: {
            code: CategoryOptionCodeEnum.LocationType,
            value: mapped.value,
          },
        });
        if (existing) {
          if (
            context.mode === "real" &&
            existing.label === existing.value &&
            mapped.label !== mapped.value
          ) {
            existing.label = mapped.label;
            await this.targetSelectOptionRepository.save(existing);
          }
          this.addIdMap(context, {
            oldTable: source.tableName,
            oldId: mapped.oldId,
            newTable: "category_options",
            newUuid: existing.id,
            lookupKey: `${CategoryOptionCodeEnum.LocationType}:${mapped.value}`,
          });
          continue;
        }

        if (context.mode === "real") {
          const saved = await this.targetSelectOptionRepository.save(
            this.targetSelectOptionRepository.create({
              code: CategoryOptionCodeEnum.LocationType,
              value: mapped.value,
              label: mapped.label,
              sortOrder: mapped.sortOrder,
              isActive: true,
              createdBy,
              updatedBy: createdBy,
            }),
          );
          inserted += 1;
          this.addIdMap(context, {
            oldTable: source.tableName,
            oldId: mapped.oldId,
            newTable: "category_options",
            newUuid: saved.id,
            lookupKey: `${CategoryOptionCodeEnum.LocationType}:${mapped.value}`,
          });
        } else {
          inserted += 1;
          this.addIdMap(context, {
            oldTable: source.tableName,
            oldId: mapped.oldId,
            newTable: "category_options",
            newUuid: `mock-location-type-${mapped.value}`,
            lookupKey: `${CategoryOptionCodeEnum.LocationType}:${mapped.value}`,
          });
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: source.tableName,
          sourceRowIdentifier: mapped.value,
          fieldName: "locationType",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown location type migration failure",
        });
      }
    }

    context.summary.rowsInserted += inserted;
    this.addTableResult(context, {
      sourceTable: source.tableName,
      targetTable: "category_options",
      rowCountScanned: source.rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: 0,
      rowCountFailed: failed,
      note: "LId is category_options.value so branch nLocationType=2 resolves to Rural Location",
    });
  }

  private async resolveCurrencyCountry(
    mapped: ReturnType<typeof mapLegacyCurrencyRecord>,
    context: MigrationContext,
    sourceRowIdentifier: string,
  ): Promise<Country | null> {
    for (const key of mapped.countryLookupKeys) {
      const cachedId = this.countryMap.get(key);
      if (!cachedId) {
        continue;
      }
      if (!isPersistedUuid(cachedId)) {
        return { id: cachedId } as Country;
      }
      const cached = await this.targetCountryRepository.findOne({
        where: { id: cachedId },
      });
      if (cached) {
        return cached;
      }
    }

    if (mapped.countryIsoHint) {
      const byIso = await this.targetCountryRepository.findOne({
        where: [
          { code: mapped.countryIsoHint },
          { lrsCountryCode: mapped.countryIsoHint },
        ],
      });
      if (byIso) {
        return byIso;
      }
    }

    this.addSkippedRow(context, {
      sourceTable: "mcurrency",
      sourceRowIdentifier,
      reason: mapped.missingLegacyCountryId
        ? `nCountryID missing/0 and ISO hint ${mapped.countryIsoHint ?? "none"} did not match a migrated country`
        : `nCountryID ${mapped.legacyCountryId} is not in country maps and ISO hint ${mapped.countryIsoHint ?? "none"} did not match`,
      fallbackAction: "Currency row skipped; country_id is required",
    });
    this.addUnmappedColumn(context, {
      sourceTable: "mcurrency",
      sourceColumn: "nCountryID",
      sourceValue: mapped.legacyCountryId,
      reason:
        "Currency country could not be resolved from country maps or ISO hint (AED→AE, INR→IN). Row skipped.",
    });
    return null;
  }

  private async processCurrencies(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "currency")) {
      return;
    }

    this.logger.log(`[mcurrency] table migration started mode=${context.mode}`);
    const source = await this.readSourceTableIfExists(
      pool,
      LEGACY_CURRENCY_TABLE_CANDIDATES.mCurrency,
    );
    if (!source) {
      this.addWarning(context, {
        sourceTable: "mcurrency",
        note: "mCurrency was not found on the old master",
      });
      return;
    }
    const mastCurr = await this.readSourceTableIfExists(
      pool,
      LEGACY_CURRENCY_TABLE_CANDIDATES.mastCurr,
    );
    const currencyList = await this.readSourceTableIfExists(
      pool,
      LEGACY_CURRENCY_TABLE_CANDIDATES.currencyList,
    );
    const mastCurrByCode = indexMastCurrByCode(mastCurr?.rows ?? []);
    const listedCodes = indexCurrencyListCodes(currencyList?.rows ?? []);
    const rows = source.rows;
    this.ensureSourceRows(context, "currency", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const extraCode of mastCurrByCode.keys()) {
      if (!rows.some((row) => toNullableString(row.vCncode)?.toUpperCase() === extraCode)) {
        this.addUnmappedColumn(context, {
          sourceTable: mastCurr?.tableName ?? "MASTCURR",
          sourceColumn: "CNCODENEW",
          sourceValue: extraCode,
          reason:
            "MASTCURR catalog code has no mCurrency operational row; not inserted",
        });
      }
    }

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const mapped = mapLegacyCurrencyRecord(row);
      const oldId = mapped.oldId;
      const lookupKey = mapped.currencyCode || `currency-${oldId}`;

      try {
        const country = await this.resolveCurrencyCountry(
          mapped,
          context,
          String(oldId ?? ""),
        );
        if (!country) {
          skipped += 1;
          continue;
        }

        for (const field of mapped.unmapped) {
          this.addUnmappedColumn(context, {
            sourceTable: source.tableName,
            sourceColumn: field.sourceColumn,
            sourceValue: field.sourceValue,
            reason: field.reason,
          });
        }

        const existing = await this.targetCurrencyRepository.findOne({
          where: {
            currencyCode: mapped.currencyCode,
          },
          relations: { country: true, pricingGroup: true },
        });
        const onlyStocking = mapped.onlyStocking;
        const productAllowed = mapped.productAllowed;
        const currencyCode = mapped.currencyCode;
        const currencyName = mapped.currencyName;
        const resolvedCountryLabel = (country as any).name ?? currencyCode;
        const createdBy = this.resolveAuditUserId(
          context,
          row.nCreatedBy ?? row.nCreatedBY,
          {
            sourceTable: "mcurrency",
            sourceRowIdentifier: String(oldId ?? ""),
            fieldName: "nCreatedBy",
          },
        );
        const updatedBy = this.resolveAuditUserId(
          context,
          row.nLastUpdateBy ?? row.nLastupdatedBy,
          {
            sourceTable: "mcurrency",
            sourceRowIdentifier: String(oldId ?? ""),
            fieldName: "nLastUpdateBy",
          },
        );
        const audit = this.resolveAuditFields(row, context, {
          sourceTable: "mcurrency",
          sourceRowIdentifier: String(oldId ?? ""),
        });

        this.addFieldStatus(context, {
          sourceTable: "mcurrency",
          sourceColumn: "bTradedCurrency",
          sourceValue: row.bTradedCurrency,
          targetColumn: "onlyStocking",
          targetValue: onlyStocking,
          status: "saved",
          note: "Legacy traded currency flag mapped to onlyStocking",
        });

        if (row.vProductAlloowd !== undefined && row.vProductAlloowd !== null) {
          this.addFieldStatus(context, {
            sourceTable: "mcurrency",
            sourceColumn: "vProductAlloowd",
            sourceValue: row.vProductAlloowd,
            targetColumn: "productAllowed",
            targetValue: onlyStocking ? productAllowed || "" : "",
            status: onlyStocking && productAllowed ? "saved" : "unmapped",
            note:
              onlyStocking && productAllowed
                ? "Mapped to current productAllowed code"
                : "Legacy product allowance is not valid for the current currency rules",
          });
        }

        if (existing) {
          let changed = false;
          if (existing.currencyName !== currencyName) {
            existing.currencyName = currencyName;
            changed = true;
          }
          if (String(existing.country?.id ?? "") !== String(country.id)) {
            existing.country = { id: country.id } as Country;
            changed = true;
          }
          if (
            existing.priority !==
            toStringOrFallback(row.nPriority, existing.priority)
          ) {
            existing.priority = toStringOrFallback(
              row.nPriority,
              existing.priority,
            );
            changed = true;
          }
          if (
            existing.ratePer !==
            toStringOrFallback(row.nRatePer, existing.ratePer)
          ) {
            existing.ratePer = toStringOrFallback(
              row.nRatePer,
              existing.ratePer,
            );
            changed = true;
          }
          if (
            existing.defaultMinRate !==
            toStringOrFallback(row.nDefaultMinRate, existing.defaultMinRate)
          ) {
            existing.defaultMinRate = toStringOrFallback(
              row.nDefaultMinRate,
              existing.defaultMinRate,
            );
            changed = true;
          }
          if (
            existing.defaultMaxRate !==
            toStringOrFallback(row.nDefaultMaxRate, existing.defaultMaxRate)
          ) {
            existing.defaultMaxRate = toStringOrFallback(
              row.nDefaultMaxRate,
              existing.defaultMaxRate,
            );
            changed = true;
          }
          if (existing.calculationMethod !== mapped.calculationMethod) {
            existing.calculationMethod = mapped.calculationMethod as any;
            changed = true;
          }
          if (
            existing.openRatePremium !==
            toStringOrFallback(row.nOpenRatePremium, existing.openRatePremium)
          ) {
            existing.openRatePremium = toStringOrFallback(
              row.nOpenRatePremium,
              existing.openRatePremium,
            );
            changed = true;
          }
          if (
            existing.gulfDiscFactor !==
            toStringOrFallback(row.nGulfDiscFactor, existing.gulfDiscFactor)
          ) {
            existing.gulfDiscFactor = toStringOrFallback(
              row.nGulfDiscFactor,
              existing.gulfDiscFactor,
            );
            changed = true;
          }
          if (
            existing.amexMapCode !==
            toStringOrFallback(row.vAmexCode, existing.amexMapCode)
          ) {
            existing.amexMapCode = toStringOrFallback(
              row.vAmexCode,
              existing.amexMapCode,
            );
            changed = true;
          }
          if (existing.active !== toBoolean(row.bIsActive)) {
            existing.active = toBoolean(row.bIsActive);
            changed = true;
          }
          if (existing.onlyStocking !== onlyStocking) {
            existing.onlyStocking = onlyStocking;
            changed = true;
          }
          const desiredProductAllowed = productAllowed;
          if (existing.productAllowed !== desiredProductAllowed) {
            existing.productAllowed = desiredProductAllowed as any;
            changed = true;
          }
          if (changed && context.mode === "real") {
            existing.createdBy = createdBy;
            existing.updatedBy = updatedBy;
            existing.deletedAt = audit.deletedAt;
            existing.deletedBy = audit.deletedBy;
            await this.targetCurrencyRepository.save(existing);
            this.logger.log(
              `[mcurrency] updated existing currency id=${existing.id}`,
            );
          }

          this.currencyMap.set(String(oldId), existing.id);
          this.addIdMap(context, {
            oldTable: "mcurrency",
            oldId,
            newTable: "currencies",
            newUuid: existing.id,
            lookupKey,
          });
          this.addRowResult(context, {
            sourceTable: "mcurrency",
            sourcePrimaryKey: String(oldId ?? ""),
            targetId: existing.id,
            status: changed ? "updated" : "mapped",
            note: `Reused currency ${currencyCode} for country ${country.id}`,
          });
          continue;
        }

        const currency = {
          currencyCode,
          currencyName,
          country: { id: country.id } as Country,
          priority: mapped.priority,
          ratePer: mapped.ratePer,
          defaultMinRate: mapped.defaultMinRate,
          defaultMaxRate: mapped.defaultMaxRate,
          calculationMethod: mapped.calculationMethod as any,
          openRatePremium: mapped.openRatePremium,
          gulfDiscFactor: mapped.gulfDiscFactor,
          amexMapCode: mapped.amexMapCode,
          group: mapped.group,
          pricingGroup: null,
          active: mapped.active,
          onlyStocking,
          productAllowed: productAllowed as any,
          createdBy,
          updatedBy,
          deletedAt: audit.deletedAt,
          deletedBy: audit.deletedBy,
        } as Currency;

        if (mapped.calculationMethodTransformed) {
          this.addTransformation(context, {
            sourceTable: "mcurrency",
            sourceField: "vCalculationMethod",
            ruleName: "currency-calculation-method-normalization",
            originalValue: row.vCalculationMethod,
            transformedValue: mapped.calculationMethod,
            result: "transformed",
          });
        }

        this.addFieldStatus(context, {
          sourceTable: "mcurrency",
          sourceColumn: "nCountryID",
          sourceValue: row.nCountryID,
          targetColumn: "country_id",
          targetValue: country.id,
          status: mapped.missingLegacyCountryId ? "transformed" : "saved",
          note: mapped.missingLegacyCountryId
            ? `nCountryID missing/0; country resolved from currency ISO hint ${mapped.countryIsoHint}`
            : `nCountryID ${mapped.legacyCountryId} plus ISO hint ${mapped.countryIsoHint ?? "none"} resolved to country ${resolvedCountryLabel}`,
        });

        if (context.mode === "real") {
          const saved = await this.targetCurrencyRepository.save(currency);
          this.currencyMap.set(String(oldId), saved.id);
          this.addIdMap(context, {
            oldTable: "mcurrency",
            oldId,
            newTable: "currencies",
            newUuid: saved.id,
            lookupKey,
          });
          this.addRowResult(context, {
            sourceTable: "mcurrency",
            sourcePrimaryKey: String(oldId ?? ""),
            targetId: saved.id,
            status: "inserted",
            note: `Currency created for ${resolvedCountryLabel}`,
          });
          inserted += 1;
        } else {
          const mockId = `mock-currency-${oldId ?? randomUUID()}`;
          this.currencyMap.set(String(oldId), mockId);
          this.addIdMap(context, {
            oldTable: "mcurrency",
            oldId,
            newTable: "currencies",
            newUuid: mockId,
            lookupKey,
          });
          this.addRowResult(context, {
            sourceTable: "mcurrency",
            sourcePrimaryKey: String(oldId ?? ""),
            targetId: mockId,
            status: "saved",
            note: `Would create currency for ${resolvedCountryLabel}`,
          });
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: "mcurrency",
          sourceRowIdentifier: String(oldId ?? ""),
          fieldName: "currency",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown currency migration failure",
        });
      }
    }

    for (const extraCode of listedCodes) {
      if (
        !rows.some(
          (row) => toNullableString(row.vCncode)?.toUpperCase() === extraCode,
        )
      ) {
        this.addUnmappedColumn(context, {
          sourceTable: currencyList?.tableName ?? "MCURRENCYLIST",
          sourceColumn: "cncode",
          sourceValue: extraCode,
          reason:
            "MCURRENCYLIST code has no mCurrency row; list is catalog-only and is not inserted",
        });
      }
    }

    context.summary.rowsInserted += inserted;
    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: "mcurrency",
      targetTable: "currencies",
      rowCountScanned: rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: "mCurrency is the operational master. MASTCURR/MCURRENCYLIST are catalogs only. Country uses nCountryID maps, then ISO hint (INR→IN).",
    });
    this.logger.log(
      `[mcurrency] table migration finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`,
    );
  }

  private async ensureCategoryOption(
    context: MigrationContext,
    code: string,
    value: string,
    label: string,
  ): Promise<SelectOption | null> {
    const normalizedValue = value.trim().toUpperCase();
    const lookupKey = `${code}:${normalizedValue}`;
    const cachedId = this.activeContext?.idMap.find(
      (row) =>
        row.oldTable === "category_options" &&
        row.lookupKey === lookupKey &&
        typeof row.newUuid === "string",
    )?.newUuid;
    if (typeof cachedId === "string" && cachedId && !cachedId.startsWith("mock-")) {
      const existingCached = await this.targetSelectOptionRepository.findOne({
        where: { id: cachedId },
      });
      if (existingCached) {
        return existingCached;
      }
    }

    const existing = await this.targetSelectOptionRepository.findOne({
      where: { code, value: normalizedValue },
    });
    if (existing) {
      this.addIdMap(context, {
        oldTable: "category_options",
        oldId: normalizedValue,
        newTable: "category_options",
        newUuid: existing.id,
        lookupKey,
      });
      return existing;
    }

    const actor = context.bootstrapAdminUserId ?? context.actorUserId;
    if (context.mode !== "real") {
      const mockId = `mock-cat-${code}-${normalizedValue}`;
      this.addIdMap(context, {
        oldTable: "category_options",
        oldId: normalizedValue,
        newTable: "category_options",
        newUuid: mockId,
        lookupKey,
      });
      return { id: mockId, code, value: normalizedValue, label } as SelectOption;
    }

    const saved = await this.targetSelectOptionRepository.save(
      this.targetSelectOptionRepository.create({
        code,
        value: normalizedValue,
        label: label.trim() || normalizedValue,
        sortOrder: 0,
        isActive: true,
        createdBy: actor,
        updatedBy: actor,
      }),
    );
    this.addIdMap(context, {
      oldTable: "category_options",
      oldId: normalizedValue,
      newTable: "category_options",
      newUuid: saved.id,
      lookupKey,
    });
    return saved;
  }

  private async processFinancialCodes(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "financialCode")) {
      return;
    }

    this.logger.log(
      `[FinancialProfile] table migration started mode=${context.mode}`,
    );
    const source = await this.readSourceTableIfExists(
      pool,
      LEGACY_FINANCIAL_TABLE_CANDIDATES.financialProfile,
    );
    if (!source) {
      this.addWarning(context, {
        sourceTable: "FinancialProfile",
        note: "FinancialProfile was not found on the old master",
      });
      return;
    }
    const subSource = await this.readSourceTableIfExists(
      pool,
      LEGACY_FINANCIAL_TABLE_CANDIDATES.financialSubProfile,
    );
    const rows = source.rows;
    this.ensureSourceRows(context, "financialCode", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const actor = context.bootstrapAdminUserId ?? context.actorUserId;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const mapped = mapLegacyFinancialProfile(row);
      try {
        for (const field of mapped.unmapped) {
          this.addUnmappedColumn(context, {
            sourceTable: source.tableName,
            sourceColumn: field.sourceColumn,
            sourceValue: field.sourceValue,
            reason: field.reason,
          });
        }
        if (mapped.defaultSignTransformed) {
          this.addTransformation(context, {
            sourceTable: source.tableName,
            sourceField: "vDefaultSign",
            ruleName: "financial-default-sign",
            originalValue: row.vDefaultSign,
            transformedValue: mapped.defaultSignValue,
            result: "transformed",
          });
        }

        const financialType = await this.ensureCategoryOption(
          context,
          financialTypeCategoryCode,
          mapped.financialTypeValue,
          mapped.financialTypeLabel,
        );
        const defaultSign = await this.ensureCategoryOption(
          context,
          defaultSignCategoryCode,
          mapped.defaultSignValue,
          mapped.defaultSignLabel,
        );
        if (!financialType || !defaultSign) {
          skipped += 1;
          continue;
        }

        const existing = await this.targetFinancialCodeRepository.findOne({
          where: { financialCode: mapped.financialCode },
          relations: { financialType: true, defaultSign: true },
        });

        if (existing) {
          this.financialCodeMap.set(String(mapped.oldId), existing.id);
          this.addIdMap(context, {
            oldTable: source.tableName,
            oldId: mapped.oldId,
            newTable: "financial_codes",
            newUuid: existing.id,
            lookupKey: mapped.financialCode,
          });
          this.addRowResult(context, {
            sourceTable: source.tableName,
            sourcePrimaryKey: String(mapped.oldId ?? ""),
            targetId: existing.id,
            status: "mapped",
            note: `Reused financial code ${mapped.financialCode}`,
          });
          continue;
        }

        if (context.mode === "real") {
          const saved = await this.targetFinancialCodeRepository.save(
            this.targetFinancialCodeRepository.create({
              financialCode: mapped.financialCode,
              financialName: mapped.financialName,
              financialType: { id: financialType.id } as SelectOption,
              defaultSign: { id: defaultSign.id } as SelectOption,
              priority: mapped.priority,
              createdBy: actor,
              updatedBy: actor,
            }),
          );
          inserted += 1;
          this.financialCodeMap.set(String(mapped.oldId), saved.id);
          this.addIdMap(context, {
            oldTable: source.tableName,
            oldId: mapped.oldId,
            newTable: "financial_codes",
            newUuid: saved.id,
            lookupKey: mapped.financialCode,
          });
          this.addRowResult(context, {
            sourceTable: source.tableName,
            sourcePrimaryKey: String(mapped.oldId ?? ""),
            targetId: saved.id,
            status: "inserted",
            note: `Created financial code ${mapped.financialCode}`,
          });
        } else {
          const mockId = `mock-fin-${mapped.oldId ?? mapped.financialCode}`;
          inserted += 1;
          this.financialCodeMap.set(String(mapped.oldId), mockId);
          this.addIdMap(context, {
            oldTable: source.tableName,
            oldId: mapped.oldId,
            newTable: "financial_codes",
            newUuid: mockId,
            lookupKey: mapped.financialCode,
          });
          this.addRowResult(context, {
            sourceTable: source.tableName,
            sourcePrimaryKey: String(mapped.oldId ?? ""),
            targetId: mockId,
            status: "inserted",
            note: `Would create financial code ${mapped.financialCode}`,
          });
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: source.tableName,
          sourceRowIdentifier: String(mapped.oldId ?? ""),
          fieldName: "financialCode",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown financial code migration failure",
        });
      }
    }

    for (const row of subSource?.rows ?? []) {
      context.summary.rowsScanned += 1;
      const mapped = mapLegacyFinancialSubProfile(row);
      try {
        const parentId =
          (mapped.legacyFinancialId
            ? this.financialCodeMap.get(mapped.legacyFinancialId)
            : null) ?? null;
        if (!parentId) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: subSource?.tableName ?? "FinancialSubProfile",
            sourceRowIdentifier: String(mapped.oldId ?? ""),
            reason: `Parent financial nFID ${mapped.legacyFinancialId} not resolved`,
            fallbackAction: "Sub-profile skipped",
          });
          continue;
        }
        for (const field of mapped.unmapped) {
          this.addUnmappedColumn(context, {
            sourceTable: subSource?.tableName ?? "FinancialSubProfile",
            sourceColumn: field.sourceColumn,
            sourceValue: field.sourceValue,
            reason: field.reason,
          });
        }

        const existing = await this.targetFinancialSubProfileRepository.findOne({
          where: {
            financialSubCode: mapped.financialSubCode,
            financialCode: { id: parentId } as any,
          },
        });
        if (existing) {
          this.financialSubProfileMap.set(String(mapped.oldId), existing.id);
          continue;
        }

        if (context.mode === "real" && !parentId.startsWith("mock-")) {
          const saved = await this.targetFinancialSubProfileRepository.save(
            this.targetFinancialSubProfileRepository.create({
              financialCode: { id: parentId } as FinancialCode,
              financialSubCode: mapped.financialSubCode,
              financialSubName: mapped.financialSubName,
              priority: mapped.priority,
              createdBy: actor,
              updatedBy: actor,
            }),
          );
          inserted += 1;
          this.financialSubProfileMap.set(String(mapped.oldId), saved.id);
        } else {
          const mockId = `mock-finsub-${mapped.oldId ?? mapped.financialSubCode}`;
          inserted += 1;
          this.financialSubProfileMap.set(String(mapped.oldId), mockId);
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: subSource?.tableName ?? "FinancialSubProfile",
          sourceRowIdentifier: String(mapped.oldId ?? ""),
          fieldName: "financialSubProfile",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown financial sub-profile migration failure",
        });
      }
    }

    context.summary.rowsInserted += inserted;
    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: "FinancialProfile",
      targetTable: "financial_codes",
      rowCountScanned: rows.length + (subSource?.rows.length ?? 0),
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: "vFinType B/P/T → FINANCIALTYPE; blank vDefaultSign → NONE",
    });
  }

  private async processAccounts(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "account")) {
      return;
    }

    this.logger.log(
      `[AccountsProfile] table migration started mode=${context.mode}`,
    );
    const source = await this.readSourceTableIfExists(
      pool,
      LEGACY_ACCOUNT_TABLE_CANDIDATES.accountsProfile,
    );
    if (!source) {
      this.addWarning(context, {
        sourceTable: "AccountsProfile",
        note: "AccountsProfile was not found on the old master",
      });
      return;
    }
    const bankDtls = await this.readSourceTableIfExists(
      pool,
      LEGACY_ACCOUNT_TABLE_CANDIDATES.accountsBankDtls,
    );
    if (bankDtls && bankDtls.rows.length === 0) {
      this.addWarning(context, {
        sourceTable: bankDtls.tableName,
        note: "AccountsBankDtls has no rows; bank detail fields skipped",
      });
    }

    const rows = source.rows;
    this.ensureSourceRows(context, "account", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const actor = context.bootstrapAdminUserId ?? context.actorUserId;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const mapped = mapLegacyAccountProfile(row);
      try {
        for (const field of mapped.unmapped) {
          this.addUnmappedColumn(context, {
            sourceTable: source.tableName,
            sourceColumn: field.sourceColumn,
            sourceValue: field.sourceValue,
            reason: field.reason,
          });
        }

        let financialCodeId =
          (mapped.legacyFinancialId
            ? this.financialCodeMap.get(mapped.legacyFinancialId)
            : null) ?? null;
        if (!financialCodeId && mapped.legacyFinancialCode) {
          const byCode = await this.targetFinancialCodeRepository.findOne({
            where: { financialCode: mapped.legacyFinancialCode },
          });
          financialCodeId = byCode?.id ?? null;
        }
        if (!financialCodeId) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: source.tableName,
            sourceRowIdentifier: String(mapped.oldId ?? mapped.accountCode),
            reason: `Financial code not resolved for account ${mapped.accountCode}`,
            fallbackAction: "Account skipped",
          });
          continue;
        }

        let currencyId: string | null = null;
        if (mapped.legacyCurrencyId) {
          currencyId = this.currencyMap.get(mapped.legacyCurrencyId) ?? null;
        }
        if (!currencyId && mapped.currencyIsoHint) {
          const inr = await this.targetCurrencyRepository.findOne({
            where: { currencyCode: mapped.currencyIsoHint },
          });
          currencyId = inr?.id ?? null;
        }
        if (!currencyId) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: source.tableName,
            sourceRowIdentifier: String(mapped.oldId ?? mapped.accountCode),
            reason: `Currency not resolved for account ${mapped.accountCode} (need INR)`,
            fallbackAction: "Account skipped",
          });
          continue;
        }

        const accountType = mapped.accountTypeValue
          ? await this.ensureCategoryOption(
              context,
              accountCategoryCodes.accountType,
              mapped.accountTypeValue,
              mapped.accountTypeLabel ?? mapped.accountTypeValue,
            )
          : null;
        const subLedger = mapped.subLedgerValue
          ? await this.ensureCategoryOption(
              context,
              accountCategoryCodes.subLedger,
              mapped.subLedgerValue,
              mapped.subLedgerValue,
            )
          : null;
        const bankNature = await this.ensureCategoryOption(
          context,
          accountCategoryCodes.bankNature,
          mapped.bankNatureValue,
          mapped.bankNatureLabel,
        );
        const divisionDept = mapped.divisionDeptValue
          ? await this.ensureCategoryOption(
              context,
              accountCategoryCodes.divisionDept,
              mapped.divisionDeptValue,
              mapped.divisionDeptValue,
            )
          : null;
        const subProfileId = mapped.legacySubFinancialId
          ? this.financialSubProfileMap.get(mapped.legacySubFinancialId) ?? null
          : null;

        const existing = await this.targetAccountProfileRepository.findOne({
          where: { accountCode: mapped.accountCode },
        });
        if (existing) {
          this.accountMap.set(String(mapped.oldId), existing.id);
          this.accountCodeMap.set(mapped.accountCode, existing.id);
          this.addIdMap(context, {
            oldTable: source.tableName,
            oldId: mapped.oldId,
            newTable: "account_profiles",
            newUuid: existing.id,
            lookupKey: mapped.accountCode,
          });
          continue;
        }

        if (context.mode === "real" && !String(currencyId).startsWith("mock-")) {
          const saved = await this.targetAccountProfileRepository.save(
            this.targetAccountProfileRepository.create({
              accountCode: mapped.accountCode,
              accountName: mapped.accountName,
              currency: { id: currencyId } as Currency,
              currencyId,
              financialCode: { id: financialCodeId } as FinancialCode,
              financialCodeId,
              financialSubProfile: subProfileId
                ? ({ id: subProfileId } as FinancialSubProfile)
                : null,
              financialSubProfileId: subProfileId,
              divisionDept: divisionDept
                ? ({ id: divisionDept.id } as SelectOption)
                : null,
              accountType: accountType
                ? ({ id: accountType.id } as SelectOption)
                : null,
              subLedger: subLedger
                ? ({ id: subLedger.id } as SelectOption)
                : null,
              bankNature: bankNature
                ? ({ id: bankNature.id } as SelectOption)
                : null,
              zeroBalanceAtEod: mapped.zeroBalanceAtEod,
              retailPurchase: mapped.retailPurchase,
              retailSale: mapped.retailSale,
              receipt: mapped.receipt,
              payment: mapped.payment,
              journalVoucher: mapped.isSystemAccount,
              active: mapped.active,
              cmsBank: mapped.cmsBank,
              directRemittance: mapped.directRemittance,
              createdBy: actor,
              updatedBy: actor,
            }),
          );
          inserted += 1;
          this.accountMap.set(String(mapped.oldId), saved.id);
          this.accountCodeMap.set(mapped.accountCode, saved.id);
          this.addIdMap(context, {
            oldTable: source.tableName,
            oldId: mapped.oldId,
            newTable: "account_profiles",
            newUuid: saved.id,
            lookupKey: mapped.accountCode,
          });
        } else {
          const mockId = `mock-acc-${mapped.oldId ?? mapped.accountCode}`;
          inserted += 1;
          this.accountMap.set(String(mapped.oldId), mockId);
          this.accountCodeMap.set(mapped.accountCode, mockId);
          this.addIdMap(context, {
            oldTable: source.tableName,
            oldId: mapped.oldId,
            newTable: "account_profiles",
            newUuid: mockId,
            lookupKey: mapped.accountCode,
          });
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: source.tableName,
          sourceRowIdentifier: String(mapped.oldId ?? ""),
          fieldName: "account",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown account migration failure",
        });
      }
    }

    context.summary.rowsInserted += inserted;
    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: "AccountsProfile",
      targetTable: "account_profiles",
      rowCountScanned: rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: "nCurrencyID 0 → INR; vCode unique accountCode; AccountsBankDtls empty skipped",
    });
  }

  private resolveAccountRef(
    code: string | null,
  ): AccountProfile | null {
    if (!code) {
      return null;
    }
    const id = this.accountCodeMap.get(code);
    if (!id || id.startsWith("mock-")) {
      return null;
    }
    return { id } as AccountProfile;
  }

  private async processProducts(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "product")) {
      return;
    }

    this.logger.log(`[mProductM] table migration started mode=${context.mode}`);
    const source = await this.readSourceTableIfExists(
      pool,
      LEGACY_PRODUCT_TABLE_CANDIDATES.product,
    );
    if (!source) {
      this.addWarning(context, {
        sourceTable: "mProductM",
        note: "mProductM was not found on the old master",
      });
      return;
    }
    const rows = source.rows;
    this.ensureSourceRows(context, "product", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const actor = context.bootstrapAdminUserId ?? context.actorUserId;

    // Warm accountCodeMap from DB for soft/real reuse
    if (this.accountCodeMap.size === 0) {
      const accounts = await this.targetAccountProfileRepository.find({
        select: ["id", "accountCode"],
      });
      for (const account of accounts) {
        this.accountCodeMap.set(
          String(account.accountCode).toUpperCase(),
          account.id,
        );
      }
    }

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const mapped = mapLegacyProductRecord(row);
      try {
        for (const field of mapped.unmapped) {
          this.addUnmappedColumn(context, {
            sourceTable: source.tableName,
            sourceColumn: field.sourceColumn,
            sourceValue: field.sourceValue,
            reason: field.reason,
          });
        }

        for (const [field, code] of Object.entries(mapped.accountCodes)) {
          if (code && !this.accountCodeMap.get(code)) {
            this.addUnmappedColumn(context, {
              sourceTable: source.tableName,
              sourceColumn: field,
              sourceValue: code,
              reason: `Account code ${code} not in account map; product FK left null`,
            });
          }
        }

        const existing = await this.targetProductRepository.findOne({
          where: { productCode: mapped.productCode },
        });
        if (existing) {
          this.productMap.set(String(mapped.oldId), existing.id);
          this.productCodeMap.set(mapped.productCode, existing.id);
          this.addIdMap(context, {
            oldTable: source.tableName,
            oldId: mapped.oldId,
            newTable: "products",
            newUuid: existing.id,
            lookupKey: mapped.productCode,
          });
          continue;
        }

        const payload = {
          productCode: mapped.productCode,
          productDescription: mapped.productDescription,
          availableInRetailBuying: mapped.availableInRetailBuying,
          retailBuyingSeriesApplicable: mapped.retailBuyingSeriesApplicable,
          availableInRetailSelling: mapped.availableInRetailSelling,
          retailSellingSeriesApplicable: mapped.retailSellingSeriesApplicable,
          availableInBulkBuying: mapped.availableInBulkBuying,
          bulkBuyingSeriesApplicable: mapped.bulkBuyingSeriesApplicable,
          availableInBulkSelling: mapped.availableInBulkSelling,
          bulkSellingSeriesApplicable: mapped.bulkSellingSeriesApplicable,
          instrumentIssuingAuthorityRequired:
            mapped.instrumentIssuingAuthorityRequired,
          maintainBlankStockOfProduct: mapped.maintainBlankStockOfProduct,
          denominationApplicable: mapped.denominationApplicable,
          productRequiresSettlement: mapped.productRequiresSettlement,
          isActiveProduct: mapped.isActiveProduct,
          levelPriority: mapped.levelPriority,
          reversalEffectOfProfits: mapped.reversalEffectOfProfits,
          passAutoReceiptOfStockWhenSold: mapped.passAutoReceiptOfStockWhenSold,
          allowFractionInFEAmount: mapped.allowFractionInFEAmount,
          allowMulticard: mapped.allowMulticard,
          retail: mapped.retail,
          commLimit: mapped.commLimit,
          maxAmtComm: mapped.maxAmtComm,
          automateSettlementRate: mapped.automateSettlementRate,
          separateSettlementForEachInstrument:
            mapped.separateSettlementForEachInstrument,
          pickSaleRateAvgAsSettlementRate:
            mapped.pickSaleRateAvgAsSettlementRate,
          bulkFee: mapped.bulkFee,
          splitAndStoreBlankStockReceived:
            mapped.splitAndStoreBlankStockReceived,
          allowChangingDenominationInSales:
            mapped.allowChangingDenominationInSales,
          reload: mapped.reload,
          allowAddOnLinking: mapped.allowAddOnLinking,
          askReference: mapped.askReference,
          allowProductCancellation: mapped.allowProductCancellation,
          profitAc: this.resolveAccountRef(mapped.accountCodes.profitAc),
          acOfIssuer: this.resolveAccountRef(mapped.accountCodes.acOfIssuer),
          commissionAc: this.resolveAccountRef(mapped.accountCodes.commissionAc),
          openAc: this.resolveAccountRef(mapped.accountCodes.openAc),
          closingAc: this.resolveAccountRef(mapped.accountCodes.closingAc),
          expenseAc: this.resolveAccountRef(mapped.accountCodes.expenseAc),
          purchaseAc: this.resolveAccountRef(mapped.accountCodes.purchaseAc),
          saleAc: this.resolveAccountRef(mapped.accountCodes.saleAc),
          fakeAccount: this.resolveAccountRef(mapped.accountCodes.fakeAccount),
          bulkPurAc: this.resolveAccountRef(mapped.accountCodes.bulkPurAc),
          bulkSaleAc: this.resolveAccountRef(mapped.accountCodes.bulkSaleAc),
          bulkProficAc: this.resolveAccountRef(mapped.accountCodes.bulkProficAc),
          purchaseRetCancAc: this.resolveAccountRef(
            mapped.accountCodes.purchaseRetCancAc,
          ),
          purchaseBlkCancAc: this.resolveAccountRef(
            mapped.accountCodes.purchaseBlkCancAc,
          ),
          saleRetCancAc: this.resolveAccountRef(
            mapped.accountCodes.saleRetCancAc,
          ),
          saleBlkCancAc: this.resolveAccountRef(
            mapped.accountCodes.saleBlkCancAc,
          ),
          branchPurAc: this.resolveAccountRef(mapped.accountCodes.branchPurAc),
          branchSaleAc: this.resolveAccountRef(mapped.accountCodes.branchSaleAc),
          profitAcBrnSale: this.resolveAccountRef(
            mapped.accountCodes.profitAcBrnSale,
          ),
          createdBy: actor,
          updatedBy: actor,
        } as Product;

        if (context.mode === "real") {
          const saved = await this.targetProductRepository.save(payload);
          inserted += 1;
          this.productMap.set(String(mapped.oldId), saved.id);
          this.productCodeMap.set(mapped.productCode, saved.id);
          this.addIdMap(context, {
            oldTable: source.tableName,
            oldId: mapped.oldId,
            newTable: "products",
            newUuid: saved.id,
            lookupKey: mapped.productCode,
          });
        } else {
          const mockId = `mock-product-${mapped.oldId ?? mapped.productCode}`;
          inserted += 1;
          this.productMap.set(String(mapped.oldId), mockId);
          this.productCodeMap.set(mapped.productCode, mockId);
          this.addIdMap(context, {
            oldTable: source.tableName,
            oldId: mapped.oldId,
            newTable: "products",
            newUuid: mockId,
            lookupKey: mapped.productCode,
          });
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: source.tableName,
          sourceRowIdentifier: String(mapped.oldId ?? ""),
          fieldName: "product",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown product migration failure",
        });
      }
    }

    context.summary.rowsInserted += inserted;
    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: "mProductM",
      targetTable: "products",
      rowCountScanned: rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: "Account FKs resolved by v*AccountCode when accounts migrated; EEFC codes logged unmapped",
    });
  }

  private async processCurrencyProductLinks(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "currencyProductLink")) {
      return;
    }

    this.logger.log(
      `[mCurrencyProductLink] table migration started mode=${context.mode}`,
    );
    const source = await this.readSourceTableIfExists(
      pool,
      LEGACY_PRODUCT_TABLE_CANDIDATES.currencyProductLink,
    );
    if (!source) {
      this.addWarning(context, {
        sourceTable: "mCurrencyProductLink",
        note: "mCurrencyProductLink was not found on the old master",
      });
      return;
    }
    const rows = source.rows;
    this.ensureSourceRows(context, "currencyProductLink", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const actor = context.bootstrapAdminUserId ?? context.actorUserId;

    if (this.productCodeMap.size === 0) {
      const products = await this.targetProductRepository.find({
        select: ["id", "productCode"],
      });
      for (const product of products) {
        this.productCodeMap.set(
          String(product.productCode).toUpperCase(),
          product.id,
        );
      }
    }

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const mapped = mapLegacyCurrencyProductLink(row);
      try {
        const currencyId = mapped.legacyCurrencyId
          ? this.currencyMap.get(mapped.legacyCurrencyId) ?? null
          : null;
        const productId = mapped.productCode
          ? this.productCodeMap.get(mapped.productCode) ?? null
          : null;
        if (!currencyId || !productId) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: source.tableName,
            sourceRowIdentifier: `${mapped.legacyCurrencyId}:${mapped.productCode}`,
            reason: !currencyId
              ? `Currency nCurrencyID ${mapped.legacyCurrencyId} not resolved`
              : `Product ${mapped.productCode} not resolved`,
            fallbackAction: "Link skipped; margins stay null when created later",
          });
          continue;
        }
        if (currencyId.startsWith("mock-") || productId.startsWith("mock-")) {
          inserted += 1;
          continue;
        }

        const existing = await this.targetProductCurrencyRateRepository.findOne({
          where: { currencyId, productId },
        });
        if (existing) {
          if (existing.isActive !== mapped.isActive && context.mode === "real") {
            existing.isActive = mapped.isActive;
            await this.targetProductCurrencyRateRepository.save(existing);
          }
          continue;
        }

        if (context.mode === "real") {
          await this.targetProductCurrencyRateRepository.save(
            this.targetProductCurrencyRateRepository.create({
              productId,
              currencyId,
              product: { id: productId } as Product,
              currency: { id: currencyId } as Currency,
              buyMarginType: null,
              buyMarginValue: null,
              buyMinRate: null,
              buyMaxRate: null,
              saleMarginType: null,
              saleMarginValue: null,
              saleMinRate: null,
              saleMaxRate: null,
              isActive: mapped.isActive,
              createdBy: actor,
              updatedBy: actor,
            }),
          );
        }
        inserted += 1;
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: source.tableName,
          sourceRowIdentifier: `${mapped.legacyCurrencyId}:${mapped.productCode}`,
          fieldName: "currencyProductLink",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown currency-product link migration failure",
        });
      }
    }

    context.summary.rowsInserted += inserted;
    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: "mCurrencyProductLink",
      targetTable: "product_currency_rates",
      rowCountScanned: rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: "Allow-list only; all margin/rate fields null; bIsActive=0 → isActive false",
    });
  }

  private async processMstRates(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "mstRate")) {
      return;
    }

    this.logger.log(
      `[mstRates] rates/margins migration started mode=${context.mode}`,
    );
    const { tableName, rows } = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_RATE_TABLE_CANDIDATES.mstRates,
    );
    this.ensureSourceRows(context, "mstRate", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;
    const mappedRows = rows.map((row) => mapLegacyMstRateRow(row));

    for (let index = 0; index < rows.length; index += 1) {
      context.summary.rowsScanned += 1;
      const mapped = mappedRows[index];
      for (const field of mapped.unmapped) {
        this.addFieldStatus(context, {
          sourceTable: tableName,
          sourceColumn: field.sourceColumn,
          sourceValue: field.sourceValue,
          status: "unmapped",
          note: field.reason,
        });
        this.addUnmappedColumn(context, {
          sourceTable: tableName,
          sourceColumn: field.sourceColumn,
          sourceValue: field.sourceValue,
          reason: field.reason,
        });
      }
    }

    const { selected, skipped: baseSkipped } =
      selectCurrencyBaseRateRows(mappedRows);

    for (const item of baseSkipped) {
      skipped += 1;
      this.addSkippedRow(context, {
        sourceTable: tableName,
        sourceRowIdentifier:
          item.row.oldId ??
          `${item.row.currencyCode ?? "?"}:${item.row.productCode ?? "?"}`,
        reason: item.reason,
        fallbackAction:
          "Skipped as currency_rates base; product min/max may still apply",
      });
    }

    for (const row of selected) {
      const sourceKey =
        row.oldId ?? `${row.currencyCode ?? "?"}:${row.productCode ?? "?"}`;
      try {
        const currencyId = await this.resolveCurrencyIdByCode(row.currencyCode);
        if (!currencyId) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            reason: `Currency ${row.currencyCode} not resolved for currency_rates base`,
            fallbackAction: "Skipped MANUAL currency_rates insert",
          });
          continue;
        }

        const buy = row.buy!;
        const sell = row.sell!;
        const buyNum = Number(buy);
        const sellNum = Number(sell);
        const baseRate =
          !Number.isNaN(buyNum) && !Number.isNaN(sellNum)
            ? String((buyNum + sellNum) / 2)
            : buy;
        const notes = `Migrated from mstRates nRateID=${row.oldId ?? "?"} product=${row.productCode ?? "?"}`;

        if (context.mode === "real" && !currencyId.startsWith("mock-")) {
          const saved = await this.targetCurrencyRateRepository.save(
            this.targetCurrencyRateRepository.create({
              currencyId,
              currency: { id: currencyId } as Currency,
              provider: CurrencyRateProvider.MANUAL,
              baseBuyRate: buy,
              baseSaleRate: sell,
              baseRate,
              isActive: true,
              notes,
              enteredBy: actorId,
              createdBy: actorId,
              updatedBy: actorId,
            }),
          );
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.addRowResult(context, {
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: saved.id,
            status: "inserted",
            note: `Created MANUAL currency_rates for ${row.currencyCode}`,
          });
        } else {
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.addRowResult(context, {
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: `mock-currency-rate-${sourceKey}`,
            status: "mocked",
            note: `Would create MANUAL currency_rates for ${row.currencyCode}`,
          });
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: tableName,
          fieldName: "mstRate",
          errorMessage:
            error instanceof Error ? error.message : String(error),
        });
      }
    }

    const aggregates = aggregateMstRatesForProductCurrency(mappedRows);
    for (const agg of aggregates) {
      const sourceKey = `${agg.productCode}|${agg.currencyCode}`;
      try {
        const currencyId = await this.resolveCurrencyIdByCode(agg.currencyCode);
        const productId = await this.resolveProductIdByCode(agg.productCode);
        if (!currencyId || !productId) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            reason: !currencyId
              ? `Currency ${agg.currencyCode} not resolved for product_currency_rates`
              : `Product ${agg.productCode} not resolved for product_currency_rates`,
            fallbackAction: "Skipped product rate min/max upsert",
          });
          continue;
        }

        if (currencyId.startsWith("mock-") || productId.startsWith("mock-")) {
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.addRowResult(context, {
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: `mock-pcr-rates-${sourceKey}`,
            status: "mocked",
            note: "Would upsert product_currency_rates min/max from mstRates",
          });
          continue;
        }

        const existing =
          await this.targetProductCurrencyRateRepository.findOne({
            where: { productId, currencyId },
          });

        if (existing) {
          if (context.mode === "real") {
            existing.buyMinRate = agg.buyMinRate;
            existing.buyMaxRate = agg.buyMaxRate;
            existing.saleMinRate = agg.saleMinRate;
            existing.saleMaxRate = agg.saleMaxRate;
            existing.updatedBy = actorId;
            await this.targetProductCurrencyRateRepository.save(existing);
          }
          this.addRowResult(context, {
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: existing.id,
            status: context.mode === "real" ? "updated" : "mocked",
            note: "Upserted product_currency_rates min/max (margins kept)",
          });
          continue;
        }

        if (context.mode === "real") {
          const saved = await this.targetProductCurrencyRateRepository.save(
            this.targetProductCurrencyRateRepository.create({
              productId,
              currencyId,
              product: { id: productId } as Product,
              currency: { id: currencyId } as Currency,
              buyMarginType: null,
              buyMarginValue: null,
              buyMinRate: agg.buyMinRate,
              buyMaxRate: agg.buyMaxRate,
              saleMarginType: null,
              saleMarginValue: null,
              saleMinRate: agg.saleMinRate,
              saleMaxRate: agg.saleMaxRate,
              isActive: true,
              createdBy: actorId,
              updatedBy: actorId,
            }),
          );
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.addRowResult(context, {
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: saved.id,
            status: "inserted",
            note: "Created product_currency_rates with mstRates min/max",
          });
        } else {
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.addRowResult(context, {
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: `mock-pcr-rates-${sourceKey}`,
            status: "mocked",
            note: "Would create product_currency_rates with mstRates min/max",
          });
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: tableName,
          fieldName: "mstRate",
          errorMessage:
            error instanceof Error ? error.message : String(error),
        });
      }
    }

    context.tableResults.push({
      sourceTable: tableName,
      targetTable: "currency_rates + product_currency_rates",
      scanned: rows.length,
      inserted,
      skipped,
      failed,
      note: "MANUAL base from blank IssCode/CN/latest; product min/max aggregated",
    });
    this.logger.log(
      `[mstRates] finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`,
    );
  }

  private async processMarginMaster(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "marginMaster")) {
      return;
    }

    this.logger.log(
      `[MarginMaster] margin migration started mode=${context.mode}`,
    );
    const { tableName, rows } = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_RATE_TABLE_CANDIDATES.marginMaster,
    );
    this.ensureSourceRows(context, "marginMaster", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;
    const mappedRows = rows.map((row) => mapLegacyMarginMasterRow(row));

    const sampleLimit = Math.min(mappedRows.length, 5);
    for (let index = 0; index < sampleLimit; index += 1) {
      for (const field of mappedRows[index].unmapped) {
        this.addFieldStatus(context, {
          sourceTable: tableName,
          sourceColumn: field.sourceColumn,
          sourceValue: field.sourceValue,
          status: "unmapped",
          note: field.reason,
        });
        this.addUnmappedColumn(context, {
          sourceTable: tableName,
          sourceColumn: field.sourceColumn,
          sourceValue: field.sourceValue,
          reason: field.reason,
        });
      }
    }

    for (const row of rows) {
      context.summary.rowsScanned += 1;
    }

    const aggregates = aggregateMarginMasterForProductCurrency(mappedRows);
    for (const agg of aggregates) {
      const sourceKey = `${agg.productCode}|${agg.currencyCode}`;
      try {
        const currencyId = await this.resolveCurrencyIdByCode(agg.currencyCode);
        const productId = await this.resolveProductIdByCode(agg.productCode);
        if (!currencyId || !productId) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            reason: !currencyId
              ? `Currency ${agg.currencyCode} not resolved for margins`
              : `Product ${agg.productCode} not resolved for margins`,
            fallbackAction: "Skipped product_currency_rates margin upsert",
          });
          continue;
        }

        if (currencyId.startsWith("mock-") || productId.startsWith("mock-")) {
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.addRowResult(context, {
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: `mock-pcr-margin-${sourceKey}`,
            status: "mocked",
            note: "Would upsert product_currency_rates margins from MarginMaster",
          });
          continue;
        }

        const existing =
          await this.targetProductCurrencyRateRepository.findOne({
            where: { productId, currencyId },
          });

        if (existing) {
          if (context.mode === "real") {
            existing.buyMarginValue = agg.buyMarginValue;
            existing.saleMarginValue = agg.saleMarginValue;
            existing.buyMarginType = agg.buyMarginType;
            existing.saleMarginType = agg.saleMarginType;
            existing.updatedBy = actorId;
            await this.targetProductCurrencyRateRepository.save(existing);
          }
          this.addRowResult(context, {
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: existing.id,
            status: context.mode === "real" ? "updated" : "mocked",
            note: "Upserted product_currency_rates margins (PAISA)",
          });
          continue;
        }

        if (context.mode === "real") {
          const saved = await this.targetProductCurrencyRateRepository.save(
            this.targetProductCurrencyRateRepository.create({
              productId,
              currencyId,
              product: { id: productId } as Product,
              currency: { id: currencyId } as Currency,
              buyMarginType: agg.buyMarginType,
              buyMarginValue: agg.buyMarginValue,
              buyMinRate: null,
              buyMaxRate: null,
              saleMarginType: agg.saleMarginType,
              saleMarginValue: agg.saleMarginValue,
              saleMinRate: null,
              saleMaxRate: null,
              isActive: true,
              createdBy: actorId,
              updatedBy: actorId,
            }),
          );
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.addRowResult(context, {
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: saved.id,
            status: "inserted",
            note: "Created product_currency_rates with MarginMaster margins",
          });
        } else {
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.addRowResult(context, {
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: `mock-pcr-margin-${sourceKey}`,
            status: "mocked",
            note: "Would create product_currency_rates with MarginMaster margins",
          });
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: tableName,
          fieldName: "marginMaster",
          errorMessage:
            error instanceof Error ? error.message : String(error),
        });
      }
    }

    context.tableResults.push({
      sourceTable: tableName,
      targetTable: "product_currency_rates",
      scanned: rows.length,
      inserted,
      skipped,
      failed,
      note: "buyMargin=min sellMargin=max type PAISA; branch/issuer ignored",
    });
    this.logger.log(
      `[MarginMaster] finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`,
    );
  }

  private async processTickerRates(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "tickerRate")) {
      return;
    }

    this.logger.log(
      `[tickerRate] ticker live rate migration started mode=${context.mode}`,
    );
    const ticker = await this.readSourceTableIfExists(
      pool,
      LEGACY_RATE_TABLE_CANDIDATES.tickerLiveRate,
    );
    const tmp = await this.readSourceTableIfExists(
      pool,
      LEGACY_RATE_TABLE_CANDIDATES.tmpLiveRate,
    );

    if (!ticker && !tmp) {
      this.addWarning(context, {
        sourceTable: "tickerliverate",
        note: "Neither tickerliverate nor tmpliverate was readable; no TICKER currency_rates migrated",
      });
      context.tableResults.push({
        sourceTable: "tickerliverate/tmpliverate",
        targetTable: "currency_rates",
        scanned: 0,
        inserted: 0,
        skipped: 0,
        failed: 0,
        note: "Source tables missing",
      });
      return;
    }

    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;
    const totalScanned = (ticker?.rows.length ?? 0) + (tmp?.rows.length ?? 0);

    const processMapped = async (
      sourceTable: string,
      mapped: ReturnType<typeof mapLegacyTickerLiveRate>,
    ) => {
      context.summary.rowsScanned += 1;
      const sourceKey = mapped.sourceKey;
      try {
        for (const field of mapped.unmapped) {
          this.addFieldStatus(context, {
            sourceTable,
            sourceColumn: field.sourceColumn,
            sourceValue: field.sourceValue,
            status: "unmapped",
            note: field.reason,
          });
          this.addUnmappedColumn(context, {
            sourceTable,
            sourceColumn: field.sourceColumn,
            sourceValue: field.sourceValue,
            reason: field.reason,
          });
        }

        if (mapped.skipReason) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable,
            reason: mapped.skipReason,
            fallbackAction: "Skipped TICKER currency_rates insert",
          });
          return;
        }

        const currencyId = await this.resolveCurrencyIdByCode(
          mapped.currencyCode,
        );
        if (!currencyId) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable,
            reason: `Currency ${mapped.currencyCode} not resolved for TICKER rate`,
            fallbackAction: "Skipped TICKER currency_rates insert",
          });
          return;
        }

        if (context.mode === "real" && !currencyId.startsWith("mock-")) {
          const saved = await this.targetCurrencyRateRepository.save(
            this.targetCurrencyRateRepository.create({
              currencyId,
              currency: { id: currencyId } as Currency,
              provider: CurrencyRateProvider.TICKER,
              baseBuyRate: mapped.baseBuyRate!,
              baseSaleRate: mapped.baseSaleRate!,
              baseRate: (() => {
                const buy = Number(mapped.baseBuyRate);
                const sell = Number(mapped.baseSaleRate);
                if (!Number.isNaN(buy) && !Number.isNaN(sell)) {
                  return String((buy + sell) / 2);
                }
                return mapped.baseBuyRate;
              })(),
              isActive: true,
              notes: `Migrated from ${mapped.sourceTable} key=${sourceKey}`,
              enteredBy: actorId,
              createdBy: actorId,
              updatedBy: actorId,
            }),
          );
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.addRowResult(context, {
            sourceTable,
            sourcePrimaryKey: sourceKey,
            targetId: saved.id,
            status: "inserted",
            note: `Created TICKER currency_rates for ${mapped.currencyCode}`,
          });
        } else {
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.addRowResult(context, {
            sourceTable,
            sourcePrimaryKey: sourceKey,
            targetId: `mock-ticker-rate-${sourceKey}`,
            status: "mocked",
            note: `Would create TICKER currency_rates for ${mapped.currencyCode}`,
          });
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable,
          fieldName: "tickerRate",
          errorMessage:
            error instanceof Error ? error.message : String(error),
        });
      }
    };

    if (ticker) {
      for (const row of ticker.rows) {
        await processMapped(ticker.tableName, mapLegacyTickerLiveRate(row));
      }
    }
    if (tmp) {
      for (const row of tmp.rows) {
        await processMapped(tmp.tableName, mapLegacyTmpLiveRate(row));
      }
    }

    context.tableResults.push({
      sourceTable: [ticker?.tableName, tmp?.tableName]
        .filter(Boolean)
        .join("+"),
      targetTable: "currency_rates",
      scanned: totalScanned,
      inserted,
      skipped,
      failed,
      note: "Provider TICKER from tickerliverate / tmpliverate",
    });
    this.logger.log(
      `[tickerRate] finished scanned=${totalScanned} inserted=${inserted} skipped=${skipped} failed=${failed}`,
    );
  }

  private async processRateDeferredSkips(
    _pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "rateDeferredSkip")) {
      return;
    }

    this.logger.log(
      `[rateDeferredSkip] logging deferred rate/margin tables mode=${context.mode}`,
    );
    const selectedLower = new Set(
      context.selectedTables.map((table) => table.toLowerCase()),
    );

    for (const entry of RATE_MIGRATION_SKIPPED_TABLES) {
      if (!selectedLower.has(entry.table.toLowerCase())) {
        continue;
      }
      this.addSkippedRow(context, {
        sourceTable: entry.table,
        reason: entry.reason,
        fallbackAction: "Deferred; not migrated this wave",
      });
      this.addWarning(context, {
        sourceTable: entry.table,
        note: entry.reason,
      });
      context.tableResults.push({
        sourceTable: entry.table,
        targetTable: "(deferred)",
        scanned: 0,
        inserted: 0,
        skipped: 1,
        failed: 0,
        note: entry.reason,
      });
    }
  }


  private resolvePurposeIdByLegacyCode(
    context: MigrationContext,
    legacyPurposeCode: string,
  ): string | null {
    const key = `legacy-purpose-code:${legacyPurposeCode.trim().toUpperCase()}`;
    const hit = context.idMap.find(
      (row) =>
        row.lookupKey === key &&
        typeof row.newUuid === "string" &&
        Boolean(row.newUuid),
    );
    return typeof hit?.newUuid === "string" ? hit.newUuid : null;
  }

  private rememberLegacyPurposeCodes(
    context: MigrationContext,
    purposeId: string,
    legacyPurposeCodes: string[],
    sourceTable: string,
  ) {
    for (const legacy of legacyPurposeCodes) {
      const code = legacy.trim().toUpperCase();
      if (!code) continue;
      this.addIdMap(context, {
        oldTable: sourceTable,
        oldId: code,
        newTable: "purposes",
        newUuid: purposeId,
        lookupKey: `legacy-purpose-code:${code}`,
      });
    }
  }

  private async processPurposes(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "purpose")) {
      return;
    }

    this.logger.log(
      `[mstPurpose] purpose migration started mode=${context.mode}`,
    );
    const { tableName, rows } = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_PURPOSE_TABLE_CANDIDATES.mstPurpose,
    );
    this.ensureSourceRows(context, "purpose", rows);

    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;
    const mappedRows = rows.map((row) => mapLegacyMstPurposeRow(row));
    context.summary.rowsScanned += rows.length;

    for (const mapped of mappedRows) {
      for (const field of mapped.unmapped) {
        this.addFieldStatus(context, {
          sourceTable: tableName,
          sourceColumn: field.sourceColumn,
          sourceValue: field.sourceValue,
          status: "unmapped",
          note: field.reason,
        });
        this.addUnmappedColumn(context, {
          sourceTable: tableName,
          sourceColumn: field.sourceColumn,
          sourceValue: field.sourceValue,
          reason: field.reason,
        });
      }
    }

    const collapsed = collapseMstPurposesByDescription(mappedRows);

    for (const purpose of collapsed) {
      for (const field of purpose.unmapped) {
        if (
          field.reason.includes("collision") ||
          field.reason.includes("defaulted")
        ) {
          this.addFieldStatus(context, {
            sourceTable: tableName,
            sourceColumn: field.sourceColumn,
            sourceValue: field.sourceValue,
            status: "transformed",
            note: field.reason,
          });
          this.addTransformation(context, {
            sourceTable: tableName,
            sourceField: field.sourceColumn,
            ruleName: "purpose-code-or-scope-default",
            originalValue: field.sourceValue,
            transformedValue: purpose.code,
            result: "transformed",
          });
        }
      }

      const sourceKey =
        purpose.legacyIds.join(",") ||
        purpose.descriptionKey ||
        purpose.code;

      try {
        if (!purpose.sell && !purpose.purchase) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            sourceRowIdentifier: sourceKey,
            reason: "Purpose has neither sell nor purchase after collapse",
            fallbackAction: "Skipped purposes insert",
          });
          continue;
        }
        if (!purpose.corporate && !purpose.individual) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            sourceRowIdentifier: sourceKey,
            reason: "Purpose has neither corporate nor individual after collapse",
            fallbackAction: "Skipped purposes insert",
          });
          continue;
        }

        const notes = [
          `Migrated from mstPurpose ids=${purpose.legacyIds.join("|") || "?"}`,
          purpose.legacyPurposeCodes.length
            ? `oldPurposeCodes=${purpose.legacyPurposeCodes.join("|")}`
            : null,
          purpose.codeSource === "disambiguated"
            ? `codeDisambiguated=${purpose.code}`
            : null,
        ]
          .filter(Boolean)
          .join("; ");

        const existing = await this.targetPurposeRepository.findOne({
          where: { code: purpose.code },
          withDeleted: true,
        });

        if (context.mode === "real") {
          if (existing) {
            existing.description = purpose.description;
            existing.sell = purpose.sell;
            existing.purchase = purpose.purchase;
            existing.corporate = purpose.corporate;
            existing.individual = purpose.individual;
            existing.updatedBy = actorId;
            if (purpose.isDeleted && !existing.deletedAt) {
              existing.deletedAt = new Date();
              existing.deletedBy = actorId;
            }
            if (!purpose.isDeleted && existing.deletedAt) {
              existing.deletedAt = null;
              existing.deletedBy = null;
            }
            await this.targetPurposeRepository.save(existing);
            inserted += 1;
            context.summary.rowsInserted += 1;
            this.addRowResult(context, {
              sourceTable: tableName,
              sourcePrimaryKey: sourceKey,
              targetId: existing.id,
              status: "reused",
              note: `Updated purposes ${purpose.code} (${purpose.description})`,
            });
            this.addIdMap(context, {
              oldTable: tableName,
              oldId: sourceKey,
              newTable: "purposes",
              newUuid: existing.id,
              lookupKey: `purpose-code:${purpose.code}`,
            });
            this.rememberLegacyPurposeCodes(context, existing.id, purpose.legacyPurposeCodes, tableName);
          } else {
            const saved = await this.targetPurposeRepository.save(
              this.targetPurposeRepository.create({
                code: purpose.code,
                description: purpose.description,
                threshold: "0",
                rate: "0",
                rateType: PurposeRateType.PERCENT,
                sell: purpose.sell,
                purchase: purpose.purchase,
                corporate: purpose.corporate,
                individual: purpose.individual,
                createdBy: actorId,
                updatedBy: actorId,
                deletedAt: purpose.isDeleted ? new Date() : null,
                deletedBy: purpose.isDeleted ? actorId : null,
              }),
            );
            inserted += 1;
            context.summary.rowsInserted += 1;
            this.addRowResult(context, {
              sourceTable: tableName,
              sourcePrimaryKey: sourceKey,
              targetId: saved.id,
              status: "inserted",
              note: `Created purposes ${purpose.code} from description initials (${notes})`,
            });
            this.addIdMap(context, {
              oldTable: tableName,
              oldId: sourceKey,
              newTable: "purposes",
              newUuid: saved.id,
              lookupKey: `purpose-code:${purpose.code}`,
            });
            this.rememberLegacyPurposeCodes(context, saved.id, purpose.legacyPurposeCodes, tableName);
          }
        } else {
          const mockId = `mock-purpose-${purpose.code}`;
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.addRowResult(context, {
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: mockId,
            status: "mocked",
            note: `Would upsert purposes ${purpose.code} sell=${purpose.sell} purchase=${purpose.purchase} corp=${purpose.corporate} indiv=${purpose.individual}`,
          });
          this.addIdMap(context, {
            oldTable: tableName,
            oldId: sourceKey,
            newTable: "purposes",
            newUuid: mockId,
            lookupKey: `purpose-code:${purpose.code}`,
          });
            this.rememberLegacyPurposeCodes(context, mockId, purpose.legacyPurposeCodes, tableName);
        }

        this.addColumnMapping(context, {
          sourceTable: tableName,
          sourceColumn: "Description",
          sourceValue: purpose.description,
          targetColumn: "code",
          targetValue: purpose.code,
          result: purpose.codeSource === "initials" ? "transformed" : "created",
        });
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: tableName,
          sourceRowIdentifier: sourceKey,
          fieldName: "purpose",
          errorMessage:
            error instanceof Error ? error.message : String(error),
        });
      }
    }

    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    context.tableResults.push({
      sourceTable: tableName,
      targetTable: "purposes",
      scanned: rows.length,
      inserted,
      skipped,
      failed,
      note: "Collapsed by Description; 2-letter code from initials; flags OR-merged from vTrnType/TrnSubType",
    });
    this.logger.log(
      `[mstPurpose] finished scanned=${rows.length} collapsed=${collapsed.length} inserted=${inserted} skipped=${skipped} failed=${failed}`,
    );
  }

  private async processPurposeDeferredSkips(
    _pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "purposeDeferredSkip")) {
      return;
    }

    this.logger.log(
      `[purposeDeferredSkip] logging deferred purpose tables mode=${context.mode}`,
    );
    const selectedLower = new Set(
      context.selectedTables.map((table) => table.toLowerCase()),
    );

    for (const entry of PURPOSE_MIGRATION_SKIPPED_TABLES) {
      if (!selectedLower.has(entry.table.toLowerCase())) {
        continue;
      }
      this.addSkippedRow(context, {
        sourceTable: entry.table,
        sourceRowIdentifier: entry.table,
        reason: entry.reason,
        fallbackAction: "Deferred / ask-client; not migrated this wave",
      });
      this.addWarning(context, {
        sourceTable: entry.table,
        note: entry.reason,
      });
      context.tableResults.push({
        sourceTable: entry.table,
        targetTable: "(deferred)",
        scanned: 0,
        inserted: 0,
        skipped: 1,
        failed: 0,
        note: entry.reason,
      });
    }
  }


  private async processMstTaxGstRate(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "gstRate")) {
      return;
    }

    this.logger.log(`[mstTax] GST_RATE migration started mode=${context.mode}`);
    const { tableName, rows } = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_TAX_TABLE_CANDIDATES.mstTax,
    );
    this.ensureSourceRows(context, "gstRate", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;
    context.summary.rowsScanned += rows.length;

    const mappedRows = rows.map((row) => mapLegacyMstTaxRow(row));
    const candidates = mappedRows.filter((row) => row.isGstRateCandidate && !row.skipReason);
    for (const mapped of mappedRows) {
      for (const field of mapped.unmapped) {
        this.addUnmappedColumn(context, {
          sourceTable: tableName,
          sourceColumn: field.sourceColumn,
          sourceValue: field.sourceValue,
          reason: field.reason,
        });
      }
      if (!mapped.isGstRateCandidate || mapped.skipReason) {
        skipped += 1;
        this.addSkippedRow(context, {
          sourceTable: tableName,
          sourceRowIdentifier: mapped.oldId ?? mapped.code ?? "?",
          reason: mapped.skipReason ?? "Not a GST_RATE candidate",
          fallbackAction: "Skipped mstTax row for GST_RATE",
        });
      }
    }

    if (candidates.length === 0) {
      this.addWarning(context, {
        sourceTable: tableName,
        note: "No gst18% row found to set GST_RATE",
      });
    } else {
      const chosen = candidates[0];
      if (candidates.length > 1) {
        this.addWarning(context, {
          sourceTable: tableName,
          note: `Multiple gst18% candidates; using nTaxID=${chosen.oldId ?? "?"} VALUE→${chosen.ratePercent}`,
        });
      }
      try {
        const ratePercent = chosen.ratePercent!;
        if (context.mode === "real") {
          let category = await this.targetAdvancedSettingRepository.findOne({
            where: { code: "TAX_CONFIGURATION", nodeType: NodeType.Category },
          });
          if (!category) {
            category = await this.targetAdvancedSettingRepository.save(
              this.targetAdvancedSettingRepository.create({
                code: "TAX_CONFIGURATION",
                label: "TAX CONFIGURATION",
                description: "Migrated tax configuration",
                nodeType: NodeType.Category,
                sortOrder: 0,
                isActive: true,
                createdBy: actorId,
                updatedBy: actorId,
              }),
            );
          }
          let setting = await this.targetAdvancedSettingRepository.findOne({
            where: { code: "GST_RATE", nodeType: NodeType.Setting },
          });
          if (setting) {
            setting.valueType = ValueType.Decimal;
            setting.valueDecimal = ratePercent;
            setting.valueText = null;
            setting.parentId = category.id;
            setting.updatedBy = actorId;
            setting.isActive = true;
            await this.targetAdvancedSettingRepository.save(setting);
          } else {
            setting = await this.targetAdvancedSettingRepository.save(
              this.targetAdvancedSettingRepository.create({
                code: "GST_RATE",
                label: "GST RATE (%)",
                description: chosen.description ?? "Migrated from mstTax gst18%",
                nodeType: NodeType.Setting,
                valueType: ValueType.Decimal,
                valueDecimal: ratePercent,
                parentId: category.id,
                sortOrder: 0,
                isActive: true,
                createdBy: actorId,
                updatedBy: actorId,
              }),
            );
          }
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.addRowResult(context, {
            sourceTable: tableName,
            sourcePrimaryKey: chosen.oldId ?? chosen.code ?? "gst18%",
            targetId: setting.id,
            status: "inserted",
            note: `Set GST_RATE=${ratePercent} from mstTax ${chosen.code}`,
          });
          this.addIdMap(context, {
            oldTable: tableName,
            oldId: chosen.oldId ?? "gst18%",
            newTable: "advanced_settings",
            newUuid: setting.id,
            lookupKey: "setting:GST_RATE",
          });
        } else {
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.addRowResult(context, {
            sourceTable: tableName,
            sourcePrimaryKey: chosen.oldId ?? chosen.code ?? "gst18%",
            targetId: `mock-gst-rate-${ratePercent}`,
            status: "mocked",
            note: `Would set GST_RATE=${ratePercent}`,
          });
        }
        this.addTransformation(context, {
          sourceTable: tableName,
          sourceField: "VALUE",
          ruleName: "mstTax-fraction-to-gst-rate-percent",
          originalValue: chosen.rawValue,
          transformedValue: chosen.ratePercent,
          result: "transformed",
        });
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: tableName,
          sourceRowIdentifier: chosen.oldId ?? "gst18%",
          fieldName: "GST_RATE",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    context.tableResults.push({
      sourceTable: tableName,
      targetTable: "advanced_settings",
      scanned: rows.length,
      inserted,
      skipped,
      failed,
      note: "gst18% → GST_RATE percent; other mstTax codes skipped",
    });
  }

  private async processGstInfo(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "gstInfo")) {
      return;
    }

    this.logger.log(`[GSTInfo] party gstNo migration started mode=${context.mode}`);
    const { tableName, rows } = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_TAX_TABLE_CANDIDATES.gstInfo,
    );
    this.ensureSourceRows(context, "gstInfo", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;
    context.summary.rowsScanned += rows.length;

    for (const row of rows) {
      const mapped = mapLegacyGstInfoRow(row);
      const sourceKey = mapped.oldId ?? mapped.partyCode ?? "?";
      for (const field of mapped.unmapped) {
        this.addUnmappedColumn(context, {
          sourceTable: tableName,
          sourceColumn: field.sourceColumn,
          sourceValue: field.sourceValue,
          reason: field.reason,
        });
      }
      try {
        if (mapped.skipReason) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            sourceRowIdentifier: sourceKey,
            reason: mapped.skipReason,
            fallbackAction: "Skipped GSTInfo row",
          });
          continue;
        }

        let partyId =
          (mapped.legacyPartyId
            ? context.partyMap.get(mapped.legacyPartyId)
            : undefined) ??
          (mapped.partyCode
            ? context.partyCodeMap.get(mapped.partyCode.toUpperCase())
            : undefined) ??
          null;

        if (!partyId && mapped.partyCode) {
          const existing = await this.targetPartyProfileRepository.findOne({
            where: { code: mapped.partyCode.toUpperCase() },
          });
          partyId = existing?.id ?? null;
          if (partyId) {
            this.rememberParty(
              context,
              mapped.legacyPartyId,
              mapped.partyCode,
              partyId,
            );
          }
        }

        if (!partyId) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            sourceRowIdentifier: sourceKey,
            reason: `Party not resolved for ncodesid=${mapped.legacyPartyId ?? "?"} vCode=${mapped.partyCode ?? "?"}`,
            fallbackAction: "Skipped until party migrated",
          });
          continue;
        }

        if (context.mode === "real" && !partyId.startsWith("mock-")) {
          await this.targetPartyProfileRepository.update(partyId, {
            gstNo: mapped.gstNo!,
            updatedBy: actorId,
          });
        }
        inserted += 1;
        context.summary.rowsInserted += 1;
        this.addRowResult(context, {
          sourceTable: tableName,
          sourcePrimaryKey: sourceKey,
          targetId: partyId,
          status: context.mode === "real" ? "inserted" : "mocked",
          note: `Set party gstNo from ${mapped.gstPickSource}=${mapped.gstNo}`,
        });
        this.addTransformation(context, {
          sourceTable: tableName,
          sourceField: mapped.gstPickSource ?? "GSTIN",
          ruleName: "gstinfo-igst-cgst-sgst-to-gstNo",
          originalValue: mapped.gstNo,
          transformedValue: mapped.gstNo,
          result: "transformed",
        });
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: tableName,
          sourceRowIdentifier: sourceKey,
          fieldName: "gstNo",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    context.tableResults.push({
      sourceTable: tableName,
      targetTable: "party_profiles",
      scanned: rows.length,
      inserted,
      skipped,
      failed,
      note: "IGSTNO→CGSTNO→SGSTNO into party_profiles.gstNo",
    });
  }

  private async processTcsPerMaster(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "tcsPerMaster")) {
      return;
    }

    this.logger.log(
      `[TCSPERMASTER] purpose_slabs migration started mode=${context.mode}`,
    );
    const { tableName, rows } = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_TAX_TABLE_CANDIDATES.tcsPerMaster,
    );
    this.ensureSourceRows(context, "tcsPerMaster", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;
    context.summary.rowsScanned += rows.length;

    const mappedRows = rows.map((row) => mapLegacyTcsPerMasterRow(row));
    for (const mapped of mappedRows) {
      for (const field of mapped.unmapped) {
        this.addUnmappedColumn(context, {
          sourceTable: tableName,
          sourceColumn: field.sourceColumn,
          sourceValue: field.sourceValue,
          reason: field.reason,
        });
      }
    }

    const { selected, skipped: selectSkipped } =
      selectTcsPerMasterRowsForSlabs(mappedRows);
    for (const item of selectSkipped) {
      skipped += 1;
      this.addSkippedRow(context, {
        sourceTable: tableName,
        sourceRowIdentifier: item.row.oldId ?? item.row.legacyPurposeCode ?? "?",
        reason: item.reason,
        fallbackAction: "Skipped TCSPERMASTER row for purpose_slabs",
      });
    }

    const byPurpose = new Map<string, typeof selected>();
    for (const row of selected) {
      const purposeId = this.resolvePurposeIdByLegacyCode(
        context,
        row.legacyPurposeCode!,
      );
      if (!purposeId) {
        skipped += 1;
        this.addSkippedRow(context, {
          sourceTable: tableName,
          sourceRowIdentifier: row.oldId ?? row.legacyPurposeCode ?? "?",
          reason: `No migrated purpose for old PURPOSECODE=${row.legacyPurposeCode}`,
          fallbackAction: "Run mstPurpose first; unmatched codes logged",
        });
        continue;
      }
      if (purposeId.startsWith("mock-") && context.mode === "real") {
        skipped += 1;
        continue;
      }
      const list = byPurpose.get(purposeId) ?? [];
      list.push(row);
      byPurpose.set(purposeId, list);
    }

    for (const [purposeId, purposeRows] of byPurpose) {
      purposeRows.sort(
        (a, b) => Number(a.fromAmount ?? 0) - Number(b.fromAmount ?? 0),
      );
      try {
        if (context.mode === "real") {
          await this.targetPurposeSlabRepository.delete({ purposeId });
          let sortOrder = 0;
          for (const row of purposeRows) {
            const saved = await this.targetPurposeSlabRepository.save(
              this.targetPurposeSlabRepository.create({
                purposeId,
                sortOrder,
                fromAmount: row.fromAmount!,
                toAmount: row.toAmount,
                rate: row.ratePercent!,
                rateType: PurposeRateType.PERCENT,
                createdBy: actorId,
                updatedBy: actorId,
              }),
            );
            inserted += 1;
            context.summary.rowsInserted += 1;
            this.addRowResult(context, {
              sourceTable: tableName,
              sourcePrimaryKey: row.oldId ?? `${row.legacyPurposeCode}:${row.fromAmount}`,
              targetId: saved.id,
              status: "inserted",
              note: `purpose_slabs for legacy ${row.legacyPurposeCode} ${row.fromAmount}-${row.toAmount} @ ${row.ratePercent}%`,
            });
            sortOrder += 1;
          }
        } else {
          for (const row of purposeRows) {
            inserted += 1;
            context.summary.rowsInserted += 1;
            this.addRowResult(context, {
              sourceTable: tableName,
              sourcePrimaryKey: row.oldId ?? `${row.legacyPurposeCode}:${row.fromAmount}`,
              targetId: `mock-slab-${row.legacyPurposeCode}-${row.fromAmount}`,
              status: "mocked",
              note: `Would upsert purpose_slabs for ${row.legacyPurposeCode}`,
            });
          }
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: tableName,
          sourceRowIdentifier: purposeId,
          fieldName: "purpose_slabs",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    context.tableResults.push({
      sourceTable: tableName,
      targetTable: "purpose_slabs",
      scanned: rows.length,
      inserted,
      skipped,
      failed,
      note: "Latest FROMDATE window; match purposes by legacy PurposeCode",
    });
  }

  private async processTaxDeferredSkips(
    _pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "taxDeferredSkip")) {
      return;
    }

    this.logger.log(
      `[taxDeferredSkip] logging deferred tax/TCS/GST tables mode=${context.mode}`,
    );
    const selectedLower = new Set(
      context.selectedTables.map((table) => table.toLowerCase()),
    );

    for (const entry of TAX_MIGRATION_SKIPPED_TABLES) {
      // mstTax is also used for GST_RATE — only log HFEE note when mstTax selected and gstRate also handled separately
      if (entry.table.toLowerCase() === "msttax") {
        continue;
      }
      if (!selectedLower.has(entry.table.toLowerCase())) {
        continue;
      }
      this.addSkippedRow(context, {
        sourceTable: entry.table,
        sourceRowIdentifier: entry.table,
        reason: entry.reason,
        fallbackAction: "Deferred / log-only / txn-later as documented",
      });
      this.addWarning(context, {
        sourceTable: entry.table,
        note: entry.reason,
      });
      context.tableResults.push({
        sourceTable: entry.table,
        targetTable: "(deferred)",
        scanned: 0,
        inserted: 0,
        skipped: 1,
        failed: 0,
        note: entry.reason,
      });
    }
  }

  private async processPartyProfiles(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "party")) {
      return;
    }

    this.logger.log(`[mstCodes] party migration started mode=${context.mode}`);
    await this.ensureLegacyPlaceLookups(pool, context);
    const { tableName, rows } = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_PARTY_TABLE_CANDIDATES.mstCodes,
    );
    this.ensureSourceRows(context, "party", rows);
    const ordered = sortPartyRowsForMigration(rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    type PendingLink = {
      partyId: string;
      mapped: MappedPartyProfile;
    };
    const pendingLinks: PendingLink[] = [];

    for (const row of ordered) {
      context.summary.rowsScanned += 1;
      const mapped = mapLegacyPartyProfile(row);
      const sourceKey = String(mapped.oldId ?? mapped.code);

      try {
        if (!mapped.clientType || mapped.skipReason) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            reason: mapped.skipReason ?? "Unsupported party type",
            fallbackAction: "Skipped party row",
          });
          continue;
        }

        for (const field of mapped.unmapped) {
          this.addFieldStatus(context, {
            sourceTable: tableName,
            sourceColumn: field.sourceColumn,
            sourceValue: field.sourceValue,
            status: "unmapped",
            note: field.reason,
          });
        }

        const branchId = await this.resolvePartyBranchId(pool, context, mapped);
        const categoryIds: Partial<
          Record<
            | "kycRiskCategory"
            | "entityType"
            | "businessNature"
            | "group"
            | "tdsGroup",
            string | null
          >
        > = {};

        for (const ref of mapped.categoryRefs) {
          const optionId = await this.ensureCategoryOptionByCode(context, {
            code: ref.code,
            value: ref.value,
            sourceTable: tableName,
            sourceColumn: ref.sourceColumn,
          });
          if (ref.code === CategoryOptionCodeEnum.KycRiskCategory) {
            categoryIds.kycRiskCategory = optionId;
          } else if (ref.code === CategoryOptionCodeEnum.EntityType) {
            categoryIds.entityType = optionId;
          } else if (ref.code === CategoryOptionCodeEnum.BusinessNature) {
            categoryIds.businessNature = optionId;
          } else if (ref.code === CategoryOptionCodeEnum.Group) {
            categoryIds.group = optionId;
          } else if (ref.code === CategoryOptionCodeEnum.TdsGroup) {
            categoryIds.tdsGroup = optionId;
          }
        }

        const audit = this.resolveAuditFields(row, context, {
          sourceTable: tableName,
        });
        const createdBy = this.resolveAuditUserId(
          context,
          row.nCreatedBy,
          {
            sourceTable: tableName,
            fieldName: "nCreatedBy",
          },
        );
        const updatedBy = this.resolveAuditUserId(
          context,
          row.nUpdateBy,
          {
            sourceTable: tableName,
            fieldName: "nUpdateBy",
          },
        );

        const payload = {
          code: mapped.code,
          name: mapped.name,
          type: mapped.clientType,
          status: WorkflowStatus.APPROVE,
          active: mapped.active,
          isActive: mapped.isActive,
          address1: mapped.address1,
          address2: mapped.address2,
          address3: mapped.address3,
          city: this.resolveRecordCityText(row, context, {
            sourceTable: tableName,
            fallback: "",
            targetColumn: "city",
          }),
          pinCode: mapped.pinCode,
          phoneNo: mapped.phoneNo,
          email: mapped.email,
          webSite: mapped.webSite,
          contactName: mapped.contactName,
          designation: mapped.designation,
          remarks: mapped.remarks,
          dateOfIntro: mapped.dateOfIntro ?? new Date(),
          establishmentDate: mapped.establishmentDate,
          blockDateFrom: mapped.blockDateFrom,
          creditLimit: mapped.creditLimit,
          creditDays: mapped.creditDays,
          temporaryCreditLimit: mapped.temporaryCreditLimit,
          temporaryCreditDays: mapped.temporaryCreditDays,
          chqTrxnLimit: mapped.chqTrxnLimit,
          defaultHandlingCharges: mapped.defaultHandlingCharges,
          panNo: mapped.panNo,
          accountHolderName: mapped.accountHolderName,
          bankName: mapped.bankName,
          accountNumber: mapped.accountNumber,
          ifscCode: mapped.ifscCode,
          bankBranchName: mapped.bankBranchName,
          ffmcRegNo: mapped.ffmcRegNo,
          ffmcRegDate: mapped.ffmcRegDate,
          kycApprovalNumber: mapped.kycApprovalNumber,
          isIndividual: mapped.isIndividual,
          isTdsDeducted: mapped.isTdsDeducted,
          tds: mapped.tds,
          purchase: mapped.purchase,
          sale: mapped.sale,
          printAddress: mapped.printAddress,
          eefcClient: mapped.eefcClient,
          igstOnly: mapped.igstOnly,
          applyTax: mapped.applyTax,
          cardNumberLength: mapped.cardNumberLength,
          allowCardNumberMasking: mapped.allowCardNumberMasking,
          branchId,
          branch: branchId ? ({ id: branchId } as Branch) : null,
          kycRiskCategory: categoryIds.kycRiskCategory
            ? ({ id: categoryIds.kycRiskCategory } as SelectOption)
            : null,
          entityType: categoryIds.entityType
            ? ({ id: categoryIds.entityType } as SelectOption)
            : null,
          businessNature: categoryIds.businessNature
            ? ({ id: categoryIds.businessNature } as SelectOption)
            : null,
          group: categoryIds.group
            ? ({ id: categoryIds.group } as SelectOption)
            : null,
          tdsGroup: categoryIds.tdsGroup
            ? ({ id: categoryIds.tdsGroup } as SelectOption)
            : null,
          createdBy,
          updatedBy,
          deletedAt: audit.deletedAt,
          deletedBy: audit.deletedBy,
          statusUpdatedAt: toNullableDate(row.dVerifiedDate),
        };

        let partyId: string;
        const existing = await this.targetPartyProfileRepository.findOne({
          where: { code: mapped.code },
        });

        if (existing) {
          partyId = existing.id;
          if (context.mode === "real") {
            Object.assign(existing, {
              ...payload,
              id: existing.id,
              createdBy: existing.createdBy,
            });
            if (audit.wasDeleted) {
              existing.deletedAt = audit.deletedAt;
              existing.deletedBy = audit.deletedBy;
            }
            await this.targetPartyProfileRepository.save(existing);
          }
          this.rememberParty(context, mapped.oldId, mapped.code, partyId);
          context.rowResults.push({
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: partyId,
            status: context.mode === "real" ? "reused" : "mocked",
            note: `Reused party ${mapped.code}`,
          });
        } else if (context.mode === "real") {
          const entity = this.targetPartyProfileRepository.create({
            ...payload,
          });
          const saved = (await this.targetPartyProfileRepository.save(
            entity,
          )) as PartyProfile;
          partyId = saved.id;
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.rememberParty(context, mapped.oldId, mapped.code, partyId);
          this.addIdMap(context, {
            oldTable: tableName,
            oldId: mapped.oldId,
            newTable: "party_profiles",
            newUuid: partyId,
            lookupKey: mapped.code,
          });
          context.rowResults.push({
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: partyId,
            status: "inserted",
            note: `Created party ${mapped.code} type=${mapped.clientType}`,
          });
        } else {
          partyId = `mock-party-${mapped.code}`;
          inserted += 1;
          context.summary.rowsInserted += 1;
          this.rememberParty(context, mapped.oldId, mapped.code, partyId);
          context.rowResults.push({
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: partyId,
            status: "mocked",
            note: `Would create party ${mapped.code}`,
          });
        }

        pendingLinks.push({ partyId, mapped });
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: tableName,
          fieldName: "mstCodes",
          errorMessage:
            error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Second pass: defaultAgent / marketingExecutive party FKs
    for (const { partyId, mapped } of pendingLinks) {
      let defaultAgentId: string | null = null;
      let marketingExecutiveId: string | null = null;

      if (mapped.legacyDefaultAgentCode) {
        defaultAgentId =
          context.partyCodeMap.get(mapped.legacyDefaultAgentCode) ?? null;
        if (!defaultAgentId && context.mode === "real") {
          const agent = await this.targetPartyProfileRepository.findOne({
            where: { code: mapped.legacyDefaultAgentCode },
          });
          defaultAgentId = agent?.id ?? null;
        }
        if (!defaultAgentId) {
          this.addWarning(context, {
            sourceTable: tableName,
            sourceColumn: "vDefaultAgent",
            note: `Could not resolve default agent code ${mapped.legacyDefaultAgentCode} for ${mapped.code}`,
          });
        }
      }

      if (mapped.legacyMarketingExecutiveId) {
        marketingExecutiveId =
          context.partyMap.get(mapped.legacyMarketingExecutiveId) ?? null;
        if (!marketingExecutiveId && context.mode === "real") {
          // Parent-first: try load ME from source by id if not yet mapped
          const meRow = rows.find(
            (candidate) =>
              String(candidate.nCodesID ?? "") ===
              mapped.legacyMarketingExecutiveId,
          );
          if (meRow) {
            const meMapped = mapLegacyPartyProfile(meRow);
            if (meMapped.clientType && meMapped.code) {
              marketingExecutiveId =
                context.partyCodeMap.get(meMapped.code) ?? null;
              if (!marketingExecutiveId) {
                const existingMe =
                  await this.targetPartyProfileRepository.findOne({
                    where: { code: meMapped.code },
                  });
                marketingExecutiveId = existingMe?.id ?? null;
              }
            }
          }
        }
        if (!marketingExecutiveId) {
          this.addWarning(context, {
            sourceTable: tableName,
            sourceColumn: "nMrktExecutive",
            note: `Could not resolve marketing executive id ${mapped.legacyMarketingExecutiveId} for ${mapped.code}`,
          });
        }
      }

      if (
        context.mode === "real" &&
        (defaultAgentId || marketingExecutiveId) &&
        !String(partyId).startsWith("mock-")
      ) {
        await this.targetPartyProfileRepository.update(partyId, {
          defaultAgentId: defaultAgentId,
          marketingExecutiveId: marketingExecutiveId,
        } as any);
      }
    }

    context.tableResults.push({
      sourceTable: tableName,
      targetTable: "party_profiles",
      scanned: rows.length,
      inserted,
      skipped,
      failed,
      note: "High-confidence mstCodes → party_profiles; status=APPROVE",
    });
    this.logger.log(
      `[mstCodes] finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`,
    );
  }

  private async processProductIssuerLinks(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "productIssuerLink")) {
      return;
    }

    this.logger.log(
      `[mProductIssuerLink] migration started mode=${context.mode}`,
    );
    const { tableName, rows } = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_PARTY_TABLE_CANDIDATES.productIssuerLink,
    );
    this.ensureSourceRows(context, "productIssuerLink", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const mapped = mapLegacyProductIssuerLink(row);
      const sourceKey = `${mapped.productCode}:${mapped.legacyIssuerId}`;
      try {
        if (mapped.skipReason) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            reason: mapped.skipReason,
            fallbackAction: "Skipped issuer link",
          });
          continue;
        }

        let partyId = context.partyMap.get(mapped.legacyIssuerId) ?? null;
        if (!partyId) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            reason: `Issuer nIssuerID=${mapped.legacyIssuerId} not resolved to party_profiles (run mstCodes/party first)`,
            fallbackAction: "Skipped issuer link",
          });
          continue;
        }

        const product = await this.targetProductRepository.findOne({
          where: { productCode: mapped.productCode },
        });
        if (!product) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            reason: `Product code ${mapped.productCode} not found in PostgreSQL products`,
            fallbackAction: "Skipped issuer link",
          });
          continue;
        }

        if (context.mode === "real") {
          const existing = await this.targetProductIssuerRepository.findOne(
            {
              where: {
                productId: product.id,
                partyProfileId: partyId,
              },
            },
          );
          if (existing) {
            context.rowResults.push({
              sourceTable: tableName,
              sourcePrimaryKey: sourceKey,
              targetId: existing.id,
              status: "reused",
              note: "Reused product_issuers link",
            });
          } else {
            const saved = await this.targetProductIssuerRepository.save(
              this.targetProductIssuerRepository.create({
                productId: product.id,
                partyProfileId: partyId,
                createdBy: actorId,
                updatedBy: actorId,
              }),
            );
            inserted += 1;
            context.summary.rowsInserted += 1;
            context.rowResults.push({
              sourceTable: tableName,
              sourcePrimaryKey: sourceKey,
              targetId: saved.id,
              status: "inserted",
              note: "Created product_issuers link",
            });
          }
        } else {
          inserted += 1;
          context.summary.rowsInserted += 1;
          context.rowResults.push({
            sourceTable: tableName,
            sourcePrimaryKey: sourceKey,
            targetId: `mock-issuer-link-${sourceKey}`,
            status: "mocked",
            note: "Would create product_issuers link",
          });
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: tableName,
          fieldName: "mProductIssuerLink",
          errorMessage:
            error instanceof Error ? error.message : String(error),
        });
      }
    }

    context.tableResults.push({
      sourceTable: tableName,
      targetTable: "product_issuers",
      scanned: rows.length,
      inserted,
      skipped,
      failed,
      note: "Requires migrated TC parties and products.productCode",
    });
    this.logger.log(
      `[mProductIssuerLink] finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`,
    );
  }


  private async processCompanies(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "company")) {
      return;
    }

    this.logger.log(
      `[mstcompanyrecord] table migration started mode=${context.mode}`,
    );
    const rows = await this.readSourceRows(pool, "mstcompanyrecord");
    this.ensureSourceRows(context, "company", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      try {
        const resolved = await this.resolveCompany(row, context);
        this.addRowResult(context, {
          sourceTable: "mstcompanyrecord",
          sourcePrimaryKey: String(row.nCompID ?? row.id ?? row.ID ?? ""),
          targetId: resolved.id,
          status:
            context.mode === "real" && resolved.created ? "inserted" : "mocked",
          note: `${resolved.created ? "Company created or mapped" : "Company reused from target db"}${resolved.softDeleted ? " Source row marked deleted." : ""}`,
        });
        if (resolved.created) {
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: "mstcompanyrecord",
          sourceRowIdentifier: String(row.nCompID ?? row.id ?? row.ID ?? ""),
          fieldName: "company",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown company migration failure",
        });
      }
    }

    context.summary.rowsInserted += inserted;
    this.addTableResult(context, {
      sourceTable: "mstcompanyrecord",
      targetTable: "company",
      rowCountScanned: rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: context.mode === "mock" ? "Preview only" : "Persisted to target db",
    });
    this.logger.log(
      `[mstcompanyrecord] table migration finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`,
    );
  }

  private async processBranches(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "branch")) {
      return;
    }

    this.logger.log(
      `[mstcompany] table migration started mode=${context.mode}`,
    );
    const rows = await this.readSourceRows(pool, "mstcompany");
    this.ensureSourceRows(context, "branch", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      try {
        const companyOldId = row.nCompID ?? row.ncompid;
        if (!companyOldId || !this.companyMap.has(String(companyOldId))) {
          this.addSkippedRow(context, {
            sourceTable: "mstcompany",
            sourceRowIdentifier: String(row.nBranchID ?? row.id ?? ""),
            reason: "Parent company not resolved yet",
            fallbackAction: "Branch row skipped until company exists",
          });
          skipped += 1;
          continue;
        }

        const resolved = await this.resolveBranch(row, context);
        this.addRowResult(context, {
          sourceTable: "mstcompany",
          sourcePrimaryKey: String(row.nBranchID ?? row.id ?? row.ID ?? ""),
          targetId: resolved.id,
          status: resolved.created ? "inserted" : "reused",
          note: `${resolved.created ? "Branch created or mapped" : "Branch reused from target db"}${resolved.softDeleted ? " Source row marked deleted." : ""}`,
        });
        if (resolved.created) {
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: "mstcompany",
          sourceRowIdentifier: String(row.nBranchID ?? row.id ?? row.ID ?? ""),
          fieldName: "branch",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown branch migration failure",
        });
      }
    }

    context.summary.rowsInserted += inserted;
    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: "mstcompany",
      targetTable: "branches",
      rowCountScanned: rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: context.mode === "mock" ? "Preview only" : "Persisted to target db",
    });
    this.logger.log(
      `[mstcompany] table migration finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`,
    );
  }

  private async processCounters(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "counter")) {
      return;
    }

    this.logger.log(
      `[mstcounter] table migration started mode=${context.mode}`,
    );
    const rows = await this.readSourceRows(pool, "mstcounter");
    this.ensureSourceRows(context, "counter", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      try {
        const resolved = await this.resolveCounter(row, context, pool);
        this.addRowResult(context, {
          sourceTable: "mstcounter",
          sourcePrimaryKey: String(
            row.nCounterID ?? row.nCounterId ?? row.id ?? row.ID ?? "",
          ),
          targetId: resolved.id,
          status: resolved.created ? "inserted" : "reused",
          note: `${resolved.created ? "Counter created or mapped" : "Counter reused from target db"}${resolved.softDeleted ? " Source row marked deleted." : ""}`,
        });
        if (resolved.created) {
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: "mstcounter",
          sourceRowIdentifier: String(
            row.nCounterID ?? row.nCounterId ?? row.id ?? row.ID ?? "",
          ),
          fieldName: "counter",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown counter migration failure",
        });
      }
    }

    context.summary.rowsInserted += inserted;
    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: "mstcounter",
      targetTable: "counters",
      rowCountScanned: rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: context.mode === "mock" ? "Preview only" : "Persisted to target db",
    });
    this.logger.log(
      `[mstcounter] table migration finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`,
    );
  }

  private async processUsers(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (
      !this.isTaskIncluded(context, "user") &&
      !this.isTaskIncluded(context, "role")
    ) {
      return;
    }

    this.logger.log(`[mstuser] table migration started mode=${context.mode}`);
    const rows = await this.readSourceRows(pool, "mstuser");
    this.ensureSourceRows(context, "user", rows);
    let insertedUsers = 0;
    let insertedRoles = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const sourceOldId = row.nUserID ?? row.nuserid ?? row.id ?? row.ID;
      if (
        context.bootstrapAdminSourceOldId !== null &&
        sourceOldId !== null &&
        sourceOldId !== undefined &&
        String(sourceOldId) === String(context.bootstrapAdminSourceOldId)
      ) {
        this.logger.log(
          `[mstuser] skipping bootstrap user row oldId=${String(sourceOldId)} because it was seeded earlier`,
        );
        continue;
      }
      try {
        this.logLegacyPermissionBlob(row, context, {
          sourceTable: "mstuser",
          sourceRowIdentifier: String(sourceOldId ?? ""),
        });
        const userResolved = await this.resolveUser(row, context);
        const roleResolved = await this.resolveUserRoleBundle(row, context);
        context.userRows.push(row);

        const userDeletedSuffix = userResolved.softDeleted
          ? " Source row marked deleted."
          : "";
        const roleDeletedSuffix = roleResolved.softDeleted
          ? " Source row marked deleted."
          : "";

        this.addRowResult(context, {
          sourceTable: "mstuser",
          sourcePrimaryKey: String(sourceOldId ?? ""),
          targetId: userResolved.id,
          status: userResolved.created ? "inserted" : "reused",
          note: `${userResolved.created ? "User created or mapped" : "User reused from target db"}${userDeletedSuffix}`,
        });
        this.addRowResult(context, {
          sourceTable: "mstuser",
          sourcePrimaryKey: String(sourceOldId ?? ""),
          targetId: roleResolved.id,
          status: roleResolved.created ? "inserted" : "reused",
          note: `${roleResolved.created ? "Role created from user access bundle" : "Role reused from target db"}${roleDeletedSuffix}`,
        });

        if (userResolved.created) insertedUsers += 1;
        if (roleResolved.created) insertedRoles += 1;
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: "mstuser",
          sourceRowIdentifier: String(row.nUserID ?? row.id ?? row.ID ?? ""),
          fieldName: "user",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown user migration failure",
        });
      }
    }

    context.summary.rowsInserted += insertedUsers + insertedRoles;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: "mstuser",
      targetTable: "users / roles",
      rowCountScanned: rows.length,
      rowCountInserted: insertedUsers + insertedRoles,
      rowCountSkipped: 0,
      rowCountFailed: failed,
      note: context.mode === "mock" ? "Preview only" : "Persisted to target db",
    });
    this.logger.log(
      `[mstuser] table migration finished scanned=${rows.length} inserted=${insertedUsers + insertedRoles} failed=${failed}`,
    );
  }

  private async ensureBranchCounterRelation(
    row: SourceRow,
    context: MigrationContext,
    sourceTable: string,
    pool: mssql.ConnectionPool,
  ) {
    const branchOldId = row.nBranchID ?? row.nbranchid;
    const counterOldId = row.nCounterID ?? row.ncounterid;
    if (!branchOldId || !counterOldId) {
      return null;
    }
    let branchId = this.branchMap.get(String(branchOldId));
    let counterId = this.counterMap.get(String(counterOldId));
    if (!branchId) {
      branchId = await this.resolveBranchByOldId(pool, context, branchOldId);
    }
    if (!counterId) {
      counterId = await this.resolveCounterByOldId(pool, context, counterOldId);
    }
    if (!branchId || !counterId) {
      this.addSkippedRow(context, {
        sourceTable,
        sourceRowIdentifier: String(
          row.nCBLId ?? row.nBranchUserID ?? row.nUserID ?? row.id ?? "",
        ),
        reason: "Branch or counter relation missing",
        fallbackAction: "Relation logged only",
      });
      return null;
    }

    if (row.NUSERID !== undefined && row.NUSERID !== null && row.NUSERID !== "") {
      this.addUnmappedColumn(context, {
        sourceTable,
        sourceColumn: "NUSERID",
        sourceValue: row.NUSERID,
        reason: "Link-table user id is relation metadata only; not stored on branch_counters",
      });
    }

    if (
      row.bMainCounter !== undefined &&
      row.bMainCounter !== null &&
      row.bMainCounter !== ""
    ) {
      this.addUnmappedColumn(context, {
        sourceTable,
        sourceColumn: "bMainCounter",
        sourceValue: row.bMainCounter,
        reason: "Ignored; current branch_counters has no main-counter concept",
      });
    }

    await this.upsertBranchCounterLink(context, {
      sourceTable,
      sourceRowIdentifier: String(row.nCBLId ?? row.id ?? row.ID ?? ""),
            branchId,
            counterId,
          sourceValue: {
            nBranchID: branchOldId,
            nCounterID: counterOldId,
          },
        });

    return { branchId, counterId };
  }

  private async processBranchCounterLinks(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "branchCounterLinks")) {
      return;
    }

    this.logger.log(
      `[mstBranchCounterLink] table migration started mode=${context.mode}`,
    );
    const rows = await this.readSourceRows(pool, "mstBranchCounterLink");
    this.ensureSourceRows(context, "branchCounterLinks", rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      try {
        const relation = await this.ensureBranchCounterRelation(
          row,
          context,
          "mstBranchCounterLink",
          pool,
        );
        if (!relation) {
          skipped += 1;
          continue;
        }

        this.addRowResult(context, {
          sourceTable: "mstBranchCounterLink",
          sourcePrimaryKey: String(row.nCBLId ?? row.id ?? row.ID ?? ""),
          targetId: `${relation.branchId}:${relation.counterId}`,
          status: "mapped",
          note: "Resolved onto branch_counters many-to-many",
        });
        inserted += 1;
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: "mstBranchCounterLink",
          sourceRowIdentifier: String(row.nCBLId ?? row.id ?? row.ID ?? ""),
          fieldName: "branch-counter",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown branch-counter relation failure",
        });
      }
    }

    context.summary.rowsInserted += inserted;
    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: "mstBranchCounterLink",
      targetTable: "branch_counters",
      rowCountScanned: rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note:
        context.mode === "mock"
          ? "Preview only"
          : "Persisted to branch_counters",
    });
    this.logger.log(
      `[mstBranchCounterLink] table migration finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`,
    );
  }

  private async processBranchUserLinks(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "branchUserLinks")) {
      return;
    }

    this.logger.log(
      `[mstBranchUserLink] table migration started mode=${context.mode}`,
    );
    const rows = await this.readSourceRows(pool, "mstBranchUserLink");
    this.ensureSourceRows(context, "branchUserLinks", rows);
    context.branchUserLinks = rows;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const branchOldId = row.nBranchID ?? row.nbranchid;
      const userOldId = row.nUserID ?? row.nuserid;
      const branchId = branchOldId
        ? await this.resolveBranchByOldId(pool, context, branchOldId)
        : undefined;
      const userId = userOldId
        ? await this.resolveUserByOldId(pool, context, userOldId)
        : undefined;

      if (!branchId || !userId) {
        this.addSkippedRow(context, {
          sourceTable: "mstBranchUserLink",
          sourceRowIdentifier: String(
            row.nBranchUserID ?? row.id ?? row.ID ?? "",
          ),
          reason: "User or branch not resolved",
          fallbackAction: "Will retry during user-role flush",
        });
        continue;
      }

      this.addRowResult(context, {
        sourceTable: "mstBranchUserLink",
        sourcePrimaryKey: String(row.nBranchUserID ?? row.id ?? row.ID ?? ""),
        targetId: `${userId}:${branchId}`,
        status: "mapped",
        note: "Branch-user relation captured",
      });
    }

    this.addTableResult(context, {
      sourceTable: "mstBranchUserLink",
      targetTable: "user relation context",
      rowCountScanned: rows.length,
      rowCountInserted: 0,
      rowCountSkipped: context.skippedRows.filter(
        (row) => row.sourceTable === "mstBranchUserLink",
      ).length,
      rowCountFailed: 0,
      note: "Used later for user-role assignments",
    });
    this.logger.log(
      `[mstBranchUserLink] table migration finished scanned=${rows.length} skipped=${context.skippedRows.filter((row) => row.sourceTable === "mstBranchUserLink").length}`,
    );
  }

  private async processCounterUserLinks(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "counterUserLinks")) {
      return;
    }

    this.logger.log(
      `[mstCounterUserLink] table migration started mode=${context.mode}`,
    );
    const rows = await this.readSourceRows(pool, "mstCounterUserLink");
    this.ensureSourceRows(context, "counterUserLinks", rows);
    context.counterUserLinks = rows;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const branchOldId = row.nBranchID ?? row.nbranchid;
      const counterOldId = row.nCounterID ?? row.ncounterid;
      const userOldId = row.nUserID ?? row.nuserid;
      const branchId = branchOldId
        ? await this.resolveBranchByOldId(pool, context, branchOldId)
        : undefined;
      const counterId = counterOldId
        ? await this.resolveCounterByOldId(pool, context, counterOldId)
        : undefined;
      const userId = userOldId
        ? await this.resolveUserByOldId(pool, context, userOldId)
        : undefined;

      if (!branchId || !counterId || !userId) {
        this.addSkippedRow(context, {
          sourceTable: "mstCounterUserLink",
          sourceRowIdentifier: String(row.id ?? row.nTrackingID ?? ""),
          reason: "User, branch, or counter not resolved",
          fallbackAction: "Will retry during user-role flush",
        });
        continue;
      }

      this.addRowResult(context, {
        sourceTable: "mstCounterUserLink",
        sourcePrimaryKey: String(row.id ?? row.nTrackingID ?? ""),
        targetId: `${userId}:${branchId}:${counterId}`,
        status: "mapped",
        note: "Counter-user relation captured",
      });
    }

    this.addTableResult(context, {
      sourceTable: "mstCounterUserLink",
      targetTable: "user relation context",
      rowCountScanned: rows.length,
      rowCountInserted: 0,
      rowCountSkipped: context.skippedRows.filter(
        (row) => row.sourceTable === "mstCounterUserLink",
      ).length,
      rowCountFailed: 0,
      note: "Used later for user-role assignments",
    });
    this.logger.log(
      `[mstCounterUserLink] table migration finished scanned=${rows.length} skipped=${context.skippedRows.filter((row) => row.sourceTable === "mstCounterUserLink").length}`,
    );
  }

  private getBranchCounterForBranch(
    branchId: string,
    context: MigrationContext,
  ): string | null {
    const counters = context.branchCounters.get(branchId);
    return counters && counters.length > 0 ? counters[0] : null;
  }

  private async flushUserRoleAssignments(
    context: MigrationContext,
  ): Promise<void> {
    const shouldFlush = [
      "user",
      "role",
      "userRoleLinks",
      "branchUserLinks",
      "counterUserLinks",
    ].some((task) => this.isTaskIncluded(context, task as InternalTask));
    if (!shouldFlush) {
      return;
    }

    this.logger.log(`[user_roles] flush started`);
    const uniqueAssignments = new Map<string, UserRole>();
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;

    const addAssignment = (
      userId: string,
      roleId: string,
      branchId: string,
      counterId: string,
      note: string,
    ) => {
      const key = `${userId}:${roleId}:${branchId}:${counterId}`;
      if (uniqueAssignments.has(key)) {
        return;
      }

      const entity = this.targetUserRoleRepository.create({
        user: { id: userId } as User,
        role: { id: roleId } as Role,
        branch: { id: branchId } as Branch,
        counter: { id: counterId } as Counter,
        createdBy: actorId,
        updatedBy: actorId,
        deletedAt: null,
        deletedBy: null,
      });

      uniqueAssignments.set(key, entity);
      context.rowResults.push({
        sourceTable: "user_roles",
        sourcePrimaryKey: key,
        targetId: key,
        status: context.mode === "real" ? "inserted" : "mocked",
        note,
      });
    };

    for (const row of context.userRows) {
      const oldUserId = row.nUserID ?? row.nuserid;
      const userId = oldUserId
        ? context.userMap.get(String(oldUserId))
        : undefined;
      const roleId = oldUserId
        ? context.roleMap.get(String(oldUserId))
        : undefined;
      const branchOldId = row.nBranchID ?? row.nbranchid;
      const branchId = branchOldId
        ? context.branchMap.get(String(branchOldId))
        : undefined;
      if (!userId || !roleId || !branchId) {
        continue;
      }

      const counterId = this.getBranchCounterForBranch(branchId, context);
      if (!counterId) {
        this.addWarning(context, {
          sourceTable: "mstuser",
          sourceColumn: "nBranchID",
          note: `No counter found for branch ${branchId}; user-role assignment deferred`,
        });
        continue;
      }

      addAssignment(
        userId,
        roleId,
        branchId,
        counterId,
        "Derived from mstuser row using the first linked counter for the branch",
      );
    }

    for (const row of context.branchUserLinks) {
      const oldUserId = row.nUserID ?? row.nuserid;
      const oldBranchId = row.nBranchID ?? row.nbranchid;
      const userId = oldUserId
        ? context.userMap.get(String(oldUserId))
        : undefined;
      const branchId = oldBranchId
        ? context.branchMap.get(String(oldBranchId))
        : undefined;
      if (!userId || !branchId) {
        continue;
      }
      const roleId = oldUserId
        ? context.roleMap.get(String(oldUserId))
        : undefined;
      const counterId =
        this.getBranchCounterForBranch(branchId, context) ?? null;
      if (!roleId || !counterId) {
        continue;
      }
      addAssignment(
        userId,
        roleId,
        branchId,
        counterId,
        "Derived from mstBranchUserLink using the first linked counter for the branch",
      );
    }

    for (const row of context.counterUserLinks) {
      const oldUserId = row.nUserID ?? row.nuserid;
      const oldBranchId = row.nBranchID ?? row.nbranchid;
      const oldCounterId = row.nCounterID ?? row.ncounterid;
      const userId = oldUserId
        ? context.userMap.get(String(oldUserId))
        : undefined;
      const branchId = oldBranchId
        ? context.branchMap.get(String(oldBranchId))
        : undefined;
      const counterId = oldCounterId
        ? context.counterMap.get(String(oldCounterId))
        : undefined;
      if (!userId || !branchId || !counterId) {
        continue;
      }
      const roleId = oldUserId
        ? context.roleMap.get(String(oldUserId))
        : undefined;
      if (!roleId) {
        continue;
      }
      addAssignment(
        userId,
        roleId,
        branchId,
        counterId,
        "Derived from mstCounterUserLink",
      );
    }

    const entities = [...uniqueAssignments.values()];
    if (entities.length === 0) {
      this.addWarning(context, {
        note: "No user-role assignments were resolved from the selected tables.",
      });
      this.logger.warn(`[user_roles] no assignments resolved`);
      return;
    }

    if (context.mode === "real") {
      await this.targetUserRoleRepository.save(entities);
      this.logger.log(`[user_roles] saved ${entities.length} assignment(s)`);
    }
    this.logger.log(`[user_roles] flush finished count=${entities.length}`);
  }

  private buildWorkbook(context: MigrationContext) {
    this.logger.log(
      `Building workbook for ${context.mode} run with ${context.summary.tables} table result(s)`,
    );
    const workbook = XLSX.utils.book_new();
    const addSheet = (name: string, rows: ReportRow[]) => {
      const safeRows = (rows.length > 0 ? rows : [{ message: "No rows" }]).map(
        sanitizeWorkbookRow,
      );
      const sheet = XLSX.utils.json_to_sheet(safeRows);
      XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
    };

    addSheet("Summary", [
      {
        mode: context.mode,
        runLabel:
          context.mode === "mock" ? "soft run / preview" : "real migration",
        connectionMode: context.sourceConnection,
        connectionSummary: context.connectionSummary,
        selectedTables: context.selectedTables.join(", "),
        expandedTables: context.expandedTables.join(", "),
        bootstrapAdminUserId: context.bootstrapAdminUserId ?? "",
        bootstrapAdminRoleId: context.bootstrapAdminRoleId ?? "",
        bootstrapAdminSourceOldId: context.bootstrapAdminSourceOldId ?? "",
        sharedAuditColumns:
          "createdAt, createdBy, updatedAt, updatedBy, deletedAt, deletedBy",
        tables: context.summary.tables,
        rowsScanned: context.summary.rowsScanned,
        rowsInserted: context.summary.rowsInserted,
        rowsSkipped: context.summary.rowsSkipped,
        rowsFailed: context.summary.rowsFailed,
        transformations: context.summary.transformations,
        softDeletedRows: context.summary.softDeletedRows,
      },
    ]);
    addSheet(
      "Selected Tables",
      context.selectedTables.map((table, index) => ({
        tableName: table,
        migrationOrder: index + 1,
        dependencyIncluded: context.expandedTables.includes(table)
          ? "yes"
          : "no",
      })),
    );
    addSheet("Source Connection", [
      {
        connectionMode: context.sourceConnection,
        connectionSummary: context.connectionSummary,
        verified: true,
      },
    ]);
    addSheet("Table Results", context.tableResults);
    addSheet("Row Results", context.rowResults);
    addSheet("Column Mapping", context.columnMappings);
    addSheet("Transformations", context.transformations);
    addSheet("Unmapped Old Columns", context.unmappedOldColumns);
    addSheet("Skipped Rows", context.skippedRows);
    addSheet("Errors", context.errors);
    addSheet("Warnings", context.warnings);
    addSheet("ID Map", context.idMap);
    addSheet("Field Status Log", context.fieldStatus);

    this.logger.log(
      `Workbook built with ${workbook.SheetNames.length} sheet(s)`,
    );
    return workbook;
  }

  async run(
    dto: MigrationRunRequestDto,
    mode: MigrationMode,
    actorUserId: string,
  ): Promise<{ filename: string; buffer: Buffer; summary: MigrationSummary }> {
    if (!dto.selectedTables || dto.selectedTables.length === 0) {
      throw new BadRequestException(
        "Please select at least one legacy table before running migration",
      );
    }
    const context = this.createContext(dto, mode, actorUserId);
    this.activeContext = context;
    this.logger.log(
      `Migration run started mode=${mode} actor=${actorUserId} selectedTables=${dto.selectedTables.join(",")}`,
    );

    try {
      await this.withTargetDatabase(dto, async (targetDataSource) => {
        await this.withLegacyConnections(dto, async (pools) => {
          const sourcePool = dto.oldTransactionConnection
            ? pools.transaction
            : pools.master;
          const selectedSet = new Set(context.expandedTables);
          this.logger.log(
            `Expanded migration tables: ${context.expandedTables.join(", ")}`,
          );
          this.logger.log(
            `[target-db] using ${this.connectionSummary(dto.currentMasterConnection)} for data writes`,
          );
          await this.ensureFrontendMenuCatalog(context);
          await this.ensureBootstrapAdminUser(pools.master, context);
          this.logger.log(
            `[bootstrap] adminUserId=${context.bootstrapAdminUserId ?? "n/a"} adminRoleId=${context.bootstrapAdminRoleId ?? "n/a"} sourceOldId=${String(context.bootstrapAdminSourceOldId ?? "")}`,
          );
          const taskOrder: InternalTask[] = [
            "company",
            "country",
            "state",
            "locationType",
            "currency",
            "financialCode",
            "account",
            "product",
            "currencyProductLink",
            "mstRate",
            "marginMaster",
            "tickerRate",
            "rateDeferredSkip",
            "purpose",
            "purposeDeferredSkip",
            "gstRate",
            "tcsPerMaster",
            "branch",
            "counter",
            "user",
            "role",
            "branchCounterLinks",
            "branchUserLinks",
            "counterUserLinks",
            "userRoleLinks",
            "party",
            "gstInfo",
            "taxDeferredSkip",
            "productIssuerLink",
            "documentProfile",
            "advSettings",
            "passwordPolicy",
            "mailConfig",
            "dayEndPolicy",
            "monthlyLock",
            "settingsDeferredSkip",
          ];

          for (const task of taskOrder) {
            if (
              !selectedSet.has(task) &&
              !this.shouldRunImplicitTask(task, selectedSet)
            ) {
              continue;
            }

            switch (task) {
              case "company":
                await this.processCompanies(pools.master, context);
                break;
              case "country":
                await this.processCountries(pools.master, context);
                break;
              case "state":
                await this.processStates(pools.master, context);
                break;
              case "locationType":
                await this.processLocationTypes(pools.master, context);
                break;
              case "currency":
                await this.processCurrencies(pools.master, context);
                break;
              case "financialCode":
                await this.processFinancialCodes(pools.master, context);
                break;
              case "account":
                await this.processAccounts(pools.master, context);
                break;
              case "product":
                await this.processProducts(pools.master, context);
                break;
              case "currencyProductLink":
                await this.processCurrencyProductLinks(pools.master, context);
                break;
              case "mstRate":
                await this.processMstRates(pools.master, context);
                break;
              case "marginMaster":
                await this.processMarginMaster(pools.master, context);
                break;
              case "tickerRate":
                await this.processTickerRates(pools.master, context);
                break;
              case "rateDeferredSkip":
                await this.processRateDeferredSkips(pools.master, context);
                break;
              case "purpose":
                await this.processPurposes(pools.master, context);
                break;
              case "purposeDeferredSkip":
                await this.processPurposeDeferredSkips(pools.master, context);
                break;
              case "branch":
                await this.ensureLegacyPlaceLookups(pools.master, context);
                await this.processBranches(sourcePool, context);
                break;
              case "counter":
                await this.processCounters(sourcePool, context);
                break;
              case "user":
              case "role":
                await this.processUsers(sourcePool, context);
                break;
              case "branchCounterLinks":
                await this.processBranchCounterLinks(sourcePool, context);
                break;
              case "branchUserLinks":
                await this.processBranchUserLinks(sourcePool, context);
                break;
              case "counterUserLinks":
                await this.processCounterUserLinks(sourcePool, context);
                break;
              case "userRoleLinks":
                break;
              case "party":
                await this.ensureLegacyPlaceLookups(pools.master, context);
                await this.processPartyProfiles(pools.master, context);
                break;
              case "productIssuerLink":
                await this.processProductIssuerLinks(pools.master, context);
                break;
              case "advSettings":
                await this.processAdvSettings(pools.master, context);
                break;
              case "passwordPolicy":
                await this.processPasswordPolicy(pools.master, context);
                break;
              case "mailConfig":
                await this.processMailConfig(pools.master, context);
                break;
              case "documentProfile":
                await this.processDocumentProfiles(pools.master, context);
                break;
              case "monthlyLock":
                await this.processMonthlyLocks(pools.master, context);
                break;
              case "dayEndPolicy":
                await this.processDayEndPolicy(pools.master, context);
                break;
              case "settingsDeferredSkip":
                await this.processSettingsDeferredSkips(pools.master, context);
                break;
              case "gstInfo":
                await this.processGstInfo(pools.master, context);
                break;
              case "tcsPerMaster":
                await this.processTcsPerMaster(pools.master, context);
                break;
              case "gstRate":
                await this.processMstTaxGstRate(pools.master, context);
                break;
              case "taxDeferredSkip":
                await this.processTaxDeferredSkips(pools.master, context);
                break;
            }
          }

          await this.flushUserRoleAssignments(context);
          context.summary.tables = context.tableResults.length;
        });
      });

      const workbook = this.buildWorkbook(context);
      const buffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      }) as Buffer;
      const suffix = mode === "mock" ? "mock" : "real";
      const filename = `migration-${suffix === "mock" ? "soft-run" : suffix}-${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
      this.logger.log(
        `Migration run finished mode=${mode} rowsScanned=${context.summary.rowsScanned} rowsInserted=${context.summary.rowsInserted} rowsSkipped=${context.summary.rowsSkipped} rowsFailed=${context.summary.rowsFailed} filename=${filename}`,
      );

      return { filename, buffer, summary: context.summary };
    } finally {
      this.logger.log(`Migration context cleared for mode=${mode}`);
      this.activeContext = null;
    }
  }


  private async ensureAdvancedSettingCategory(
    context: MigrationContext,
    code: string,
    label: string,
  ): Promise<AdvancedSetting> {
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;
    let category = await this.targetAdvancedSettingRepository.findOne({
      where: { code, nodeType: NodeType.Category },
    });
    if (category) {
      return category;
    }
    if (context.mode !== "real") {
      return {
        id: `mock-setting-cat-${code}`,
        code,
        label,
        nodeType: NodeType.Category,
      } as AdvancedSetting;
    }
    category = await this.targetAdvancedSettingRepository.save(
      this.targetAdvancedSettingRepository.create({
        code,
        label,
        description: `Migrated category ${code}`,
        nodeType: NodeType.Category,
        sortOrder: 0,
        isActive: true,
        createdBy: actorId,
        updatedBy: actorId,
      }),
    );
    return category;
  }

  private async upsertAdvancedSettingChild(
    context: MigrationContext,
    params: {
      parent: AdvancedSetting;
      code: string;
      label: string;
      valueType: ValueType;
      valueBoolean?: boolean | null;
      valueNumber?: number | null;
      valueDecimal?: number | null;
      valueDate?: Date | null;
      valueText?: string | null;
      description?: string | null;
    },
  ): Promise<{ id: string; created: boolean }> {
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;
    let setting = await this.targetAdvancedSettingRepository.findOne({
      where: { code: params.code, nodeType: NodeType.Setting },
    });
    if (context.mode !== "real") {
      return {
        id: setting?.id ?? `mock-setting-${params.code}`,
        created: !setting,
      };
    }
    if (setting) {
      setting.label = params.label;
      setting.parentId = params.parent.id;
      setting.valueType = params.valueType;
      setting.valueBoolean = params.valueBoolean ?? null;
      setting.valueNumber = params.valueNumber ?? null;
      setting.valueDecimal = params.valueDecimal ?? null;
      setting.valueDate = params.valueDate ?? null;
      setting.valueText = params.valueText ?? null;
      setting.description = params.description ?? setting.description;
      setting.isActive = true;
      setting.updatedBy = actorId;
      await this.targetAdvancedSettingRepository.save(setting);
      return { id: setting.id, created: false };
    }
    setting = await this.targetAdvancedSettingRepository.save(
      this.targetAdvancedSettingRepository.create({
        code: params.code,
        label: params.label,
        description: params.description ?? null,
        nodeType: NodeType.Setting,
        valueType: params.valueType,
        valueBoolean: params.valueBoolean ?? null,
        valueNumber: params.valueNumber ?? null,
        valueDecimal: params.valueDecimal ?? null,
        valueDate: params.valueDate ?? null,
        valueText: params.valueText ?? null,
        parentId: params.parent.id,
        sortOrder: 0,
        isActive: true,
        createdBy: actorId,
        updatedBy: actorId,
      }),
    );
    return { id: setting.id, created: true };
  }

  /** Lookup-only entity resolve for advsettings values (W7-9); miss → text. */
  private resolveAdvSettingEntityUuid(
    raw: string,
  ): { uuid: string; master: string } | null {
    const code = raw.trim();
    const upper = code.toUpperCase();
    const accountId = this.accountCodeMap.get(code) ?? this.accountCodeMap.get(upper);
    if (accountId && !accountId.startsWith("mock-")) {
      return { uuid: accountId, master: "account_profiles" };
    }
    const productId =
      this.productCodeMap.get(code) ?? this.productCodeMap.get(upper);
    if (productId && !productId.startsWith("mock-")) {
      return { uuid: productId, master: "products" };
    }
    const currencyId =
      this.currencyMap.get(code) ?? this.currencyMap.get(upper);
    if (currencyId && !currencyId.startsWith("mock-")) {
      return { uuid: currencyId, master: "currencies" };
    }
    const branchId = this.branchMap.get(code) ?? this.branchMap.get(upper);
    if (branchId && !branchId.startsWith("mock-")) {
      return { uuid: branchId, master: "branches" };
    }
    const partyId =
      this.partyCodeMap.get(code) ?? this.partyCodeMap.get(upper);
    if (partyId && !partyId.startsWith("mock-")) {
      return { uuid: partyId, master: "party_profiles" };
    }
    const userId = this.userMap.get(code) ?? this.userMap.get(upper);
    if (userId && !userId.startsWith("mock-")) {
      return { uuid: userId, master: "users" };
    }
    return null;
  }

  private async processAdvSettings(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "advSettings")) {
      return;
    }
    this.logger.log(`[advsettings] migration started mode=${context.mode}`);
    const { tableName, rows } = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_SETTINGS_TABLE_CANDIDATES.advsettings,
    );
    this.ensureSourceRows(context, "advSettings", rows);
    const { kept, skippedDuplicates } = collapseAdvSettingsByDataCode(rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const dup of skippedDuplicates) {
      skipped += 1;
      this.addSkippedRow(context, {
        sourceTable: tableName,
        sourceRowIdentifier: `${dup.dataCode}#${dup.id}`,
        reason: `${dup.reason}; lostValue=${dup.lostDataValue ?? ""}`,
        fallbackAction: "First DATACODE wins",
      });
    }

    const categoryCache = new Map<string, AdvancedSetting>();

    for (const item of kept) {
      context.summary.rowsScanned += 1;
      const sourceRow = item.row;
      const dataCode = item.dataCode;
      const sourceId = item.id;
      try {
        if (isPasswordPolicyChildCode(dataCode)) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            sourceRowIdentifier: dataCode,
            reason:
              "Reserved PASSWORD_* code — owned by mstPasswordPolicy (W7-12)",
            fallbackAction: "Skipped advsettings write to PASSWORD_*",
          });
          continue;
        }

        const categoryRaw =
          sourceRow.SETTINGCATEGORY ??
          sourceRow.SettingCategory ??
          sourceRow.settingcategory ??
          null;
        const categoryCode =
          normalizeSettingCategoryCode(categoryRaw) ?? "GENERAL_OPTIONS";
        const label =
          String(
            sourceRow.DATADISPLAY ??
              sourceRow.DataDisplay ??
              sourceRow.datadisplay ??
              dataCode,
          ).trim() || dataCode;
        const dataValueRaw =
          sourceRow.DATAVALUE ?? sourceRow.DataValue ?? sourceRow.datavalue;
        const nBranchId =
          sourceRow.nBranchID ?? sourceRow.NBRANCHID ?? sourceRow.nbranchid;
        const inferred = inferAdvSettingValue(dataValueRaw);

        let category = categoryCache.get(categoryCode);
        if (!category) {
          category = await this.ensureAdvancedSettingCategory(
            context,
            categoryCode,
            categoryRaw ? String(categoryRaw) : categoryCode,
          );
          categoryCache.set(categoryCode, category);
        }

        let valueType = ValueType.Text;
        let valueBoolean: boolean | null = null;
        let valueNumber: number | null = null;
        let valueDecimal: number | null = null;
        let valueDate: Date | null = null;
        let valueText: string | null = inferred.valueText ?? null;

        if (inferred.valueType === "boolean") {
          valueType = ValueType.Boolean;
          valueBoolean = inferred.valueBoolean ?? null;
        } else if (inferred.valueType === "number") {
          valueType = ValueType.Number;
          valueNumber = inferred.valueNumber ?? null;
        } else if (inferred.valueType === "decimal") {
          valueType = ValueType.Decimal;
          valueDecimal = inferred.valueDecimal ?? null;
        } else if (inferred.valueType === "date") {
          valueType = ValueType.Date;
          valueDate = inferred.valueDate ?? null;
        } else if (inferred.looksLikeEntityRef && inferred.valueText) {
          const resolved = this.resolveAdvSettingEntityUuid(inferred.valueText);
          if (resolved) {
            valueType = ValueType.Select;
            valueText = resolved.uuid;
            this.addWarning(context, {
              sourceTable: tableName,
              note: `${dataCode} value ${inferred.valueText} → ${resolved.master} ${resolved.uuid}`,
            });
          } else {
            valueType = ValueType.Text;
            valueText = inferred.valueText;
            this.addWarning(context, {
              sourceTable: tableName,
              note: `${dataCode} entity-like value ${inferred.valueText} not resolved — stored as text`,
            });
          }
        }

        const result = await this.upsertAdvancedSettingChild(context, {
          parent: category,
          code: dataCode,
          label,
          valueType,
          valueBoolean,
          valueNumber,
          valueDecimal,
          valueDate,
          valueText,
          description: `Migrated from advsettings ID=${sourceId} nBranchID=${nBranchId ?? ""}`,
        });
        inserted += 1;
        context.summary.rowsInserted += 1;
        this.addIdMap(context, {
          oldTable: tableName,
          oldId: sourceId,
          newTable: "advanced_settings",
          newUuid: result.id,
          lookupKey: `setting:${dataCode}`,
        });
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: tableName,
          sourceRowIdentifier: dataCode,
          fieldName: "advsettings",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    context.tableResults.push({
      sourceTable: tableName,
      targetTable: "advanced_settings",
      scanned: rows.length,
      inserted,
      skipped,
      failed,
      note: "All nBranchID kept; first DATACODE wins; entity resolve → select UUID else text",
    });
  }

  private async processPasswordPolicy(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "passwordPolicy")) {
      return;
    }
    this.logger.log(`[mstPasswordPolicy] migration started mode=${context.mode}`);
    const { tableName, rows } = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_SETTINGS_TABLE_CANDIDATES.mstPasswordPolicy,
    );
    this.ensureSourceRows(context, "passwordPolicy", rows);
    if (rows.length === 0) {
      context.tableResults.push({
        sourceTable: tableName,
        targetTable: "advanced_settings",
        scanned: 0,
        inserted: 0,
        skipped: 0,
        failed: 0,
        note: "No mstPasswordPolicy rows",
      });
      return;
    }

    const mapped = mapPasswordPolicyRow(rows[0]);
    context.summary.rowsScanned += 1;
    for (const field of mapped.unmapped) {
      this.addFieldStatus(context, {
        sourceTable: tableName,
        sourceColumn: field.sourceColumn,
        sourceValue: field.sourceValue,
        status: "unmapped",
        note: field.reason,
      });
    }

    const category = await this.ensureAdvancedSettingCategory(
      context,
      PASSWORD_POLICY_CATEGORY_CODE,
      "PASSWORD POLICY",
    );

    const children: Array<{
      code: string;
      label: string;
      value: number;
    }> = [
      {
        code: PasswordPolicyCodeEnum.MinLength,
        label: "PASSWORD MIN LENGTH",
        value: mapped.minLength ?? 8,
      },
      {
        code: PasswordPolicyCodeEnum.MaxLength,
        label: "PASSWORD MAX LENGTH",
        value: mapped.maxLength,
      },
      {
        code: PasswordPolicyCodeEnum.MinAlphaCount,
        label: "PASSWORD MIN ALPHA CHAR COUNT",
        value: mapped.minAlpha ?? 0,
      },
      {
        code: PasswordPolicyCodeEnum.MinNumericCount,
        label: "PASSWORD MIN NUMERIC CHAR COUNT",
        value: mapped.minNumeric ?? 0,
      },
      {
        code: PasswordPolicyCodeEnum.MinSpecialCharCount,
        label: "PASSWORD MIN SPECIAL CHAR COUNT",
        value: mapped.minSpecial ?? 0,
      },
    ];

    let inserted = 0;
    for (const child of children) {
      await this.upsertAdvancedSettingChild(context, {
        parent: category,
        code: child.code,
        label: child.label,
        valueType: ValueType.Number,
        valueNumber: child.value,
        description: `Migrated from mstPasswordPolicy (max default ${PASSWORD_POLICY_MAX_LENGTH_DEFAULT})`,
      });
      inserted += 1;
      context.summary.rowsInserted += 1;
    }

    this.addWarning(context, {
      sourceTable: tableName,
      note: "mstPasswordPolicy wins over advsettings PWD* for PASSWORD_* (CQ-wave7)",
    });

    context.tableResults.push({
      sourceTable: tableName,
      targetTable: "advanced_settings",
      scanned: rows.length,
      inserted,
      skipped: 0,
      failed: 0,
      note: "PASSWORD_POLICY children; maxLength default 128; nExpDate logged",
    });
  }

  private async processMailConfig(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "mailConfig")) {
      return;
    }
    this.logger.log(`[MailConfig] migration started mode=${context.mode}`);
    const { tableName, rows } = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_SETTINGS_TABLE_CANDIDATES.mailConfig,
    );
    this.ensureSourceRows(context, "mailConfig", rows);
    const secret =
      process.env.SESSION_SECRET?.trim() || "migration-mail-dummy-secret";
    const encryption = new EncryptionUtil(secret);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const mapped = mapMailConfigRow(row);
      try {
        if (mapped.skipReason || !mapped.username || !mapped.host || mapped.port == null) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            sourceRowIdentifier: mapped.oldId ?? mapped.username ?? "?",
            reason: mapped.skipReason ?? "Missing username/host/port",
            fallbackAction: "Skipped MailConfig row",
          });
          continue;
        }
        const mailUsername = mapped.username;
        const mailHost = mapped.host;
        const mailPort = mapped.port;
        for (const field of mapped.unmapped) {
          this.addFieldStatus(context, {
            sourceTable: tableName,
            sourceColumn: field.sourceColumn,
            sourceValue: field.sourceValue,
            status: "unmapped",
            note: field.reason,
          });
        }
        if (
          mapped.unmapped.some((field) => field.sourceColumn === "vSmtpPassword")
        ) {
          this.addWarning(context, {
            sourceTable: tableName,
            note: `MailConfig ${mailUsername}: source password NOT migrated; dummy set for reset`,
          });
        }
        const encrypted = encryption.encrypt(MAIL_PASSWORD_DUMMY_PLAINTEXT);
        if (context.mode === "real") {
          const existing = await this.targetMailConfigRepository.findOne({
            where: { username: mailUsername },
          });
          if (existing) {
            existing.host = mailHost;
            existing.port = mailPort;
            existing.password = encrypted;
            existing.senderEmail = mapped.senderEmail ?? undefined;
            await this.targetMailConfigRepository.save(existing);
          } else {
            await this.targetMailConfigRepository.save(
              this.targetMailConfigRepository.create({
                username: mailUsername,
                host: mailHost,
                port: mailPort,
                password: encrypted,
                senderEmail: mapped.senderEmail ?? undefined,
              }),
            );
          }
        }
        inserted += 1;
        context.summary.rowsInserted += 1;
        this.addIdMap(context, {
          oldTable: tableName,
          oldId: mapped.oldId ?? mapped.username,
          newTable: "mail_configurations",
          newUuid: mailUsername,
          lookupKey: `mail:${mailUsername}`,
        });
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: tableName,
          sourceRowIdentifier: mapped.username ?? mapped.oldId ?? "?",
          fieldName: "MailConfig",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    context.tableResults.push({
      sourceTable: tableName,
      targetTable: "mail_configurations",
      scanned: rows.length,
      inserted,
      skipped,
      failed,
      note: "Dummy encrypted password MIGRATE_RESET; never copy source SMTP secrets",
    });
  }

  private async processDocumentProfiles(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "documentProfile")) {
      return;
    }
    this.logger.log(`[ScanDocMaster] migration started mode=${context.mode}`);
    const { tableName, rows } = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_DOCUMENT_TABLE_CANDIDATES.scanDocMaster,
    );
    this.ensureSourceRows(context, "documentProfile", rows);
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;
    const usedCodes = new Set<string>();
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const mapped = mapScanDocMasterRow(row);
      try {
        if (mapped.skipReason) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            sourceRowIdentifier: mapped.oldId ?? mapped.documentCode,
            reason: mapped.skipReason,
            fallbackAction: "Skipped ScanDocMaster row",
          });
          continue;
        }
        for (const field of mapped.unmapped) {
          this.addFieldStatus(context, {
            sourceTable: tableName,
            sourceColumn: field.sourceColumn,
            sourceValue: field.sourceValue,
            status: "unmapped",
            note: field.reason,
          });
        }

        if (!mapped.documentCode) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            sourceRowIdentifier: mapped.oldId ?? "?",
            reason: "Missing vDocumentCode",
            fallbackAction: "Skipped ScanDocMaster row",
          });
          continue;
        }
        const finalCode = disambiguateDocumentCode(
          mapped.documentCode,
          mapped.uniqCode ?? mapped.oldId ?? "X",
          usedCodes,
        );
        if (finalCode !== mapped.documentCode) {
          this.addWarning(context, {
            sourceTable: tableName,
            note: `documentCode clash ${mapped.documentCode} → ${finalCode}`,
          });
        }
        usedCodes.add(finalCode);

        const typeCategory =
          mapped.specificationType === "MASTER"
            ? CategoryOptionCodeEnum.MasterDocument
            : CategoryOptionCodeEnum.TransactionDocument;
        const typeOption = await this.ensureCategoryOption(
          context,
          typeCategory,
          mapped.specificationType!,
          mapped.specificationType!,
        );
        const groupOption = mapped.groupCode
          ? await this.ensureCategoryOption(
              context,
              CategoryOptionCodeEnum.DocumentGroup,
              mapped.groupCode,
              mapped.groupCode,
            )
          : null;
        const entityOption = mapped.entityCode
          ? await this.ensureCategoryOption(
              context,
              CategoryOptionCodeEnum.EntityType,
              mapped.entityCode,
              mapped.entityCode,
            )
          : null;
        const fyOption = mapped.financialYearCode
          ? await this.ensureCategoryOption(
              context,
              CategoryOptionCodeEnum.FinancialYear,
              mapped.financialYearCode,
              mapped.financialYearCode,
            )
          : null;

        if (!typeOption) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            sourceRowIdentifier: finalCode,
            reason: "Could not ensure type category option",
            fallbackAction: "Skipped",
          });
          continue;
        }
        if (!groupOption || !entityOption) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            sourceRowIdentifier: finalCode,
            reason: "Missing KYCGroup or vScanType for required FKs",
            fallbackAction: "Skipped",
          });
          continue;
        }

        if (context.mode === "real") {
          let existing = await this.targetDocumentProfileRepository.findOne({
            where: { documentCode: finalCode },
            withDeleted: true,
          });
          if (existing) {
            existing.documentDescription = mapped.description;
            existing.documentType = mapped.documentType;
            existing.isRequired = mapped.isRequired;
            existing.maxSizeMb = mapped.maxSizeMb;
            existing.specificationType =
              mapped.specificationType as DocumentSpecificationType;
            existing.type = typeOption;
            existing.groupSelection = groupOption;
            existing.entitySelection = entityOption;
            existing.financialYearSelection = fyOption;
            existing.active = mapped.active;
            existing.sortOrder = mapped.sortOrder;
            existing.updatedBy = actorId;
            if (mapped.isDeleted) {
              existing.deletedAt = existing.deletedAt ?? new Date();
              existing.deletedBy = actorId;
            } else {
              existing.deletedAt = null;
              existing.deletedBy = null;
            }
            await this.targetDocumentProfileRepository.save(existing);
            this.addIdMap(context, {
              oldTable: tableName,
              oldId: mapped.oldId ?? finalCode,
              newTable: "document_profiles",
              newUuid: existing.id,
              lookupKey: `document:${finalCode}`,
            });
          } else {
            const created = this.targetDocumentProfileRepository.create({
              documentCode: finalCode,
              documentDescription: mapped.description,
              documentType: mapped.documentType,
              isRequired: mapped.isRequired,
              maxSizeMb: mapped.maxSizeMb,
              specificationType:
                mapped.specificationType as DocumentSpecificationType,
              type: typeOption,
              groupSelection: groupOption,
              entitySelection: entityOption,
              financialYearSelection: fyOption,
              active: mapped.active,
              sortOrder: mapped.sortOrder,
              createdBy: actorId,
              updatedBy: actorId,
              deletedAt: mapped.isDeleted ? new Date() : null,
              deletedBy: mapped.isDeleted ? actorId : null,
            } as DocumentProfile);
            const saved = await this.targetDocumentProfileRepository.save(
              created,
            );
            this.addIdMap(context, {
              oldTable: tableName,
              oldId: mapped.oldId ?? finalCode,
              newTable: "document_profiles",
              newUuid: saved.id,
              lookupKey: `document:${finalCode}`,
            });
          }
        } else {
          this.addIdMap(context, {
            oldTable: tableName,
            oldId: mapped.oldId ?? finalCode,
            newTable: "document_profiles",
            newUuid: `mock-doc-${finalCode}`,
            lookupKey: `document:${finalCode}`,
          });
        }
        inserted += 1;
        context.summary.rowsInserted += 1;
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: tableName,
          sourceRowIdentifier: mapped.oldId ?? mapped.documentCode,
          fieldName: "ScanDocMaster",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    context.tableResults.push({
      sourceTable: tableName,
      targetTable: "document_profiles",
      scanned: rows.length,
      inserted,
      skipped,
      failed,
      note: "M/T→MASTER/TRANSACTION; maxSizeMb=5; clash {code}-{nUniqCode}",
    });
  }

  private async processMonthlyLocks(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "monthlyLock")) {
      return;
    }
    this.logger.log(`[monthlock] migration started mode=${context.mode}`);
    const locksSource = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_LOCK_TABLE_CANDIDATES.monthlock,
    );
    const linksSource = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_LOCK_TABLE_CANDIDATES.mLockBrnUserLink,
    );
    this.ensureSourceRows(context, "monthlyLock", locksSource.rows);

    const mappedLocks = locksSource.rows.map((row) =>
      mapMonthLockRow(row),
    );
    const { selected, skipped: skippedLocks } =
      pickFirstMonthLockPerBranch(mappedLocks);
    const lockByBranch = new Map(
      selected.map((lock) => [lock.branchCode!.toUpperCase(), lock]),
    );

    for (const skip of skippedLocks) {
      this.addSkippedRow(context, {
        sourceTable: locksSource.tableName,
        sourceRowIdentifier: String(skip.row.oldId ?? "?"),
        reason: skip.reason,
        fallbackAction: "Skipped extra monthlock",
      });
    }

    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;

    for (const linkRow of linksSource.rows) {
      context.summary.rowsScanned += 1;
      const link = mapMLockBrnUserLinkRow(linkRow);
      try {
        if (link.skipReason) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: linksSource.tableName,
            sourceRowIdentifier: String(link.oldId ?? link.userId),
            reason: link.skipReason,
            fallbackAction: "Skipped link",
          });
          continue;
        }
        const branchKey = (link.branchCode ?? "").toUpperCase();
        const lock = lockByBranch.get(branchKey);
        if (!lock) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: linksSource.tableName,
            sourceRowIdentifier: String(link.oldId ?? link.userId),
            reason: `No first monthlock for branch ${branchKey}`,
            fallbackAction: "Skipped link",
          });
          continue;
        }
        for (const field of lock.unmapped) {
          this.addFieldStatus(context, {
            sourceTable: locksSource.tableName,
            sourceColumn: field.sourceColumn,
            sourceValue: field.sourceValue,
            status: "unmapped",
            note: field.reason,
          });
        }

        const branchId =
          (link.branchCode
            ? this.branchMap.get(link.branchCode) ??
              this.branchMap.get(link.branchCode.toUpperCase())
            : null) ??
          (link.branchId != null
            ? this.branchMap.get(String(link.branchId))
            : null);
        const userId =
          link.userId != null
            ? this.userMap.get(String(link.userId))
            : null;

        if (!branchId || !userId || branchId.startsWith("mock-") || userId.startsWith("mock-")) {
          if (context.mode === "real") {
            skipped += 1;
            this.addSkippedRow(context, {
              sourceTable: linksSource.tableName,
              sourceRowIdentifier: String(link.oldId ?? link.userId),
              reason: "Branch or user UUID not resolved",
              fallbackAction: "Skipped — run branch/user first",
            });
            continue;
          }
        }

        const resolvedBranchId = branchId ?? `mock-branch-${branchKey}`;
        const resolvedUserId = userId ?? `mock-user-${link.userId}`;
        const softDeleted = lock.isDeleted || link.isDeleted;

        if (context.mode === "real") {
          let existing = await this.targetMonthlyLockWindowRepository.findOne({
            where: {
              branchId: resolvedBranchId,
              userId: resolvedUserId,
            },
            withDeleted: true,
            order: { createdAt: "DESC" },
          });
          if (existing) {
            existing.fromDate = lock.fromDate!;
            existing.toDate = lock.toDate!;
            existing.isActive = link.isActive && !softDeleted;
            existing.updatedBy = actorId;
            if (softDeleted) {
              existing.deletedAt = existing.deletedAt ?? new Date();
              existing.deletedBy = actorId;
              existing.isActive = false;
            } else {
              existing.deletedAt = null;
              existing.deletedBy = null;
              existing.revokedAt = null;
              existing.revokedBy = null;
            }
            await this.targetMonthlyLockWindowRepository.save(existing);
            this.addIdMap(context, {
              oldTable: linksSource.tableName,
              oldId: link.oldId ?? `${branchKey}:${link.userId}`,
              newTable: "monthly_lock_windows",
              newUuid: existing.id,
              lookupKey: `monthly-lock:${resolvedBranchId}:${resolvedUserId}`,
            });
          } else {
            const created = this.targetMonthlyLockWindowRepository.create({
              branchId: resolvedBranchId,
              userId: resolvedUserId,
              fromDate: lock.fromDate!,
              toDate: lock.toDate!,
              isActive: link.isActive && !softDeleted,
              createdBy: actorId,
              updatedBy: actorId,
              deletedAt: softDeleted ? new Date() : null,
              deletedBy: softDeleted ? actorId : null,
              revokedAt: null,
              revokedBy: null,
            } as MonthlyLockWindow);
            const saved =
              await this.targetMonthlyLockWindowRepository.save(created);
            this.addIdMap(context, {
              oldTable: linksSource.tableName,
              oldId: link.oldId ?? `${branchKey}:${link.userId}`,
              newTable: "monthly_lock_windows",
              newUuid: saved.id,
              lookupKey: `monthly-lock:${resolvedBranchId}:${resolvedUserId}`,
            });
          }
        } else {
          this.addIdMap(context, {
            oldTable: linksSource.tableName,
            oldId: link.oldId ?? `${branchKey}:${link.userId}`,
            newTable: "monthly_lock_windows",
            newUuid: `mock-mlock-${branchKey}-${link.userId}`,
            lookupKey: `monthly-lock:${resolvedBranchId}:${resolvedUserId}`,
          });
        }
        inserted += 1;
        context.summary.rowsInserted += 1;
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: linksSource.tableName,
          sourceRowIdentifier: String(link.oldId ?? link.userId),
          fieldName: "MLockBrnUserLink",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    context.summary.rowsSkipped += skipped + skippedLocks.length;
    context.summary.rowsFailed += failed;
    context.tableResults.push({
      sourceTable: locksSource.tableName,
      targetTable: "monthly_lock_windows",
      scanned: locksSource.rows.length + linksSource.rows.length,
      inserted,
      skipped: skipped + skippedLocks.length,
      failed,
      note: "DB2; first lock/branch; soft-deleted kept; OPEN* CQ-wave7",
    });
  }

  private async processDayEndPolicy(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "dayEndPolicy")) {
      return;
    }
    this.logger.log(`[tb_EODQuestion] migration started mode=${context.mode}`);
    const { tableName, rows } = await this.readSourceRowsFromCandidates(
      pool,
      LEGACY_SETTINGS_TABLE_CANDIDATES.tbEodQuestion,
    );
    this.ensureSourceRows(context, "dayEndPolicy", rows);
    const category = await this.ensureAdvancedSettingCategory(
      context,
      DAY_END_POLICY_CATEGORY_CODE,
      "DAY END POLICY",
    );
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const mapped = mapEodQuestionRow(row);
      try {
        if (mapped.skipReason) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            sourceRowIdentifier: mapped.oldId ?? "?",
            reason: mapped.skipReason,
            fallbackAction: "Skipped EOD question",
          });
          continue;
        }
        if (!mapped.code || !mapped.label) {
          skipped += 1;
          this.addSkippedRow(context, {
            sourceTable: tableName,
            sourceRowIdentifier: mapped.oldId ?? "?",
            reason: "Missing EOD code or label",
            fallbackAction: "Skipped EOD question",
          });
          continue;
        }
        await this.upsertAdvancedSettingChild(context, {
          parent: category,
          code: mapped.code,
          label: mapped.label,
          valueType: ValueType.Boolean,
          valueBoolean: false,
          description: "Migrated from tb_EODQuestion",
        });
        if (context.mode === "real") {
          const setting = await this.targetAdvancedSettingRepository.findOne({
            where: { code: mapped.code, nodeType: NodeType.Setting },
          });
          if (setting) {
            setting.isActive = mapped.active;
            await this.targetAdvancedSettingRepository.save(setting);
          }
        }
        inserted += 1;
        context.summary.rowsInserted += 1;
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: tableName,
          sourceRowIdentifier: mapped.oldId ?? mapped.code,
          fieldName: "tb_EODQuestion",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    context.tableResults.push({
      sourceTable: tableName,
      targetTable: "advanced_settings",
      scanned: rows.length,
      inserted,
      skipped,
      failed,
      note: "DAY_END_POLICY children for BOD/EOD checklist",
    });
  }

  private async processSettingsDeferredSkips(
    _pool: mssql.ConnectionPool,
    context: MigrationContext,
  ): Promise<void> {
    if (!this.isTaskIncluded(context, "settingsDeferredSkip")) {
      return;
    }
    this.logger.log(
      `[settingsDeferredSkip] logging deferred Wave 7 tables mode=${context.mode}`,
    );
    const selectedLower = new Set(
      context.selectedTables.map((table) => table.toLowerCase()),
    );
    for (const entry of SETTINGS_MIGRATION_SKIPPED_TABLES) {
      if (!selectedLower.has(entry.table.toLowerCase())) {
        continue;
      }
      this.addSkippedRow(context, {
        sourceTable: entry.table,
        sourceRowIdentifier: entry.table,
        reason: entry.reason,
        fallbackAction: "Deferred / CQ / txn-later / skip as documented",
      });
      this.addWarning(context, {
        sourceTable: entry.table,
        note: entry.reason,
      });
      context.tableResults.push({
        sourceTable: entry.table,
        targetTable: "(deferred)",
        scanned: 0,
        inserted: 0,
        skipped: 1,
        failed: 0,
        note: entry.reason,
      });
    }
  }

  private shouldRunImplicitTask(
    task: InternalTask,
    selectedSet: Set<string>,
  ): boolean {
    // If any selected table implies this task, allow it to run.
    if (
      task === "company" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("company"),
      )
    )
      return true;
    if (
      task === "country" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("country"),
      )
    )
      return true;
    if (
      task === "state" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("state"),
      )
    )
      return true;
    if (
      task === "locationType" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("locationType"),
      )
    )
      return true;
    if (
      task === "currency" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("currency"),
      )
    )
      return true;
    if (
      task === "financialCode" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("financialCode"),
      )
    )
      return true;
    if (
      task === "account" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("account"),
      )
    )
      return true;
    if (
      task === "product" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("product"),
      )
    )
      return true;
    if (
      task === "currencyProductLink" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("currencyProductLink"),
      )
    )
      return true;
    if (
      task === "branch" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("branch"),
      )
    )
      return true;
    if (
      task === "counter" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("counter"),
      )
    )
      return true;
    if (
      task === "user" &&
      [...selectedSet].some((sel) => TABLE_DEPENDENCIES[sel]?.includes("user"))
    )
      return true;
    if (
      task === "role" &&
      [...selectedSet].some((sel) => TABLE_DEPENDENCIES[sel]?.includes("role"))
    )
      return true;
    if (
      task === "branchCounterLinks" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("branchCounterLinks"),
      )
    )
      return true;
    if (
      task === "branchUserLinks" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("branchUserLinks"),
      )
    )
      return true;
    if (
      task === "counterUserLinks" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("counterUserLinks"),
      )
    )
      return true;
    if (
      task === "userRoleLinks" &&
      [...selectedSet].some((sel) =>
        TABLE_DEPENDENCIES[sel]?.includes("userRoleLinks"),
      )
    )
      return true;
    return false;
  }
}
