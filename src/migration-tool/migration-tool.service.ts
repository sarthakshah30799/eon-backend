import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as mssql from 'mssql';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import { createHash, randomUUID } from 'crypto';
import { DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import {
  MigrationConnectionConfigDto,
  MigrationRunRequestDto,
} from './dto/migration-run-request.dto';
import { Company } from '../company/company.entity';
import { Branch } from '../branches/branch.entity';
import { Counter } from '../counters/counter.entity';
import { Menu } from '../menu/menu.entity';
import { Permission } from '../permissions/permission.entity';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../user-roles/user-role.entity';
import { RolesMenuPermission } from '../roles-menu-permission/roles-menu-permission.entity';
import { SelectOption } from '../category-options/category-option.entity';
import { Country } from '../country/country.entity';
import { CountryGroup } from '../country-groups/country-group.entity';
import { Currency } from '../currencies/currency.entity';
import { State } from '../state/state.entity';
import { normalizeMenuPath } from '../menu/menu-path.util';

type MigrationMode = 'mock' | 'real';
type SourceRow = Record<string, any>;

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
  | 'company'
  | 'currency'
  | 'branch'
  | 'counter'
  | 'user'
  | 'role'
  | 'userRoleLinks'
  | 'branchCounterLinks'
  | 'branchUserLinks'
  | 'counterUserLinks';

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
  currencyMap: Map<string, string>;
  branchMap: Map<string, string>;
  counterMap: Map<string, string>;
  userMap: Map<string, string>;
  roleMap: Map<string, string>;
  branchCounters: Map<string, string[]>;
  branchMainCounter: Map<string, string>;
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

const TEMP_INITIAL_PASSWORD = 'Temp@1234';

const TABLE_DEPENDENCIES: Record<string, InternalTask[]> = {
  company: ['company'],
  mstcompanyrecord: ['company'],
  currency: ['currency'],
  mcurrency: ['currency'],
  branches: ['company', 'branch'],
  mstcompany: ['company', 'branch'],
  counters: ['company', 'branch', 'counter', 'branchCounterLinks'],
  mstcounter: ['company', 'branch', 'counter', 'branchCounterLinks'],
  users: ['company', 'branch', 'counter', 'user', 'role', 'userRoleLinks', 'branchUserLinks', 'counterUserLinks', 'branchCounterLinks'],
  mstuser: ['company', 'branch', 'counter', 'user', 'role', 'userRoleLinks', 'branchUserLinks', 'counterUserLinks', 'branchCounterLinks'],
  roles: ['company', 'branch', 'counter', 'user', 'role', 'userRoleLinks', 'branchUserLinks', 'counterUserLinks', 'branchCounterLinks'],
  user_roles: ['company', 'branch', 'counter', 'user', 'role', 'userRoleLinks', 'branchUserLinks', 'counterUserLinks', 'branchCounterLinks'],
  'user-roles': ['company', 'branch', 'counter', 'user', 'role', 'userRoleLinks', 'branchUserLinks', 'counterUserLinks', 'branchCounterLinks'],
  'user-role': ['company', 'branch', 'counter', 'user', 'role', 'userRoleLinks', 'branchUserLinks', 'counterUserLinks', 'branchCounterLinks'],
  mstBranchCounterLink: ['company', 'branch', 'counter', 'branchCounterLinks'],
  mstBranchUserLink: ['company', 'branch', 'counter', 'user', 'role', 'branchUserLinks', 'userRoleLinks'],
  mstCounterUserLink: ['company', 'branch', 'counter', 'user', 'role', 'counterUserLinks', 'userRoleLinks'],
};

const toBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'y' || normalized === 'yes';
  }
  return false;
};

const toNullableString = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const toStringOrFallback = (value: any, fallback: string): string => {
  const resolved = toNullableString(value);
  return resolved ?? fallback;
};

const toNullableDate = (value: any): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toNullableNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

const escapeIdentifier = (value: string): string =>
  `[${value.replace(/]/g, ']]')}]`;

const normalizeCode = (value: string): string =>
  value.trim().replace(/\s+/g, '_').toUpperCase();

const normalizeMatchText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

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

  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.flatMap(item => splitLegacyTokens(item));
      }
      if (parsed && typeof parsed === 'object') {
        return Object.values(parsed).flatMap(item => splitLegacyTokens(item));
      }
      return splitLegacyTokens(parsed);
    } catch {
      // fall through to plain tokenization
    }
  }

  return text
    .split(/[^a-zA-Z0-9_\/.-]+/g)
    .map(token => token.trim())
    .filter(token => token.length > 0);
};

const legacyActionAliases: Array<{ code: string; aliases: string[] }> = [
  { code: 'add', aliases: ['add', 'create', 'insert', 'new'] },
  { code: 'modify', aliases: ['modify', 'update', 'edit', 'change', 'alter'] },
  { code: 'delete', aliases: ['delete', 'remove', 'del'] },
  { code: 'view', aliases: ['view', 'read', 'show', 'list', 'display'] },
  { code: 'export', aliases: ['export', 'download'] },
  { code: 'authorized', aliases: ['authorized', 'authorised', 'approve', 'approved', 'authorize'] },
  { code: 'rejected', aliases: ['rejected', 'reject', 'denied', 'deny'] },
];

const legacyPermissionActionSet = new Set(legacyActionAliases.flatMap(item => item.aliases.map(alias => normalizeMatchText(alias))));

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
  extraChildren?: Array<{ path: string; name: string; sortOrder?: number; isAdmin?: boolean }>;
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
  { routeType: 'corporate-client', label: 'Corporate Client' },
  { routeType: 'ffmc', label: 'FFMC' },
  { routeType: 'rf', label: 'RF' },
  { routeType: 'authorised-dealer', label: 'Authorised Dealer' },
  { routeType: 'rmc', label: 'RMC' },
  { routeType: 'franchise', label: 'Franchise' },
  { routeType: 'agent', label: 'Agent' },
  { routeType: 'foreign-correspondent', label: 'Foreign Correspondent' },
  { routeType: 'forex-correspondent', label: 'Forex Correspondent' },
  { routeType: 'marketing-executive', label: 'Marketing Executive' },
  { routeType: 'card-issuer-profile', label: 'Card Issuer' },
  { routeType: 'misc-supplier-profile', label: 'Misc Supplier' },
];

const buildPartyProfileMenuSeeds = (): MenuSeedDefinition[] =>
  PARTY_PROFILE_MENU_TYPES.map(({ routeType, label }, index) => ({
    path: `/party-profiles/${routeType}`,
    name: `${label} Profile`,
    parentPath: '/party-profiles',
    isAdmin: false,
    sortOrder: 20 + index,
  }));

const FRONTEND_MENU_SEEDS: MenuSeedDefinition[] = [
  { path: '/', name: 'Dashboard', parentPath: null, isAdmin: false, sortOrder: 0 },
  ...buildCrudMenuSeeds({
    basePath: '/users/list',
    name: 'Users',
    isAdmin: false,
    parentPath: null,
    createPath: '/users/create',
    editPath: '/users/edit/:id',
    detailPath: '/users/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/company-profile',
    name: 'Company Profile',
    isAdmin: true,
    createPath: '/admin/company-profile/create',
    editPath: '/admin/company-profile/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/branch-profile',
    name: 'Branch Profile',
    isAdmin: true,
    createPath: '/admin/branch-profile/create',
    editPath: '/admin/branch-profile/edit/:id',
  }),
  { path: '/review/branch-profile', name: 'Branch Review', parentPath: '/admin/branch-profile', isAdmin: true, sortOrder: 20 },
  ...buildCrudMenuSeeds({
    basePath: '/admin/counter-profile',
    name: 'Counter Profile',
    isAdmin: true,
    createPath: '/admin/counter-profile/create',
    editPath: '/admin/counter-profile/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/document-profile',
    name: 'Document Profile',
    isAdmin: true,
    createPath: '/admin/document-profile/create',
    editPath: '/admin/document-profile/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/miscellaneous-profile',
    name: 'Miscellaneous Profile',
    isAdmin: true,
    createPath: '/admin/miscellaneous-profile/create',
    editPath: '/admin/miscellaneous-profile/edit/:code',
  }),
  { path: '/admin/menu-management', name: 'Menu Management', parentPath: null, isAdmin: true, sortOrder: 40 },
  { path: '/reports', name: 'Reports', parentPath: null, isAdmin: false, sortOrder: 41 },
  { path: '/reports/:slug', name: 'Report Detail', parentPath: '/reports', isAdmin: false, sortOrder: 1 },
  ...buildCrudMenuSeeds({
    basePath: '/admin/manual-bill-books',
    name: 'Manual Bill Books',
    isAdmin: true,
    createPath: '/admin/manual-bill-books/create',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/manual-bill-books',
    name: 'Manual Bill Books',
    isAdmin: false,
    createPath: '/manual-bill-books/create',
    extraChildren: [
      { path: '/manual-bill-books/acknowledgement', name: 'Branch Acknowledgement', isAdmin: false, sortOrder: 52 },
      { path: '/manual-bill-books/allocation', name: 'Manager To Cashier Allocation', isAdmin: false, sortOrder: 53 },
      { path: '/manual-bill-books/dp-mapping', name: 'Manual Bill DP Mapping', isAdmin: false, sortOrder: 54 },
      { path: '/manual-bill-books/dp-unmapping', name: 'Manual Bill DP Unmapping', isAdmin: false, sortOrder: 55 },
      { path: '/manual-bill-books/delivery-persons', name: 'Delivery Person Management', isAdmin: false, sortOrder: 56 },
    ],
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/chequebooks',
    name: 'Cheque Books Admin',
    isAdmin: true,
    createPath: '/admin/chequebooks/create',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/cheque-books',
    name: 'Cheque Books',
    isAdmin: false,
    createPath: '/cheque-books/create',
    extraChildren: [
      { path: '/cheque-books/acknowledgement', name: 'Cheque Book Acknowledgement', isAdmin: false, sortOrder: 60 },
      { path: '/cheque-books/allocation', name: 'Cheque Book Allocation', isAdmin: false, sortOrder: 61 },
      { path: '/cheque-books/return', name: 'Cheque Book Return', isAdmin: false, sortOrder: 62 },
    ],
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/additional-settings',
    name: 'Additional Settings',
    isAdmin: true,
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/transaction-account-postings',
    name: 'Transaction Account Postings',
    isAdmin: true,
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/migrations',
    name: 'Migration Tool',
    isAdmin: true,
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/currency-rates',
    name: 'Currency Rates',
    isAdmin: true,
  }),
  ...buildCrudMenuSeeds({
    basePath: '/financial-profile',
    name: 'Financial Profile',
    isAdmin: false,
    createPath: '/financial-profile/create',
    editPath: '/financial-profile/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/accounts-profile',
    name: 'Accounts Profile',
    isAdmin: true,
    createPath: '/admin/accounts-profile/create',
    editPath: '/admin/accounts-profile/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/party-profiles',
    name: 'Party Profiles',
    isAdmin: false,
  }),
  ...buildPartyProfileMenuSeeds(),
  ...buildCrudMenuSeeds({
    basePath: '/ad1',
    name: 'AD1',
    isAdmin: false,
    createPath: '/ad1/create',
    editPath: '/ad1/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/purchase/:slug',
    name: 'Purchase',
    isAdmin: false,
    createPath: '/purchase/:slug/create',
    editPath: '/purchase/:slug/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/sale/:slug',
    name: 'Sale',
    isAdmin: false,
    createPath: '/sale/:slug/create',
    editPath: '/sale/:slug/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/country-profile',
    name: 'Country Profile',
    isAdmin: true,
    createPath: '/admin/country-profile/create',
    editPath: '/admin/country-profile/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/state-profile',
    name: 'State Profile',
    isAdmin: true,
    createPath: '/admin/state-profile/create',
    editPath: '/admin/state-profile/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/expense-booking',
    name: 'Expense Booking Master',
    isAdmin: false,
    createPath: '/expense-booking/create',
    editPath: '/expense-booking/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/income-booking',
    name: 'Income Booking Master',
    isAdmin: false,
    createPath: '/income-booking/create',
    editPath: '/income-booking/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/product-profile',
    name: 'Product Profile',
    isAdmin: true,
    createPath: '/admin/product-profile/create',
    editPath: '/admin/product-profile/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/currency-profile',
    name: 'Currency Profile',
    isAdmin: false,
    createPath: '/currency-profile/create',
    editPath: '/currency-profile/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/tds-profile',
    name: 'TDS Profile',
    isAdmin: true,
    createPath: '/admin/tds-profile/create',
    editPath: '/admin/tds-profile/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/master-pages',
    name: 'Page Builder',
    isAdmin: true,
  }),
  ...buildCrudMenuSeeds({
    basePath: '/user-profile',
    name: 'User Profile',
    isAdmin: false,
    createPath: '/user-profile/create',
    editPath: '/user-profile/edit/:id',
  }),
  ...buildCrudMenuSeeds({
    basePath: '/admin/user-role',
    name: 'User Role',
    isAdmin: true,
    createPath: '/admin/user-role/create',
    editPath: '/admin/user-role/edit/:id',
  }),
];

type ConnectionSlot = 'currentMaster' | 'currentTransaction' | 'oldMaster' | 'oldTransaction';

const MAX_WORKBOOK_CELL_LENGTH = 32000;

const sanitizeWorkbookValue = (value: any): any => {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > MAX_WORKBOOK_CELL_LENGTH
      ? `${value.slice(0, MAX_WORKBOOK_CELL_LENGTH - 20)}...[truncated]`
      : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value) || typeof value === 'object') {
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
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key, sanitizeWorkbookValue(value)]));

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
    @InjectDataSource('database2')
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

  private get currencyMap() {
    return this.activeContext?.currencyMap ?? new Map<string, string>();
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

  private get branchCounters() {
    return this.activeContext?.branchCounters ?? new Map<string, string[]>();
  }

  private get branchMainCounter() {
    return this.activeContext?.branchMainCounter ?? new Map<string, string>();
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

  private getConnectionProfiles(dto: MigrationRunRequestDto): Record<ConnectionSlot, MigrationConnectionConfigDto | undefined> {
    return {
      currentMaster: dto.currentMasterConnection,
      currentTransaction: dto.currentTransactionConnection,
      oldMaster: dto.oldMasterConnection,
      oldTransaction: dto.oldTransactionConnection,
    };
  }

  private connectionSummary(connection?: MigrationConnectionConfigDto | null): string {
    if (!connection) {
      return 'not provided';
    }

    if (connection.connectionMode === 'string') {
      return connection.connectionString?.trim() ? 'connection string' : 'connection string (empty)';
    }

    const host = connection.host?.trim() ?? '';
    const database = connection.database?.trim() ?? '';
    return `${host || 'unknown-host'} / ${database || 'unknown-db'}`;
  }

  private buildMssqlConfig(connection?: MigrationConnectionConfigDto | null): MigrationConnectionConfig {
    if (!connection) {
      throw new BadRequestException('Old database connection is required');
    }

    if (connection.connectionMode === 'string') {
      if (!connection.connectionString?.trim()) {
        throw new BadRequestException('Connection string is required');
      }
      return { connectionString: connection.connectionString.trim() };
    }

    if (!connection.host?.trim() || !connection.username?.trim() || !connection.password?.trim() || !connection.database?.trim()) {
      throw new BadRequestException(
        'Host, port, username, password, and database are required in options mode',
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

  private buildPostgresConfig(connection: MigrationConnectionConfigDto): DataSourceOptions {
    if (connection.connectionMode === 'string') {
      if (!connection.connectionString?.trim()) {
        throw new BadRequestException('Connection string is required');
      }
      return {
        type: 'postgres',
        url: connection.connectionString.trim(),
      };
    }

    if (!connection.host?.trim() || !connection.username?.trim() || !connection.password?.trim() || !connection.database?.trim()) {
      throw new BadRequestException(
        'Host, port, username, password, and database are required in options mode',
      );
    }

    return {
      type: 'postgres',
      host: connection.host.trim(),
      port: connection.port ?? 5432,
      username: connection.username.trim(),
      password: connection.password,
      database: connection.database.trim(),
      ssl: connection.ssl === true ? { rejectUnauthorized: false } : false,
    };
  }

  private async verifyMssqlConnection(label: string, connection?: MigrationConnectionConfigDto | null): Promise<string> {
    if (!connection) {
      return `${label}: not provided`;
    }

    const pool = new mssql.ConnectionPool(this.buildMssqlConfig(connection) as mssql.config);
    try {
      await pool.connect();
      const result = await pool.request().query('SELECT 1 AS ok');
      const verified = Array.isArray(result.recordset) && result.recordset.length > 0;
      return `${label}: ${verified ? 'verified' : 'failed verification'}`;
    } finally {
      await pool.close().catch(() => undefined);
    }
  }

  private async verifyPostgresConnection(label: string, connection?: MigrationConnectionConfigDto | null): Promise<string> {
    if (!connection) {
      return `${label}: not provided`;
    }

    const dataSource = new DataSource(this.buildPostgresConfig(connection));
    try {
      await dataSource.initialize();
      await dataSource.query('SELECT 1');
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
    const baseOptions = this.buildPostgresConfig(connection) as DataSourceOptions;
    return {
      ...baseOptions,
      type: 'postgres',
      entities: [
        __dirname +
          '/../!(manual-bill-books|chequebooks|transactions)/**/*.entity{.ts,.js}',
      ],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      synchronize: false,
      namingStrategy: new SnakeNamingStrategy(),
      logging: true,
    } as DataSourceOptions;
  }

  private buildCurrentTransactionDataSourceOptions(
    connection: MigrationConnectionConfigDto,
  ): DataSourceOptions {
    const baseOptions = this.buildPostgresConfig(connection) as DataSourceOptions;
    return {
      ...baseOptions,
      type: 'postgres',
      entities: [
        __dirname + '/../manual-bill-books/**/*.entity{.ts,.js}',
        __dirname + '/../chequebooks/**/*.entity{.ts,.js}',
        __dirname + '/../transactions/**/*.entity{.ts,.js}',
      ],
      migrations: [__dirname + '/../migrations2/*{.ts,.js}'],
      synchronize: false,
      namingStrategy: new SnakeNamingStrategy(),
      logging: true,
    } as DataSourceOptions;
  }

  private async runCurrentDatabaseMigrationsForSlot(
    label: 'currentMaster' | 'currentTransaction',
    connection?: MigrationConnectionConfigDto | null,
  ): Promise<{ label: string; migrations: string[]; source: string }> {
    if (!connection) {
      throw new BadRequestException(
        `A UI connection is required to run schema migrations for ${label}`,
      );
    }

    const dataSource =
      label === 'currentMaster'
        ? new DataSource(this.buildCurrentMasterDataSourceOptions(connection))
        : new DataSource(this.buildCurrentTransactionDataSourceOptions(connection));

    const source = this.connectionSummary(connection);
    this.logger.log(`[schema-migrate] ${label} starting source=${source}`);

    let shouldDestroy = true;
    try {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      const migrations = await dataSource.runMigrations();
      const names = migrations.map(migration => migration.name);
      this.logger.log(
        `[schema-migrate] ${label} finished applied=${names.length} names=${names.join(', ') || 'none'}`,
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
    handler: (connections: { master: mssql.ConnectionPool; transaction: mssql.ConnectionPool }) => Promise<T>,
  ): Promise<T> {
    const masterConnection = dto.oldMasterConnection ?? dto.oldTransactionConnection;
    const transactionConnection = dto.oldTransactionConnection ?? dto.oldMasterConnection;
    const masterPool = new mssql.ConnectionPool(this.buildMssqlConfig(masterConnection) as mssql.config);
    const transactionPool = new mssql.ConnectionPool(this.buildMssqlConfig(transactionConnection) as mssql.config);

    try {
      await Promise.all([masterPool.connect(), transactionPool.connect()]);
      return await handler({ master: masterPool, transaction: transactionPool });
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
      this.verifyPostgresConnection('currentMaster', dto.currentMasterConnection),
      this.verifyPostgresConnection('currentTransaction', dto.currentTransactionConnection),
      this.verifyMssqlConnection('oldMaster', dto.oldMasterConnection),
      this.verifyMssqlConnection('oldTransaction', dto.oldTransactionConnection),
    ]);
    const verified = !connectionResults.some(result => result.includes('failed verification'));
    this.logger.log(`Verify connection finished verified=${verified} results=${connectionResults.join(' | ')}`);
    return {
      verified,
      message: connectionResults.join(' | '),
    };
  }

  async runCurrentDatabaseMigrations(dto: MigrationRunRequestDto) {
    this.logger.log('[schema-migrate] current database migration requested');
    const target = dto.schemaTarget
      ?? (dto.currentMasterConnection ? 'currentMaster' : 'currentTransaction');

    const connection =
      target === 'currentMaster'
        ? dto.currentMasterConnection
        : dto.currentTransactionConnection;

    const result = await this.runCurrentDatabaseMigrationsForSlot(target, connection);
    const message = `${target}: ${
      result.migrations.length > 0 ? `applied ${result.migrations.length} migration(s)` : 'up to date'
    }`;

    this.logger.log(`[schema-migrate] current database migration finished ${message}`);

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
      sourceConnection: 'multi-profile',
      connectionSummary: [
        `currentMaster=${this.connectionSummary(profiles.currentMaster)}`,
        `currentTransaction=${this.connectionSummary(profiles.currentTransaction)}`,
        `oldMaster=${this.connectionSummary(profiles.oldMaster)}`,
        `oldTransaction=${this.connectionSummary(profiles.oldTransaction)}`,
      ].join(' | '),
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
      currencyMap: new Map(),
      branchMap: new Map(),
      counterMap: new Map(),
      userMap: new Map(),
      roleMap: new Map(),
      branchCounters: new Map(),
      branchMainCounter: new Map(),
      branchUserLinks: [],
      counterUserLinks: [],
      userRows: [],
      createdRoleCodes: new Set(),
    };
  }

  private expandSelectedTables(selectedTables: string[]): string[] {
    const result = new Set<string>();

    for (const table of selectedTables) {
      const dependencies = TABLE_DEPENDENCIES[table];
      if (!dependencies) {
        continue;
      }
      dependencies.forEach(dep => result.add(dep));
    }

    return [...result];
  }

  private resolveTargetTableLabel(task: InternalTask): string {
    switch (task) {
      case 'company':
        return 'company';
      case 'currency':
        return 'currencies';
      case 'branch':
        return 'branches';
      case 'counter':
        return 'counters';
      case 'user':
        return 'users';
      case 'role':
        return 'roles';
      case 'userRoleLinks':
        return 'user_roles';
      case 'branchCounterLinks':
        return 'mstBranchCounterLink';
      case 'branchUserLinks':
        return 'mstBranchUserLink';
      case 'counterUserLinks':
        return 'mstCounterUserLink';
      default:
        return task;
    }
  }

  private sourceTableName(task: InternalTask): string {
    switch (task) {
      case 'company':
        return 'mstcompanyrecord';
      case 'currency':
        return 'mcurrency';
      case 'branch':
        return 'mstcompany';
      case 'counter':
        return 'mstcounter';
      case 'user':
        return 'mstuser';
      case 'branchCounterLinks':
        return 'mstBranchCounterLink';
      case 'branchUserLinks':
        return 'mstBranchUserLink';
      case 'counterUserLinks':
        return 'mstCounterUserLink';
      case 'role':
      case 'userRoleLinks':
        return 'mstuser';
      default:
        return '';
    }
  }

  private isTaskIncluded(context: MigrationContext, task: InternalTask): boolean {
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
      status: 'saved' | 'transformed' | 'skipped' | 'unmapped';
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
      note: params.note ?? '',
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
      transformApplied: params.transformApplied ?? '',
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
      sourceTable: params.sourceTable ?? '',
      sourceColumn: params.sourceColumn ?? '',
      note: params.note,
    });
  }

  private addError(
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourceRowIdentifier: string;
      fieldName: string;
      errorMessage: string;
      technicalNote?: string;
    },
  ) {
    context.errors.push({
      sourceTable: params.sourceTable,
      sourceRowIdentifier: params.sourceRowIdentifier,
      fieldName: params.fieldName,
      errorMessage: params.errorMessage,
      technicalNote: params.technicalNote ?? '',
    });
    context.summary.rowsFailed += 1;
    this.logger.error(
      `[${params.sourceTable}] row=${params.sourceRowIdentifier} field=${params.fieldName} error=${params.errorMessage}` +
        (params.technicalNote ? ` note=${params.technicalNote}` : ''),
    );
  }

  private addSkippedRow(
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourceRowIdentifier: string;
      reason: string;
      fallbackAction: string;
    },
  ) {
    context.skippedRows.push({
      sourceTable: params.sourceTable,
      sourceRowIdentifier: params.sourceRowIdentifier,
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
    for (const key of keys) {
      const value = toNullableString(row[key]);
      if (value) {
        return value;
      }
    }
    return null;
  }

  private resolveAuditFields(
    row: SourceRow,
    context: MigrationContext,
    params: {
      sourceTable: string;
      sourceRowIdentifier: string;
    },
  ): ResolvedAuditFields {
    const deletedFlag = toBoolean(row.bIsDeleted ?? row.bIsdeleted);
    const deletedDate =
      this.getSourceDate(row, ['dDeletedDate', 'dDeleteddate', 'dDeletedAt', 'dDeletedat']) ??
      this.getSourceDate(row, ['dLastUpdateDate', 'dlastupdatedDate', 'dCreationDate', 'dCreatedDate']) ??
      (deletedFlag ? new Date() : null);
    const deletedBySource = this.getSourceString(row, ['nDeletedBy', 'nDeletedBY', 'nDeletedby']);
    const deletedBy = deletedBySource
      ? this.resolveAuditUserId(context, deletedBySource, {
          sourceTable: params.sourceTable,
          sourceRowIdentifier: params.sourceRowIdentifier,
          fieldName: 'nDeletedBy',
        })
      : context.bootstrapAdminUserId ?? context.actorUserId;

    if (deletedFlag) {
      context.summary.softDeletedRows += 1;
      const auditSource =
        this.getSourceDate(row, ['dDeletedDate', 'dDeleteddate', 'dDeletedAt', 'dDeletedat']) ?
          'source delete date'
          : this.getSourceDate(row, ['dLastUpdateDate', 'dlastupdatedDate', 'dCreationDate', 'dCreatedDate']) ?
            'row audit date'
            : 'current migration timestamp';

      this.addFieldStatus(context, {
        sourceTable: params.sourceTable,
        sourceColumn: 'bIsDeleted',
        sourceValue: true,
        targetColumn: 'deletedAt',
        targetValue: deletedDate,
        status: 'transformed',
        note: `Soft-delete inferred from old row; deletedAt resolved from ${auditSource}`,
      });

      if (deletedBy) {
        this.addFieldStatus(context, {
          sourceTable: params.sourceTable,
          sourceColumn: 'nDeletedBy',
          sourceValue: deletedBySource,
          targetColumn: 'deletedBy',
          targetValue: deletedBy,
          status: 'saved',
          note: 'Soft-delete actor preserved as source reference only',
        });
      } else {
        this.addWarning(context, {
          sourceTable: params.sourceTable,
          sourceColumn: 'nDeletedBy',
          note: `Deleted row ${params.sourceRowIdentifier} has no resolvable deletedBy reference`,
        });
      }
    }

    return {
      deletedAt: deletedFlag ? deletedDate : null,
      deletedBy: deletedFlag ? deletedBy : null,
      wasDeleted: deletedFlag,
      deletedAtSource: deletedFlag
        ? this.getSourceDate(row, ['dDeletedDate', 'dDeleteddate', 'dDeletedAt', 'dDeletedat'])
          ? 'source delete date'
          : this.getSourceDate(row, ['dLastUpdateDate', 'dlastupdatedDate', 'dCreationDate', 'dCreatedDate'])
            ? 'row audit date'
            : 'current migration timestamp'
        : 'not deleted',
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
    if (permissionValue === undefined || permissionValue === null || String(permissionValue).trim() === '') {
      return;
    }

    this.addFieldStatus(context, {
      sourceTable: params.sourceTable,
      sourceColumn: 'Permission',
      sourceValue: permissionValue,
      targetColumn: 'permissions / roles_menu_permissions',
      targetValue: null,
      status: 'unmapped',
      note: 'Legacy sidebar/menu permission blob captured for manual review; exact decode depends on business rule',
    });
    this.addWarning(context, {
      sourceTable: params.sourceTable,
      sourceColumn: 'Permission',
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

  private ensureSourceRows(
    context: MigrationContext,
    task: InternalTask,
    rows: SourceRow[],
  ) {
    context.sourceCache[task] = rows;
  }

  private getSourceRows(context: MigrationContext, task: InternalTask): SourceRow[] {
    return context.sourceCache[task] ?? [];
  }

  private resolveAuditUserId(
    context: MigrationContext,
    sourceValue: any,
    params: {
      sourceTable: string;
      sourceRowIdentifier: string;
      fieldName: string;
    },
  ): string {
    const sourceKey = toNullableString(sourceValue);
    if (sourceKey) {
      const mapped = this.userMap.get(sourceKey);
      if (mapped) {
        return mapped;
      }

      if (sourceKey !== '0' && sourceKey !== 'null' && sourceKey !== 'undefined') {
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
      .map(row => {
        const code = toNullableString(row.vUID)?.toUpperCase() ?? '';
        const name = toNullableString(row.vName)?.toUpperCase() ?? '';
        const email = toNullableString(row.vMailID)?.toUpperCase() ?? '';
        let score = 0;
        if (toBoolean(row.bIsAdministrator)) score += 100;
        if (code === 'ADMIN' || code === 'HO' || code === 'ALLR') score += 80;
        if (name.includes('ADMIN') || name.includes('HO')) score += 30;
        if (email.includes('ADMIN') || email.includes('HO')) score += 20;
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
    const targetTable = 'company';
    this.logger.log(`[mstcompanyrecord] resolving company oldId=${String(oldId ?? '')} lookupKey=${lookupKey}`);

    if (this.companyMap.has(String(oldId))) {
      return {
        id: this.companyMap.get(String(oldId))!,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
      };
    }

    const name = toStringOrFallback(row.vCompanyName, `Company ${oldId}`);
    const panNo = toStringOrFallback(row.cgstno ?? row.panNo ?? row.PANNO, `PAN_PENDING_${oldId}`);
    const fromDate = toNullableDate(row.FROMDATE);
    const toDate = toNullableDate(row.TODATE);
    const createdBy = this.resolveAuditUserId(context, row.nCreatedBy ?? row.vCreatedBy, {
      sourceTable: 'mstcompanyrecord',
      sourceRowIdentifier: String(oldId ?? ''),
      fieldName: 'nCreatedBy',
    });
    const updatedBy = this.resolveAuditUserId(context, row.nLastupdatedby ?? row.nLastUpdateBy, {
      sourceTable: 'mstcompanyrecord',
      sourceRowIdentifier: String(oldId ?? ''),
      fieldName: 'nLastupdatedby',
    });
    const audit = this.resolveAuditFields(row, context, {
      sourceTable: 'mstcompanyrecord',
      sourceRowIdentifier: String(oldId ?? ''),
    });
    const existing = await this.targetCompanyRepository.findOne({
      where: {
        panNo,
        name,
        fromDate,
        toDate,
      },
    });

    if (existing) {
      this.logger.log(`[mstcompanyrecord] reused company oldId=${String(oldId ?? '')} targetId=${existing.id}`);
      if (audit.wasDeleted && context.mode === 'real') {
        existing.deletedAt = audit.deletedAt;
        existing.deletedBy = audit.deletedBy;
        await this.targetCompanyRepository.save(existing);
        this.logger.warn(`[mstcompanyrecord] applied soft-delete to reused company id=${existing.id}`);
      }
      this.companyMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: 'mstcompanyrecord',
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      return { id: existing.id, created: false, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
    }
    const company = this.targetCompanyRepository.create({
      name,
      shortCode: null,
      formerlyKnownName: toNullableString(row.VCOMPANYNAME2),
      cinNo: toNullableString(row.vRBIName),
      panNo,
      fxRegNo: toNullableString(row.VRBILICENCENUMBER),
      fxRegDate: fromDate,
      fromDate,
      toDate,
      logo: toNullableString(row.LOGOPATH),
      aeonLicNo: toNullableString(row.VRBILICENCENUMBER),
      website: null,
      email: null,
      createdBy,
      updatedBy,
      deletedAt: audit.deletedAt,
      deletedBy: audit.deletedBy,
    });

    if (row.vBranchCode) {
      this.addUnmappedColumn(context, {
        sourceTable: 'mstcompanyrecord',
        sourceColumn: 'vBranchCode',
        sourceValue: row.vBranchCode,
        reason: 'Branch code is kept for sheet review only and is not stored on company',
      });
    }

    if (context.mode === 'real') {
      const saved = await this.targetCompanyRepository.save(company);
      this.logger.log(
        `[mstcompanyrecord] created company id=${saved.id} version=${String(fromDate ?? '')}..${String(toDate ?? '')}`,
      );
      this.companyMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: 'mstcompanyrecord',
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      return { id: saved.id, created: true, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
    }

    const mockId = `mock-company-${oldId ?? randomUUID()}`;
    this.logger.log(
      `[mstcompanyrecord] mock company id=${mockId} version=${String(fromDate ?? '')}..${String(toDate ?? '')}`,
    );
    this.companyMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: 'mstcompanyrecord',
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    return { id: mockId, created: true, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
  }

  private transformBranchCode(row: SourceRow): { value: string; transformed: boolean; sourceField: string } {
    const raw = toNullableString(row.Prefix) || toNullableString(row.vBranchCode) || 'BRAN';
    const sourceField = toNullableString(row.Prefix) ? 'Prefix' : 'vBranchCode';
    const base = raw.trim();
    if (base.length === 4) {
      return { value: base.toUpperCase(), transformed: sourceField === 'Prefix' ? false : false, sourceField };
    }

    if (base.length > 4) {
      return { value: base.slice(0, 4).toUpperCase(), transformed: true, sourceField };
    }

    const padded = base.padEnd(4, '0').slice(0, 4).toUpperCase();
    return { value: padded, transformed: true, sourceField };
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
  ): Promise<{ id: string | null; created: boolean; lookupKey: string | null } | null> {
    const raw = this.getSourceLocationType(row);
    if (!raw) {
      return null;
    }

    const lookupKey = `LOCATIONTYPE:${normalizeCode(raw)}`;
    const existing = await this.targetSelectOptionRepository.findOne({
      where: {
        code: 'LOCATIONTYPE',
        value: raw,
      },
    });

    if (existing) {
      this.addFieldStatus(context, {
        sourceTable: 'mstcompany',
        sourceColumn: 'vLocationType',
        sourceValue: raw,
        targetColumn: 'locationType',
        targetValue: existing.id,
        status: 'saved',
        note: 'Resolved through category_options.LOCATIONTYPE and reused existing option',
      });
      this.addColumnMapping(context, {
        sourceTable: 'mstcompany',
        sourceColumn: 'vLocationType',
        sourceValue: raw,
        targetColumn: 'locationType',
        targetValue: existing.id,
        result: 'reused',
      });
      return { id: existing.id, created: false, lookupKey };
    }

    if (context.mode === 'real') {
      const createdBy = context.bootstrapAdminUserId ?? context.actorUserId;
      const option = this.targetSelectOptionRepository.create({
        code: 'LOCATIONTYPE',
        value: raw,
        label: raw,
        sortOrder: 0,
        isActive: true,
        createdBy,
        updatedBy: createdBy,
      });
      const saved = await this.targetSelectOptionRepository.save(option);
      this.logger.log(`[mstcompany] created lookup category option LOCATIONTYPE value=${raw} id=${saved.id}`);
      this.addFieldStatus(context, {
        sourceTable: 'mstcompany',
        sourceColumn: 'vLocationType',
        sourceValue: raw,
        targetColumn: 'locationType',
        targetValue: saved.id,
        status: 'transformed',
        note: 'Created missing category_options row for branch location type',
      });
      this.addColumnMapping(context, {
        sourceTable: 'mstcompany',
        sourceColumn: 'vLocationType',
        sourceValue: raw,
        targetColumn: 'locationType',
        targetValue: saved.id,
        result: 'created',
      });
      this.addIdMap(context, {
        oldTable: 'mstcompany',
        oldId,
        newTable: 'category_options',
        newUuid: saved.id,
        lookupKey,
      });
      return { id: saved.id, created: true, lookupKey };
    }

    const mockId = `mock-location-type-${normalizeCode(raw)}-${String(oldId ?? randomUUID())}`;
    this.logger.log(`[mstcompany] mock create lookup category option LOCATIONTYPE value=${raw} id=${mockId}`);
    this.addFieldStatus(context, {
      sourceTable: 'mstcompany',
      sourceColumn: 'vLocationType',
      sourceValue: raw,
      targetColumn: 'locationType',
      targetValue: mockId,
      status: 'transformed',
      note: 'Mock run would create category_options row for branch location type',
    });
    this.addColumnMapping(context, {
      sourceTable: 'mstcompany',
      sourceColumn: 'vLocationType',
      sourceValue: raw,
      targetColumn: 'locationType',
      targetValue: mockId,
      result: 'mock-created',
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
    const rawLocation = toNullableString(row.vLocation);
    const city = toNullableString(row.vCity);
    if (!rawLocation) {
      return {
        country: null,
        state: null,
        gstState: city ?? null,
        note: 'No vLocation value supplied; city preserved as fallback geography text',
      };
    }

    const stateMatch = await this.targetStateRepository.findOne({
      where: [
        { code: rawLocation },
        { name: rawLocation },
        { gstStateCode: rawLocation },
        { ctrStateCode: rawLocation },
      ],
      relations: {
        country: true,
      },
    });

    if (stateMatch) {
      this.addFieldStatus(context, {
        sourceTable: 'mstcompany',
        sourceColumn: 'vLocation',
        sourceValue: rawLocation,
        targetColumn: 'state_id / country_id / gstState',
        targetValue: {
          stateId: stateMatch.id,
          countryId: stateMatch.country?.id ?? null,
          gstState: stateMatch.name,
        },
        status: 'saved',
        note: 'Resolved branch geography through state lookup',
      });
      this.addColumnMapping(context, {
        sourceTable: 'mstcompany',
        sourceColumn: 'vLocation',
        sourceValue: rawLocation,
        targetColumn: 'state_id',
        targetValue: stateMatch.id,
        result: 'reused',
      });
      return {
        country: stateMatch.country ?? null,
        state: stateMatch,
        gstState: stateMatch.name,
        note: 'Resolved as state reference',
      };
    }

    const countryMatch = await this.targetCountryRepository.findOne({
      where: [
        { code: rawLocation },
        { name: rawLocation },
        { lrsCountryCode: rawLocation },
        { ctrCountryCode: rawLocation },
      ],
      relations: {
        countryGroup: true,
      },
    });

    if (countryMatch) {
      this.addFieldStatus(context, {
        sourceTable: 'mstcompany',
        sourceColumn: 'vLocation',
        sourceValue: rawLocation,
        targetColumn: 'country_id / gstState',
        targetValue: {
          countryId: countryMatch.id,
          gstState: city ?? rawLocation,
        },
        status: 'saved',
        note: 'Resolved branch geography through country lookup',
      });
      this.addColumnMapping(context, {
        sourceTable: 'mstcompany',
        sourceColumn: 'vLocation',
        sourceValue: rawLocation,
        targetColumn: 'country_id',
        targetValue: countryMatch.id,
        result: 'reused',
      });
      return {
        country: countryMatch,
        state: null,
        gstState: city ?? rawLocation,
        note: 'Resolved as country reference',
      };
    }

    this.addFieldStatus(context, {
      sourceTable: 'mstcompany',
      sourceColumn: 'vLocation',
      sourceValue: rawLocation,
      targetColumn: 'gstState',
      targetValue: rawLocation,
      status: 'unmapped',
      note: 'No safe state/country match found; raw geography preserved as fallback text',
    });
    this.addUnmappedColumn(context, {
      sourceTable: 'mstcompany',
      sourceColumn: 'vLocation',
      sourceValue: rawLocation,
      reason: 'No safe state/country match found in current lookup tables',
    });
    return {
      country: null,
      state: null,
      gstState: rawLocation,
      note: 'Raw location preserved as fallback text',
    };
  }

  private getLegacyCountryIdentifier(row: SourceRow): string | number | null | undefined {
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

  private async loadLegacyCountryCandidates(pool: mssql.ConnectionPool, context: MigrationContext): Promise<SourceRow[]> {
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
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    const fallbackTables = ['mstcountry', 'mcountry', 'country', 'countries', 'mst_country', 'tblcountry'];
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
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    context.sourceCache.legacyCountryCandidates = rows;
    this.logger.log(`[mcurrency] loaded ${rows.length} legacy country candidate row(s)`);
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
      this.getSourceString(row, ['vCountryGroup', 'countryGroup', 'countryGroupName', 'groupName', 'group']) ?? null;
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
      createdBy: this.resolveAuditUserId(context, row.nCreatedBy ?? row.nCreatedBY, {
        sourceTable: params.sourceTable,
        sourceRowIdentifier: params.sourceRowIdentifier,
        fieldName: 'nCreatedBy',
      }),
      updatedBy: this.resolveAuditUserId(context, row.nLastUpdateBy ?? row.nLastupdatedBy, {
        sourceTable: params.sourceTable,
        sourceRowIdentifier: params.sourceRowIdentifier,
        fieldName: 'nLastUpdateBy',
      }),
    });

    if (context.mode === 'real') {
      return this.targetCountryGroupRepository.save(group);
    }

    return { ...group, id: `mock-country-group-${normalizedCode}` } as CountryGroup;
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
    if (legacyCountryId === null || legacyCountryId === undefined || legacyCountryId === '') {
      this.addSkippedRow(context, {
        sourceTable: params.sourceTable,
        sourceRowIdentifier: params.sourceRowIdentifier,
        reason: 'Currency country reference missing',
        fallbackAction: 'Currency row skipped',
      });
      return null;
    }

    const legacyKey = String(legacyCountryId);
    const cachedTargetId = this.countryMap.get(legacyKey);
    if (cachedTargetId) {
      const cachedCountry = await this.targetCountryRepository.findOne({
        where: { id: cachedTargetId },
        relations: { countryGroup: true },
      });
      if (cachedCountry) {
        return cachedCountry;
      }
      return {
        id: cachedTargetId,
      } as Country;
    }

    const candidates = await this.loadLegacyCountryCandidates(pool, context);
    const sourceRow = candidates.find(candidate => {
      const candidateId = this.getLegacyCountryIdentifier(candidate);
      return candidateId !== undefined && candidateId !== null && String(candidateId) === legacyKey;
    });

    if (!sourceRow) {
      this.addSkippedRow(context, {
        sourceTable: params.sourceTable,
        sourceRowIdentifier: params.sourceRowIdentifier,
        reason: `Could not resolve legacy country id ${legacyKey} from available source tables`,
        fallbackAction: 'Currency row skipped',
      });
      this.addUnmappedColumn(context, {
        sourceTable: params.sourceTable,
        sourceColumn: 'nCountryID',
        sourceValue: legacyCountryId,
        reason: 'Legacy country source row was not found in the connected MSSQL database',
      });
      return null;
    }

    const sourceTableName = toNullableString(sourceRow.__legacySourceTable) ?? 'legacy-country';
    const countryCode =
      this.getSourceString(sourceRow, ['vCncode', 'vCountryCode', 'countryCode', 'code', 'isoCode', 'alpha2Code']) ??
      normalizeCode(this.getSourceString(sourceRow, ['vCnName', 'vCountryName', 'countryName', 'name']) ?? `COUNTRY_${legacyKey}`);
    const countryName =
      this.getSourceString(sourceRow, ['vCnName', 'vCountryName', 'countryName', 'name', 'description']) ??
      countryCode;
    const countryGroup = await this.resolveCountryGroupFromLegacyRow(sourceRow, context, {
      sourceTable: sourceTableName,
      sourceRowIdentifier: String(this.getLegacyCountryIdentifier(sourceRow) ?? legacyKey),
    });
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
      if (countryGroup && (!existing.countryGroup || existing.countryGroup.id !== countryGroup.id)) {
        existing.countryGroup = { id: countryGroup.id } as CountryGroup;
      }
      if (context.mode === 'real' && countryGroup) {
        await this.targetCountryRepository.save(existing);
      }
      this.countryMap.set(legacyKey, existing.id);
      this.addIdMap(context, {
        oldTable: sourceTableName,
        oldId: this.getLegacyCountryIdentifier(sourceRow),
        newTable: 'countries',
        newUuid: existing.id,
        lookupKey: `${countryCode}:${countryName}`,
      });
      return existing;
    }

    const country = {
      code: countryCode,
      name: countryName,
      countryGroup: countryGroup ? ({ id: countryGroup.id } as CountryGroup) : null,
      lrsCountryCode: countryCode,
      ctrCountryCode: countryCode,
      riskCategory: 'low',
      restrictedCountry: false,
      greyListCountry: false,
      baseCountry: false,
      createdBy: this.resolveAuditUserId(context, sourceRow.nCreatedBy ?? sourceRow.nCreatedBY, {
        sourceTable: sourceTableName,
        sourceRowIdentifier: String(this.getLegacyCountryIdentifier(sourceRow) ?? legacyKey),
        fieldName: 'nCreatedBy',
      }),
      updatedBy: this.resolveAuditUserId(context, sourceRow.nLastUpdateBy ?? sourceRow.nLastupdatedBy, {
        sourceTable: sourceTableName,
        sourceRowIdentifier: String(this.getLegacyCountryIdentifier(sourceRow) ?? legacyKey),
        fieldName: 'nLastUpdateBy',
      }),
    } as Country;

    if (context.mode === 'real') {
      const saved = await this.targetCountryRepository.save(country);
      this.countryMap.set(legacyKey, saved.id);
      this.addIdMap(context, {
        oldTable: sourceTableName,
        oldId: this.getLegacyCountryIdentifier(sourceRow),
        newTable: 'countries',
        newUuid: saved.id,
        lookupKey: `${countryCode}:${countryName}`,
      });
      this.addFieldStatus(context, {
        sourceTable: params.sourceTable,
        sourceColumn: 'nCountryID',
        sourceValue: legacyCountryId,
        targetColumn: 'country_id',
        targetValue: saved.id,
        status: 'saved',
        note: `Resolved and created/reused country from legacy table ${sourceTableName}`,
      });
      return saved;
    }

    const mockId = `mock-country-${legacyKey}`;
    this.countryMap.set(legacyKey, mockId);
    this.addIdMap(context, {
      oldTable: sourceTableName,
      oldId: this.getLegacyCountryIdentifier(sourceRow),
      newTable: 'countries',
      newUuid: mockId,
      lookupKey: `${countryCode}:${countryName}`,
    });
    this.addFieldStatus(context, {
      sourceTable: params.sourceTable,
      sourceColumn: 'nCountryID',
      sourceValue: legacyCountryId,
      targetColumn: 'country_id',
      targetValue: mockId,
      status: 'saved',
      note: `Would resolve country from legacy table ${sourceTableName}`,
    });
    return { ...country, id: mockId } as Country;
  }

  private async resolveBranch(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const oldId = row.nBranchID ?? row.nbranchid ?? row.id ?? row.ID;
    const lookupKey = toNullableString(row.vBranchCode) || `branch-${oldId}`;
    const targetTable = 'branches';
    this.logger.log(`[mstcompany] resolving branch oldId=${String(oldId ?? '')} lookupKey=${lookupKey}`);

    if (this.branchMap.has(String(oldId))) {
      return {
        id: this.branchMap.get(String(oldId))!,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
      };
    }

    const transformedCode = this.transformBranchCode(row);
    const branchNumber = toNullableNumber(row.nBranchID) ?? toNullableNumber(oldId) ?? 0;
    const companyOldId = row.nCompID ?? row.ncompid;
    const companyId = companyOldId !== undefined ? this.companyMap.get(String(companyOldId)) ?? null : null;
    const locationType = await this.resolveBranchLocationType(row, context, oldId);
    const geography = await this.resolveBranchGeography(row, context, oldId);
    const createdBy = this.resolveAuditUserId(context, row.nCreatedBy ?? row.nCreatedBY ?? row.vCreatedBy, {
      sourceTable: 'mstcompany',
      sourceRowIdentifier: String(oldId ?? ''),
      fieldName: 'nCreatedBy',
    });
    const updatedBy = this.resolveAuditUserId(context, row.nLastUpdateBy ?? row.nLastupdatedBy, {
      sourceTable: 'mstcompany',
      sourceRowIdentifier: String(oldId ?? ''),
      fieldName: 'nLastUpdateBy',
    });
    const audit = this.resolveAuditFields(row, context, {
      sourceTable: 'mstcompany',
      sourceRowIdentifier: String(oldId ?? ''),
    });
    const existing = await this.targetBranchRepository.findOne({
      where: [
        { code: transformedCode.value },
        { branchNumber },
      ],
    });

    if (existing) {
      this.logger.log(`[mstcompany] reused branch oldId=${String(oldId ?? '')} targetId=${existing.id}`);
      if (audit.wasDeleted && context.mode === 'real') {
        existing.deletedAt = audit.deletedAt;
        existing.deletedBy = audit.deletedBy;
        await this.targetBranchRepository.save(existing);
        this.logger.warn(`[mstcompany] applied soft-delete to reused branch id=${existing.id}`);
      }
      this.branchMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: 'mstcompany',
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      return { id: existing.id, created: false, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
    }

    const branch = this.targetBranchRepository.create({
      company: companyId ? ({ id: companyId } as Company) : null,
      country: geography.country ? ({ id: geography.country.id } as Country) : null,
      state: geography.state ? ({ id: geography.state.id } as State) : null,
      code: transformedCode.value,
      name: toStringOrFallback(row.vLocation || row.vCity || row.vBranchCode, `Branch ${oldId}`),
      branchNumber,
      address1: toStringOrFallback(row.vAddress1, 'UNKNOWN'),
      address2: toNullableString(row.vAddress2),
      address3: toNullableString(row.vAddress3),
      city: toStringOrFallback(row.vCity, 'UNKNOWN'),
      gstState: geography.gstState,
      pinCode: toStringOrFallback(row.vPinCode, '000000'),
      gstNo: toNullableString(row.vServiceTaxRegNo),
      fxRegNo: toNullableString(row.vRBILicenseNo),
      fxRegDate: toNullableDate(row.dRBIRegDate),
      contactName: toNullableString(row.vContactPeron),
      contactNo: toNullableString(row.vContactPeronNo || row.vTellNo1),
      branchEmail: toNullableString(row.vEmailID),
      aeonBranchLic: toNullableString(row.vRBILicenseNo),
      locationType: locationType?.id ? ({ id: locationType.id } as any) : null,
      cashHolding: toNullableNumber(row.nCashLimit),
      cashHoldingTemp: toNullableNumber(row.ntempCashLimit),
      currHolding: toNullableNumber(row.nCurrencyLimit),
      currHoldingTemp: toNullableNumber(row.ntempCurrencyLimit),
      isHeadOffice: toBoolean(row.IsHubBranch) || transformedCode.value === 'HO',
      isActive: toBoolean(row.bActive),
      createdBy,
      updatedBy,
      deletedAt: audit.deletedAt,
      deletedBy: audit.deletedBy,
    });

    this.addFieldStatus(context, {
      sourceTable: 'mstcompany',
      sourceColumn: 'vLocation',
      sourceValue: row.vLocation,
      targetColumn: 'state_id / country_id / gstState',
      targetValue: {
        stateId: geography.state?.id ?? null,
        countryId: geography.country?.id ?? null,
        gstState: geography.gstState,
      },
      status: geography.state || geography.country ? 'saved' : 'unmapped',
      note: geography.note,
    });

    if (row.nAttachedToBranchID !== undefined || row.nWUBranchID !== undefined || row.nReportingBranchID !== undefined || row.nAccountUSERID !== undefined || row.nOperationalUserID !== undefined || row.nBranchBMID !== undefined || row.vBranchID !== undefined) {
      const branchRelationFields = [
        ['nAttachedToBranchID', row.nAttachedToBranchID],
        ['nWUBranchID', row.nWUBranchID],
        ['nReportingBranchID', row.nReportingBranchID],
        ['nAccountUSERID', row.nAccountUSERID],
        ['nOperationalUserID', row.nOperationalUserID],
        ['nBranchBMID', row.nBranchBMID],
        ['vBranchID', row.vBranchID],
      ] as const;

      for (const [fieldName, value] of branchRelationFields) {
        if (value === undefined || value === null || value === '') {
          continue;
        }

        const isUserField = fieldName === 'nAccountUSERID' || fieldName === 'nOperationalUserID';
        const resolvedValue = isUserField
          ? await this.resolveAuditUserId(context, value, {
              sourceTable: 'mstcompany',
              sourceRowIdentifier: String(oldId ?? ''),
              fieldName,
            })
          : this.branchMap.get(String(value)) ?? null;

        this.addFieldStatus(context, {
          sourceTable: 'mstcompany',
          sourceColumn: fieldName,
          sourceValue: value,
          targetColumn: 'relation metadata',
          targetValue: resolvedValue,
          status: resolvedValue ? 'saved' : 'unmapped',
          note: 'Relation-only source field logged for branch review; not written directly to branches table',
        });
      }
    }

    if (transformedCode.transformed) {
      this.addTransformation(context, {
        sourceTable: 'mstcompany',
        sourceField: transformedCode.sourceField,
        ruleName: 'branch-code-normalization',
        originalValue: row[transformedCode.sourceField],
        transformedValue: transformedCode.value,
        result: 'transformed',
      });
      this.addFieldStatus(context, {
        sourceTable: 'mstcompany',
        sourceColumn: transformedCode.sourceField,
        sourceValue: row[transformedCode.sourceField],
        targetColumn: 'code',
        targetValue: transformedCode.value,
        status: 'transformed',
        note: 'Branch code normalized to four characters',
      });
    }

    if (context.mode === 'real') {
      const saved = await this.targetBranchRepository.save(branch);
      this.logger.log(`[mstcompany] created branch id=${saved.id}`);
      this.branchMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: 'mstcompany',
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      return { id: saved.id, created: true, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
    }

    const mockId = `mock-branch-${oldId ?? randomUUID()}`;
    this.logger.log(`[mstcompany] mock branch id=${mockId}`);
    this.branchMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: 'mstcompany',
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    return { id: mockId, created: true, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
  }

  private async resolveCounter(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const oldId = row.nCounterID ?? row.nCounterId ?? row.ncounterid ?? row.id ?? row.ID;
    const lookupKey =
      toNullableString(row.vCounterID) ||
      toNullableString(row.vCounterId) ||
      toNullableString(row.vCounterName) ||
      `counter-${oldId}`;
    const targetTable = 'counters';
    this.logger.log(`[mstcounter] resolving counter oldId=${String(oldId ?? '')} lookupKey=${lookupKey}`);

    if (this.counterMap.has(String(oldId))) {
      return {
        id: this.counterMap.get(String(oldId))!,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
      };
    }

    const branchOldId = row.nBranchID ?? row.nbranchid;
    const branchId = branchOldId !== undefined ? this.branchMap.get(String(branchOldId)) ?? null : null;
    const counterNo =
      toNullableNumber(row.vCounterID) ??
      toNullableNumber(row.vCounterId) ??
      toNullableNumber(row.nCounterID) ??
      toNullableNumber(row.nCounterId) ??
      1;
    const createdBy = this.resolveAuditUserId(context, row.nCreatedBy ?? row.nCreatedBY, {
      sourceTable: 'mstcounter',
      sourceRowIdentifier: String(oldId ?? ''),
      fieldName: 'nCreatedBy',
    });
    const updatedBy = this.resolveAuditUserId(context, row.nLastUpdateBy ?? row.nLastupdatedBy, {
      sourceTable: 'mstcounter',
      sourceRowIdentifier: String(oldId ?? ''),
      fieldName: 'nLastUpdateBy',
    });
    const audit = this.resolveAuditFields(row, context, {
      sourceTable: 'mstcounter',
      sourceRowIdentifier: String(oldId ?? ''),
    });
    const existing = await this.targetCounterRepository.findOne({
      where: [
        { counterNo, name: toStringOrFallback(row.vCounterName || row.vDescription, `Counter ${oldId}`) },
      ],
    });

    if (existing) {
      this.logger.log(`[mstcounter] reused counter oldId=${String(oldId ?? '')} targetId=${existing.id}`);
      if (audit.wasDeleted && context.mode === 'real') {
        existing.deletedAt = audit.deletedAt;
        existing.deletedBy = audit.deletedBy;
        await this.targetCounterRepository.save(existing);
        this.logger.warn(`[mstcounter] applied soft-delete to reused counter id=${existing.id}`);
      }
      this.counterMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: 'mstcounter',
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      return { id: existing.id, created: false, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
    }

    const counter = this.targetCounterRepository.create({
      branch: branchId ? ({ id: branchId } as Branch) : null,
      counterNo,
      name: toStringOrFallback(row.vCounterName || row.vDescription, `Counter ${oldId}`),
      isActive: toBoolean(row.bIsActive),
      isRetail: false,
      isBulk: false,
      isCombine: false,
      createdBy,
      updatedBy,
      deletedAt: audit.deletedAt,
      deletedBy: audit.deletedBy,
    });

    if (context.mode === 'real') {
      const saved = await this.targetCounterRepository.save(counter);
      this.logger.log(`[mstcounter] created counter id=${saved.id}`);
      this.counterMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: 'mstcounter',
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      return { id: saved.id, created: true, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
    }

    const mockId = `mock-counter-${oldId ?? randomUUID()}`;
    this.logger.log(`[mstcounter] mock counter id=${mockId}`);
    this.counterMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: 'mstcounter',
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    return { id: mockId, created: true, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
  }

  private getOldIdFromRow(row: SourceRow, primaryKeyFields: string[]): string | number | null | undefined {
    for (const field of primaryKeyFields) {
      if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
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
    if (oldId === null || oldId === undefined || oldId === '') {
      return undefined;
    }

    const rows = this.getSourceRows(context, task);
    return rows.find(row => {
      const candidate = this.getOldIdFromRow(row, primaryKeyFields);
      return candidate !== undefined && candidate !== null && String(candidate) === String(oldId);
    });
  }

  private async resolveBranchByOldId(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
    oldId: string | number | null | undefined,
  ): Promise<string | null> {
    if (oldId === null || oldId === undefined || oldId === '') {
      return null;
    }

    const key = String(oldId);
    const existing = this.branchMap.get(key);
    if (existing) {
      return existing;
    }

    this.logger.log(`[mstcompany] lazy resolving branch oldId=${key} from relation context`);
    if (!this.getSourceRows(context, 'branch').length) {
      const rows = await this.readSourceRows(pool, 'mstcompany');
      this.ensureSourceRows(context, 'branch', rows);
    }

    const row = this.findSourceRowByOldId(context, 'branch', oldId, ['nBranchID', 'nbranchid', 'id', 'ID']);
    if (!row) {
      this.logger.warn(`[mstcompany] could not locate source branch row for oldId=${key}`);
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
    if (oldId === null || oldId === undefined || oldId === '') {
      return null;
    }

    const key = String(oldId);
    const existing = this.counterMap.get(key);
    if (existing) {
      return existing;
    }

    this.logger.log(`[mstcounter] lazy resolving counter oldId=${key} from relation context`);
    if (!this.getSourceRows(context, 'counter').length) {
      const rows = await this.readSourceRows(pool, 'mstcounter');
      this.ensureSourceRows(context, 'counter', rows);
    }

    const row = this.findSourceRowByOldId(context, 'counter', oldId, ['nCounterID', 'nCounterId', 'ncounterid', 'id', 'ID']);
    if (!row) {
      this.logger.warn(`[mstcounter] could not locate source counter row for oldId=${key}`);
      return null;
    }

    const resolved = await this.resolveCounter(row, context);
    return resolved.id;
  }

  private async resolveUserByOldId(
    pool: mssql.ConnectionPool,
    context: MigrationContext,
    oldId: string | number | null | undefined,
  ): Promise<string | null> {
    if (oldId === null || oldId === undefined || oldId === '') {
      return null;
    }

    const key = String(oldId);
    const existing = this.userMap.get(key);
    if (existing) {
      return existing;
    }

    this.logger.log(`[mstuser] lazy resolving user oldId=${key} from relation context`);
    if (!this.getSourceRows(context, 'user').length) {
      const rows = await this.readSourceRows(pool, 'mstuser');
      this.ensureSourceRows(context, 'user', rows);
    }

    const row = this.findSourceRowByOldId(context, 'user', oldId, ['nUserID', 'nuserid', 'id', 'ID']);
    if (!row) {
      this.logger.warn(`[mstuser] could not locate source user row for oldId=${key}`);
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
      isFinance: toBoolean(row.bCreditLimitAuthorization) || toBoolean(row.bMiscLimitAuthorization),
      isBrnMgr: toBoolean(row.bCanClearCounter) || toBoolean(row.bDataEntryAuthorization),
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
    return toNullableString(row.Permission ?? row.permission) ?? '';
  }

  private getLegacyPermissionTokens(row: SourceRow): string[] {
    return [...new Set(splitLegacyTokens(this.getLegacyPermissionText(row)).map(token => token.trim()).filter(Boolean))];
  }

  private getLegacyRouteTokens(row: SourceRow): string[] {
    const tokens = this.getLegacyPermissionTokens(row);
    return tokens.filter(token => !legacyPermissionActionSet.has(normalizeMatchText(token)));
  }

  private getLegacyActions(row: SourceRow): string[] {
    const tokens = this.getLegacyPermissionTokens(row).map(token => normalizeMatchText(token));
    const actions = new Set<string>();

    for (const { code, aliases } of legacyActionAliases) {
      if (tokens.some(token => aliases.some(alias => normalizeMatchText(alias) === token))) {
        actions.add(code);
      }
    }

    if (actions.size === 0) {
      actions.add('view');
    }

    return [...actions];
  }

  private buildRoleSignature(row: SourceRow): string {
    const flags = this.roleFlagsFromUserRow(row);
    const normalizedTokens = this.getLegacyPermissionTokens(row)
      .map(token => normalizeMatchText(token))
      .filter(Boolean)
      .sort();
    return JSON.stringify({
      flags,
      permissions: normalizedTokens,
    });
  }

  private buildRoleCode(row: SourceRow): string {
    const signature = this.buildRoleSignature(row);
    return `LEGACY_ROLE_${createHash('sha1').update(signature).digest('hex').slice(0, 12).toUpperCase()}`;
  }

  private buildRoleName(row: SourceRow): string {
    if (toBoolean(row.bIsAdministrator)) {
      return 'Legacy Administrator';
    }
    if (toBoolean(row.bCanOptCentralM)) {
      return 'Legacy HO Staff';
    }
    return toStringOrFallback(row.vDescription || row.vName, 'Legacy Role');
  }

  private async ensurePermissionCatalog(): Promise<Permission[]> {
    const permissions = await this.targetPermissionRepository.find({
      order: { code: 'ASC' },
    });

    if (permissions.length > 0) {
      return permissions;
    }

    const requiredPermissions = [
      { code: 'add', name: 'Add', description: 'Permission to add records' },
      { code: 'modify', name: 'Modify', description: 'Permission to modify records' },
      { code: 'delete', name: 'Delete', description: 'Permission to delete records' },
      { code: 'view', name: 'View', description: 'Permission to view records' },
      { code: 'export', name: 'Export', description: 'Permission to export data' },
      { code: 'authorized', name: 'Authorized', description: 'Permission to authorize records' },
      { code: 'rejected', name: 'Rejected', description: 'Permission to reject records' },
    ];

    const created = this.targetPermissionRepository.create(
      requiredPermissions.map(permission => ({
        ...permission,
        createdBy: this.activeContext?.bootstrapAdminUserId ?? this.activeContext?.actorUserId ?? '',
        updatedBy: this.activeContext?.bootstrapAdminUserId ?? this.activeContext?.actorUserId ?? '',
      })),
    );
    const saved = await this.targetPermissionRepository.save(created);
    this.logger.log(`[mstuser] seeded ${saved.length} permission record(s) for role migration`);
    return saved;
  }

  private async ensureFrontendMenuCatalog(context: MigrationContext): Promise<void> {
    const existingMenus = await this.targetMenuRepository.find({
      relations: { parent: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    const existingEntityByPath = new Map<string, Menu>();
    const materializedByPath = new Map<string, { id: string; path: string; name: string; isAdmin: boolean; sortOrder: number; isActive: boolean }>();

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

      const parentPath = seed.parentPath ? normalizeMenuPath(seed.parentPath) : null;
      const parentRef = parentPath ? materializedByPath.get(parentPath) ?? null : null;
      const existing = existingEntityByPath.get(path);

      if (seed.parentPath && !parentRef) {
        this.addWarning(context, {
          sourceTable: 'frontend-menu-seed',
          sourceColumn: 'parentPath',
          note: `Menu seed ${seed.name} skipped because parent ${seed.parentPath} is missing`,
        });
        continue;
      }

      if (existing) {
        let changed = false;
        const desiredParentId = parentRef?.id ?? null;

        if ((existing.parent?.id ?? null) !== desiredParentId) {
          existing.parent = desiredParentId ? ({ id: desiredParentId } as Menu) : null;
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

        if (changed && context.mode === 'real') {
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
          sourceTable: 'frontend-menu-seed',
          sourceColumn: 'path',
          sourceValue: path,
          targetColumn: 'menus',
          targetValue: {
            id: existing.id,
            parentId: parentRef?.id ?? null,
          },
          status: changed ? 'transformed' : 'saved',
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

      if (context.mode === 'real') {
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
          sourceTable: 'frontend-menu-seed',
          sourcePrimaryKey: path,
          targetId: saved.id,
          status: 'inserted',
          note: `Seeded frontend menu ${seed.name}`,
        });
      } else {
        const mockId = `mock-menu-${createHash('sha1').update(path).digest('hex').slice(0, 12)}`;
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
          sourceTable: 'frontend-menu-seed',
          sourcePrimaryKey: path,
          targetId: mockId,
          status: 'mocked',
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
    const explicitCompanyOldId = row.nCompID ?? row.ncompid ?? row.companyId ?? row.company_id;
    if (explicitCompanyOldId !== undefined && explicitCompanyOldId !== null && explicitCompanyOldId !== '') {
      const mapped = this.companyMap.get(String(explicitCompanyOldId));
      if (mapped) {
        return mapped;
      }
    }

    const branchOldId = row.nBranchID ?? row.nbranchid;
    if (branchOldId !== undefined && branchOldId !== null && branchOldId !== '') {
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
      order: { createdAt: 'ASC' },
    });
    if (firstCompany) {
      this.addWarning(context, {
        sourceTable: 'mstuser',
        sourceColumn: 'company resolution',
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
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const activeMenus = menus.filter(menu => menu.isActive);
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

      const exact = activeMenus.find(menu => {
        const path = normalizeMatchText(menu.path ?? '');
        const name = normalizeMatchText(menu.name ?? '');
        return normalizedToken === path || normalizedToken === name;
      });
      if (exact) {
        exactMatches.set(exact.id, exact);
        continue;
      }

      let bestMenu: Menu | null = null;
      let bestScore = 0;
      for (const menu of activeMenus) {
        const pathScore = stringSimilarity(token, menu.path ?? '');
        const nameScore = stringSimilarity(token, menu.name ?? '');
        const score = Math.max(pathScore, nameScore);
        if (score > bestScore) {
          bestScore = score;
          bestMenu = menu;
        }
      }

      if (bestMenu && bestScore >= 0.6) {
        partialMatches.set(bestMenu.id, bestMenu);
        this.addFieldStatus(context, {
          sourceTable: 'mstuser',
          sourceColumn: 'Permission',
          sourceValue: token,
          targetColumn: 'menus.path',
          targetValue: bestMenu.path ?? bestMenu.name,
          status: 'transformed',
          note: `Legacy permission token matched by partial route similarity (${Math.round(bestScore * 100)}%)`,
        });
      } else {
        this.addWarning(context, {
          sourceTable: 'mstuser',
          sourceColumn: 'Permission',
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
        sourceTable: 'mstuser',
        sourceColumn: 'company resolution',
        note: `Role ${role.code} could not resolve a company; menu permissions were not written`,
      });
      return;
    }

    const permissions = await this.ensurePermissionCatalog();
    const permissionMap = new Map(permissions.map(permission => [permission.code, permission]));
    const isFullAccess = toBoolean(row.bIsAdministrator) || toBoolean(row.bCanOptCentralM);
    const menus = await this.targetMenuRepository.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    const selectedMenus = isFullAccess
      ? menus.filter(menu => menu.isActive)
      : await this.findBestMenuMatches(row, context);

    if (selectedMenus.length === 0) {
      this.addWarning(context, {
        sourceTable: 'mstuser',
        sourceColumn: 'Permission',
        note: `No menus matched legacy permission data for role ${role.code}`,
      });
      context.createdRoleCodes.add(roleCode);
      return;
    }

    const permissionCodes = isFullAccess
      ? [...permissionMap.keys()]
      : this.getLegacyActions(row).filter(code => permissionMap.has(code));

    if (permissionCodes.length === 0) {
      permissionCodes.push('view');
    }

    const relationRepository = this.targetRolesMenuPermissionRepository;
    if (context.mode === 'real') {
      await relationRepository
        .createQueryBuilder()
        .delete()
        .where('"role_id" = :roleId', { roleId: role.id })
        .andWhere('"company_id" = :companyId', { companyId })
        .execute();
    }

    const relations = selectedMenus.flatMap(menu =>
      permissionCodes.map(permissionCode => {
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
    ).filter(Boolean) as RolesMenuPermission[];

    if (relations.length === 0) {
      this.addWarning(context, {
        sourceTable: 'mstuser',
        sourceColumn: 'Permission',
        note: `No role menu permission rows could be built for ${role.code}`,
      });
      context.createdRoleCodes.add(roleCode);
      return;
    }

    if (context.mode === 'real') {
      await relationRepository.save(relations);
    }

    this.addFieldStatus(context, {
      sourceTable: 'mstuser',
      sourceColumn: 'Permission',
      sourceValue: this.getLegacyPermissionText(row),
      targetColumn: 'roles_menu_permissions',
      targetValue: {
        roleId: role.id,
        companyId,
        menuCount: selectedMenus.length,
        permissionCodes,
      },
      status: 'saved',
      note: isFullAccess
        ? 'Granted full route access for admin/HO role'
        : 'Mapped legacy permission data to current route permissions',
    });

    context.createdRoleCodes.add(roleCode);
  }

  private async resolveUserRoleBundle(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const oldId = row.nUserID ?? row.nuserid ?? row.id ?? row.ID;
    const lookupKey = toNullableString(row.vUID) || `user-${oldId}`;
    const targetTable = 'roles';
    const roleCode = this.buildRoleCode(row);
    this.logger.log(`[mstuser] resolving role bundle oldId=${String(oldId ?? '')} roleCode=${roleCode}`);

    if (this.roleMap.has(String(oldId))) {
      return {
        id: this.roleMap.get(String(oldId))!,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
      };
    }

    const existing = await this.targetRoleRepository.findOne({ where: { code: roleCode } });
    const audit = this.resolveAuditFields(row, context, {
      sourceTable: 'mstuser',
      sourceRowIdentifier: String(oldId ?? ''),
    });
    if (existing) {
      this.logger.log(`[mstuser] reused role oldId=${String(oldId ?? '')} targetId=${existing.id}`);
      if (audit.wasDeleted && context.mode === 'real') {
        existing.deletedAt = audit.deletedAt;
        existing.deletedBy = audit.deletedBy;
        await this.targetRoleRepository.save(existing);
        this.logger.warn(`[mstuser] applied soft-delete to reused role id=${existing.id}`);
      }
      this.roleMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: 'mstuser',
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      await this.syncRolePermissionsFromLegacyRow(row, existing, context);
      return { id: existing.id, created: false, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
    }

    const role = this.targetRoleRepository.create({
      code: roleCode,
      name: this.buildRoleName(row),
      ...this.roleFlagsFromUserRow(row),
      createdBy: this.resolveAuditUserId(context, row.nCreatedBy ?? row.nCreatedBY, {
        sourceTable: 'mstuser',
        sourceRowIdentifier: String(oldId ?? ''),
        fieldName: 'nCreatedBy',
      }),
      updatedBy: this.resolveAuditUserId(context, row.nLastUpdateBy ?? row.nLastupdatedBy, {
        sourceTable: 'mstuser',
        sourceRowIdentifier: String(oldId ?? ''),
        fieldName: 'nLastUpdateBy',
      }),
      deletedAt: audit.deletedAt,
      deletedBy: audit.deletedBy,
    });

    if (context.mode === 'real') {
      const saved = await this.targetRoleRepository.save(role);
      this.logger.log(`[mstuser] created role id=${saved.id}`);
      this.roleMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: 'mstuser',
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      await this.syncRolePermissionsFromLegacyRow(row, saved, context);
      return { id: saved.id, created: true, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
    }

    const mockId = `mock-role-${oldId ?? randomUUID()}`;
    this.logger.log(`[mstuser] mock role id=${mockId}`);
    this.roleMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: 'mstuser',
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    await this.syncRolePermissionsFromLegacyRow(row, role, context);
    return { id: mockId, created: true, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
  }

  private async resolveUser(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const oldId = row.nUserID ?? row.nuserid ?? row.id ?? row.ID;
    const lookupKey = toNullableString(row.vUID) || `user-${oldId}`;
    const targetTable = 'users';
    this.logger.log(`[mstuser] resolving user oldId=${String(oldId ?? '')} lookupKey=${lookupKey}`);

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
    const email = toNullableString(row.vMailID) ?? `user-${oldId}@migrated.local`;
    const createdBy = this.resolveAuditUserId(context, row.nCreatedBy ?? row.nCreatedBY, {
      sourceTable: 'mstuser',
      sourceRowIdentifier: String(oldId ?? ''),
      fieldName: 'nCreatedBy',
    });
    const updatedBy = this.resolveAuditUserId(context, row.nLastUpdateBy ?? row.nLastupdatedBy, {
      sourceTable: 'mstuser',
      sourceRowIdentifier: String(oldId ?? ''),
      fieldName: 'nLastUpdateBy',
    });
    const audit = this.resolveAuditFields(row, context, {
      sourceTable: 'mstuser',
      sourceRowIdentifier: String(oldId ?? ''),
    });
    const existing = await this.targetUserRepository.findOne({ where: [{ code }, { email }] });

    if (existing) {
      this.logger.log(`[mstuser] reused user oldId=${String(oldId ?? '')} targetId=${existing.id}`);
      if (audit.wasDeleted && context.mode === 'real') {
        existing.deletedAt = audit.deletedAt;
        existing.deletedBy = audit.deletedBy;
        await this.targetUserRepository.save(existing);
        this.logger.warn(`[mstuser] applied soft-delete to reused user id=${existing.id}`);
      }
      this.userMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: 'mstuser',
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      return { id: existing.id, created: false, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
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

    if (context.mode === 'real') {
      const saved = await this.targetUserRepository.save(user);
      this.logger.log(`[mstuser] created user id=${saved.id}`);
      this.userMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: 'mstuser',
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      return { id: saved.id, created: true, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
    }

    const mockId = `mock-user-${oldId ?? randomUUID()}`;
    this.logger.log(`[mstuser] mock user id=${mockId}`);
    this.userMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: 'mstuser',
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    return { id: mockId, created: true, sourceId: oldId, targetTable, lookupKey, softDeleted: audit.wasDeleted };
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
      order: { createdAt: 'ASC' },
    });

    if (existingAdmin) {
      context.bootstrapAdminUserId = existingAdmin.id;
      context.bootstrapAdminRoleId = existingAdmin.id;
      context.bootstrapAdminSourceOldId = null;
      this.logger.log(`[bootstrap] using existing admin user id=${existingAdmin.id}`);
      return {
        userId: existingAdmin.id,
        roleId: existingAdmin.id,
        sourceOldId: null,
        reusedExistingUser: true,
      };
    }

    if (!this.getSourceRows(context, 'user').length) {
      const rows = await this.readSourceRows(pool, 'mstuser');
      this.ensureSourceRows(context, 'user', rows);
    }

    const rows = this.getSourceRows(context, 'user');
    const bootstrapRow = this.pickBootstrapUserRow(rows);

    if (!bootstrapRow) {
      this.logger.warn('[bootstrap] no source user rows found; falling back to current actor for audit ownership');
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

    const sourceOldId = bootstrapRow.nUserID ?? bootstrapRow.nuserid ?? bootstrapRow.id ?? bootstrapRow.ID;
    this.logger.log(
      `[bootstrap] seeding admin user from mstuser oldId=${String(sourceOldId ?? '')} uid=${toNullableString(bootstrapRow.vUID) ?? ''}`,
    );

    const userResolved = await this.resolveUser(bootstrapRow, context);
    const roleResolved = await this.resolveUserRoleBundle(bootstrapRow, context);

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
      if (context.mode === 'real') {
        await this.targetUserRoleRepository.save(assignment);
        context.summary.rowsInserted += 1;
      }
      this.logger.log(
        `[bootstrap] ${context.mode === 'real' ? 'saved' : 'prepared'} admin role assignment userId=${userResolved.id} roleId=${roleResolved.id}`,
      );
    }

    this.addRowResult(context, {
      sourceTable: 'mstuser',
      sourcePrimaryKey: String(sourceOldId ?? ''),
      targetId: userResolved.id,
      status: context.mode === 'real' ? 'inserted' : 'mocked',
      note: 'Bootstrap admin user seeded before the selected table migration',
    });
    this.addRowResult(context, {
      sourceTable: 'roles',
      sourcePrimaryKey: String(sourceOldId ?? ''),
      targetId: roleResolved.id,
      status: context.mode === 'real' ? 'inserted' : 'mocked',
      note: 'Bootstrap admin role seeded before the selected table migration',
    });

    return {
      userId: userResolved.id,
      roleId: roleResolved.id,
      sourceOldId,
      reusedExistingUser: false,
    };
  }

  private mapCurrencyCalculationMethod(value: any): { value: string; transformed: boolean } {
    const text = toNullableString(value);
    if (!text) {
      return { value: 'MULTIPLICATION', transformed: false };
    }

    const normalized = normalizeMatchText(text);
    if (normalized.includes('div') || normalized.includes('divide')) {
      return { value: 'DIVISION', transformed: true };
    }

    if (normalized.includes('mul') || normalized.includes('mult')) {
      return { value: 'MULTIPLICATION', transformed: normalized !== 'multiplication' };
    }

    if (normalized === 'division' || normalized === 'divide') {
      return { value: 'DIVISION', transformed: false };
    }

    return { value: 'MULTIPLICATION', transformed: true };
  }

  private mapCurrencyProductAllowed(value: any): string {
    const normalized = toNullableString(value)?.toUpperCase() ?? '';
    return ['CN', 'CM', 'CC', 'ET', 'TC', 'TM'].includes(normalized) ? normalized : '';
  }

  private async processCurrencies(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'currency')) {
      return;
    }

    this.logger.log(`[mcurrency] table migration started mode=${context.mode}`);
    const rows = await this.readSourceRows(pool, 'mcurrency');
    this.ensureSourceRows(context, 'currency', rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const oldId = row.nCurrencyID ?? row.nCurrencyId ?? row.ncurrencyid ?? row.id ?? row.ID;
      const lookupKey = toNullableString(row.vCncode) || toNullableString(row.vCnName) || `currency-${oldId}`;

      try {
        const country = await this.resolveLegacyCountryReference(pool, context, row.nCountryID ?? row.nCountryId ?? row.ncountryid, {
          sourceTable: 'mcurrency',
          sourceRowIdentifier: String(oldId ?? ''),
        });
        if (!country) {
          skipped += 1;
          continue;
        }

        const existing = await this.targetCurrencyRepository.findOne({
          where: { currencyCode: toStringOrFallback(row.vCncode, `CURRENCY_${oldId}`) },
          relations: { country: true, pricingGroup: true },
        });
        const calculationMethod = this.mapCurrencyCalculationMethod(row.vCalculationMethod);
        const productAllowed = this.mapCurrencyProductAllowed(row.vProductAlloowd);
        const onlyStocking = toBoolean(row.bTradedCurrency);
        const pricingGroupCode = toNullableString(row.nCurrencyGroupID) ?? null;
        const currencyCode = toStringOrFallback(row.vCncode, `CURRENCY_${oldId}`);
        const currencyName = toStringOrFallback(row.vCnName, currencyCode);
        const resolvedCountryLabel = (country as any).name ?? currencyCode;
        const createdBy = this.resolveAuditUserId(context, row.nCreatedBy ?? row.nCreatedBY, {
          sourceTable: 'mcurrency',
          sourceRowIdentifier: String(oldId ?? ''),
          fieldName: 'nCreatedBy',
        });
        const updatedBy = this.resolveAuditUserId(context, row.nLastUpdateBy ?? row.nLastupdatedBy, {
          sourceTable: 'mcurrency',
          sourceRowIdentifier: String(oldId ?? ''),
          fieldName: 'nLastUpdateBy',
        });
        const audit = this.resolveAuditFields(row, context, {
          sourceTable: 'mcurrency',
          sourceRowIdentifier: String(oldId ?? ''),
        });

        this.addFieldStatus(context, {
          sourceTable: 'mcurrency',
          sourceColumn: 'bTradedCurrency',
          sourceValue: row.bTradedCurrency,
          targetColumn: 'onlyStocking',
          targetValue: onlyStocking,
          status: 'saved',
          note: 'Legacy traded currency flag mapped to onlyStocking',
        });

        if (row.vProductAlloowd !== undefined && row.vProductAlloowd !== null) {
          this.addFieldStatus(context, {
            sourceTable: 'mcurrency',
            sourceColumn: 'vProductAlloowd',
            sourceValue: row.vProductAlloowd,
            targetColumn: 'productAllowed',
            targetValue: onlyStocking ? productAllowed || '' : '',
            status: onlyStocking && productAllowed ? 'saved' : 'unmapped',
            note: onlyStocking && productAllowed
              ? 'Mapped to current productAllowed code'
              : 'Legacy product allowance is not valid for the current currency rules',
          });
        }

        if (existing) {
          let changed = false;
          if (existing.currencyName !== currencyName) {
            existing.currencyName = currencyName;
            changed = true;
          }
          if (String(existing.country?.id ?? '') !== String(country.id)) {
            existing.country = { id: country.id } as Country;
            changed = true;
          }
          if (existing.priority !== toStringOrFallback(row.nPriority, existing.priority)) {
            existing.priority = toStringOrFallback(row.nPriority, existing.priority);
            changed = true;
          }
          if (existing.ratePer !== toStringOrFallback(row.nRatePer, existing.ratePer)) {
            existing.ratePer = toStringOrFallback(row.nRatePer, existing.ratePer);
            changed = true;
          }
          if (existing.defaultMinRate !== toStringOrFallback(row.nDefaultMinRate, existing.defaultMinRate)) {
            existing.defaultMinRate = toStringOrFallback(row.nDefaultMinRate, existing.defaultMinRate);
            changed = true;
          }
          if (existing.defaultMaxRate !== toStringOrFallback(row.nDefaultMaxRate, existing.defaultMaxRate)) {
            existing.defaultMaxRate = toStringOrFallback(row.nDefaultMaxRate, existing.defaultMaxRate);
            changed = true;
          }
          if (existing.calculationMethod !== calculationMethod.value) {
            existing.calculationMethod = calculationMethod.value as any;
            changed = true;
          }
          if (existing.openRatePremium !== toStringOrFallback(row.nOpenRatePremium, existing.openRatePremium)) {
            existing.openRatePremium = toStringOrFallback(row.nOpenRatePremium, existing.openRatePremium);
            changed = true;
          }
          if (existing.gulfDiscFactor !== toStringOrFallback(row.nGulfDiscFactor, existing.gulfDiscFactor)) {
            existing.gulfDiscFactor = toStringOrFallback(row.nGulfDiscFactor, existing.gulfDiscFactor);
            changed = true;
          }
          if (existing.amexMapCode !== toStringOrFallback(row.vAmexCode, existing.amexMapCode)) {
            existing.amexMapCode = toStringOrFallback(row.vAmexCode, existing.amexMapCode);
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
          const desiredProductAllowed = onlyStocking ? productAllowed : '';
          if (existing.productAllowed !== desiredProductAllowed) {
            existing.productAllowed = desiredProductAllowed as any;
            changed = true;
          }
          if (pricingGroupCode) {
            this.addUnmappedColumn(context, {
              sourceTable: 'mcurrency',
              sourceColumn: 'nCurrencyGroupID',
              sourceValue: pricingGroupCode,
              reason: 'Pricing group mapping is not yet confirmed; logged for review only',
            });
          }
          if (row.VIssuerAllowed !== undefined) {
            this.addUnmappedColumn(context, {
              sourceTable: 'mcurrency',
              sourceColumn: 'VIssuerAllowed',
              sourceValue: row.VIssuerAllowed,
              reason: 'Issuer allowance is not mapped to a current currency column',
            });
          }
          if (row.vBranchCode !== undefined) {
            this.addUnmappedColumn(context, {
              sourceTable: 'mcurrency',
              sourceColumn: 'vBranchCode',
              sourceValue: row.vBranchCode,
              reason: 'Branch code is logged for review only',
            });
          }
          if (changed && context.mode === 'real') {
            existing.createdBy = createdBy;
            existing.updatedBy = updatedBy;
            existing.deletedAt = audit.deletedAt;
            existing.deletedBy = audit.deletedBy;
            await this.targetCurrencyRepository.save(existing);
            this.logger.log(`[mcurrency] updated existing currency id=${existing.id}`);
          }

          this.currencyMap.set(String(oldId), existing.id);
          this.addIdMap(context, {
            oldTable: 'mcurrency',
            oldId,
            newTable: 'currencies',
            newUuid: existing.id,
            lookupKey,
          });
          this.addRowResult(context, {
            sourceTable: 'mcurrency',
            sourcePrimaryKey: String(oldId ?? ''),
            targetId: existing.id,
            status: changed ? 'updated' : 'mapped',
            note: `Reused currency ${currencyCode} for country ${country.id}`,
          });
          continue;
        }

        const currency = {
          currencyCode,
          currencyName,
          country: { id: country.id } as Country,
          priority: toStringOrFallback(row.nPriority, '0'),
          ratePer: toStringOrFallback(row.nRatePer, '1'),
          defaultMinRate: toStringOrFallback(row.nDefaultMinRate, '0'),
          defaultMaxRate: toStringOrFallback(row.nDefaultMaxRate, '0'),
          calculationMethod: calculationMethod.value as any,
          openRatePremium: toStringOrFallback(row.nOpenRatePremium, '0'),
          gulfDiscFactor: toStringOrFallback(row.nGulfDiscFactor, '0'),
          amexMapCode: toStringOrFallback(row.vAmexCode, ''),
          group: 'ASIA',
          pricingGroup: null,
          active: toBoolean(row.bIsActive),
          onlyStocking,
          productAllowed: (onlyStocking ? productAllowed : '') as any,
          createdBy,
          updatedBy,
          deletedAt: audit.deletedAt,
          deletedBy: audit.deletedBy,
        } as Currency;

        if (pricingGroupCode) {
          this.addUnmappedColumn(context, {
            sourceTable: 'mcurrency',
            sourceColumn: 'nCurrencyGroupID',
            sourceValue: pricingGroupCode,
            reason: 'Pricing group mapping is not yet confirmed; logged for review only',
          });
        }
        if (row.VIssuerAllowed !== undefined) {
          this.addUnmappedColumn(context, {
            sourceTable: 'mcurrency',
            sourceColumn: 'VIssuerAllowed',
            sourceValue: row.VIssuerAllowed,
            reason: 'Issuer allowance is not mapped to a current currency column',
          });
        }
        if (row.vBranchCode !== undefined) {
          this.addUnmappedColumn(context, {
            sourceTable: 'mcurrency',
            sourceColumn: 'vBranchCode',
            sourceValue: row.vBranchCode,
            reason: 'Branch code is logged for review only',
          });
        }

        if (calculationMethod.transformed) {
          this.addTransformation(context, {
            sourceTable: 'mcurrency',
            sourceField: 'vCalculationMethod',
            ruleName: 'currency-calculation-method-normalization',
            originalValue: row.vCalculationMethod,
            transformedValue: calculationMethod.value,
            result: 'transformed',
          });
        }

        this.addFieldStatus(context, {
          sourceTable: 'mcurrency',
          sourceColumn: 'nCountryID',
          sourceValue: row.nCountryID,
          targetColumn: 'country_id',
          targetValue: country.id,
          status: 'saved',
          note: `Resolved via legacy country lookup for currency ${currencyCode}`,
        });

        if (context.mode === 'real') {
          const saved = await this.targetCurrencyRepository.save(currency);
          this.currencyMap.set(String(oldId), saved.id);
          this.addIdMap(context, {
            oldTable: 'mcurrency',
            oldId,
            newTable: 'currencies',
            newUuid: saved.id,
            lookupKey,
          });
          this.addRowResult(context, {
            sourceTable: 'mcurrency',
            sourcePrimaryKey: String(oldId ?? ''),
            targetId: saved.id,
            status: 'inserted',
            note: `Currency created for ${resolvedCountryLabel}`,
          });
          inserted += 1;
        } else {
          const mockId = `mock-currency-${oldId ?? randomUUID()}`;
          this.currencyMap.set(String(oldId), mockId);
          this.addIdMap(context, {
            oldTable: 'mcurrency',
            oldId,
            newTable: 'currencies',
            newUuid: mockId,
            lookupKey,
          });
          this.addRowResult(context, {
            sourceTable: 'mcurrency',
            sourcePrimaryKey: String(oldId ?? ''),
            targetId: mockId,
            status: 'saved',
            note: `Would create currency for ${resolvedCountryLabel}`,
          });
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: 'mcurrency',
          sourceRowIdentifier: String(oldId ?? ''),
          fieldName: 'currency',
          errorMessage: error instanceof Error ? error.message : 'Unknown currency migration failure',
        });
      }
    }

    context.summary.rowsInserted += inserted;
    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: 'mcurrency',
      targetTable: 'currencies',
      rowCountScanned: rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: context.mode === 'mock' ? 'Preview only' : 'Persisted to target db',
    });
    this.logger.log(`[mcurrency] table migration finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`);
  }

  private async processCompanies(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'company')) {
      return;
    }

    this.logger.log(`[mstcompanyrecord] table migration started mode=${context.mode}`);
    const rows = await this.readSourceRows(pool, 'mstcompanyrecord');
    this.ensureSourceRows(context, 'company', rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      try {
        const resolved = await this.resolveCompany(row, context);
        this.addRowResult(context, {
          sourceTable: 'mstcompanyrecord',
          sourcePrimaryKey: String(row.nCompID ?? row.id ?? row.ID ?? ''),
          targetId: resolved.id,
          status: context.mode === 'real' && resolved.created ? 'inserted' : 'mocked',
          note: `${resolved.created ? 'Company created or mapped' : 'Company reused from target db'}${resolved.softDeleted ? ' Source row marked deleted.' : ''}`,
        });
        if (resolved.created) {
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: 'mstcompanyrecord',
          sourceRowIdentifier: String(row.nCompID ?? row.id ?? row.ID ?? ''),
          fieldName: 'company',
          errorMessage: error instanceof Error ? error.message : 'Unknown company migration failure',
        });
      }
    }

    context.summary.rowsInserted += inserted;
    this.addTableResult(context, {
      sourceTable: 'mstcompanyrecord',
      targetTable: 'company',
      rowCountScanned: rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: context.mode === 'mock' ? 'Preview only' : 'Persisted to target db',
    });
    this.logger.log(`[mstcompanyrecord] table migration finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`);
  }

  private async processBranches(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'branch')) {
      return;
    }

    this.logger.log(`[mstcompany] table migration started mode=${context.mode}`);
    const rows = await this.readSourceRows(pool, 'mstcompany');
    this.ensureSourceRows(context, 'branch', rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      try {
        const companyOldId = row.nCompID ?? row.ncompid;
        if (!companyOldId || !this.companyMap.has(String(companyOldId))) {
          this.addSkippedRow(context, {
            sourceTable: 'mstcompany',
            sourceRowIdentifier: String(row.nBranchID ?? row.id ?? ''),
            reason: 'Parent company not resolved yet',
            fallbackAction: 'Branch row skipped until company exists',
          });
          skipped += 1;
          continue;
        }

        const resolved = await this.resolveBranch(row, context);
        this.addRowResult(context, {
          sourceTable: 'mstcompany',
          sourcePrimaryKey: String(row.nBranchID ?? row.id ?? row.ID ?? ''),
          targetId: resolved.id,
          status: resolved.created ? 'inserted' : 'reused',
          note: `${resolved.created ? 'Branch created or mapped' : 'Branch reused from target db'}${resolved.softDeleted ? ' Source row marked deleted.' : ''}`,
        });
        if (resolved.created) {
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: 'mstcompany',
          sourceRowIdentifier: String(row.nBranchID ?? row.id ?? row.ID ?? ''),
          fieldName: 'branch',
          errorMessage: error instanceof Error ? error.message : 'Unknown branch migration failure',
        });
      }
    }

    context.summary.rowsInserted += inserted;
    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: 'mstcompany',
      targetTable: 'branches',
      rowCountScanned: rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: context.mode === 'mock' ? 'Preview only' : 'Persisted to target db',
    });
    this.logger.log(`[mstcompany] table migration finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`);
  }

  private async processCounters(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'counter')) {
      return;
    }

    this.logger.log(`[mstcounter] table migration started mode=${context.mode}`);
    const rows = await this.readSourceRows(pool, 'mstcounter');
    this.ensureSourceRows(context, 'counter', rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      try {
        const resolved = await this.resolveCounter(row, context);
        this.addRowResult(context, {
          sourceTable: 'mstcounter',
      sourcePrimaryKey: String(row.nCounterID ?? row.nCounterId ?? row.id ?? row.ID ?? ''),
          targetId: resolved.id,
          status: resolved.created ? 'inserted' : 'reused',
          note: `${resolved.created ? 'Counter created or mapped' : 'Counter reused from target db'}${resolved.softDeleted ? ' Source row marked deleted.' : ''}`,
        });
        if (resolved.created) {
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: 'mstcounter',
      sourceRowIdentifier: String(row.nCounterID ?? row.nCounterId ?? row.id ?? row.ID ?? ''),
          fieldName: 'counter',
          errorMessage: error instanceof Error ? error.message : 'Unknown counter migration failure',
        });
      }
    }

    context.summary.rowsInserted += inserted;
    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: 'mstcounter',
      targetTable: 'counters',
      rowCountScanned: rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: context.mode === 'mock' ? 'Preview only' : 'Persisted to target db',
    });
    this.logger.log(`[mstcounter] table migration finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`);
  }

  private async processUsers(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'user') && !this.isTaskIncluded(context, 'role')) {
      return;
    }

    this.logger.log(`[mstuser] table migration started mode=${context.mode}`);
    const rows = await this.readSourceRows(pool, 'mstuser');
    this.ensureSourceRows(context, 'user', rows);
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
        this.logger.log(`[mstuser] skipping bootstrap user row oldId=${String(sourceOldId)} because it was seeded earlier`);
        continue;
      }
      try {
        this.logLegacyPermissionBlob(row, context, {
          sourceTable: 'mstuser',
          sourceRowIdentifier: String(sourceOldId ?? ''),
        });
        const userResolved = await this.resolveUser(row, context);
        const roleResolved = await this.resolveUserRoleBundle(row, context);
        context.userRows.push(row);

        const userDeletedSuffix = userResolved.softDeleted ? ' Source row marked deleted.' : '';
        const roleDeletedSuffix = roleResolved.softDeleted ? ' Source row marked deleted.' : '';

        this.addRowResult(context, {
          sourceTable: 'mstuser',
          sourcePrimaryKey: String(sourceOldId ?? ''),
          targetId: userResolved.id,
          status: userResolved.created ? 'inserted' : 'reused',
          note: `${userResolved.created ? 'User created or mapped' : 'User reused from target db'}${userDeletedSuffix}`,
        });
        this.addRowResult(context, {
          sourceTable: 'mstuser',
          sourcePrimaryKey: String(sourceOldId ?? ''),
          targetId: roleResolved.id,
          status: roleResolved.created ? 'inserted' : 'reused',
          note: `${roleResolved.created ? 'Role created from user access bundle' : 'Role reused from target db'}${roleDeletedSuffix}`,
        });

        if (userResolved.created) insertedUsers += 1;
        if (roleResolved.created) insertedRoles += 1;
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: 'mstuser',
          sourceRowIdentifier: String(row.nUserID ?? row.id ?? row.ID ?? ''),
          fieldName: 'user',
          errorMessage: error instanceof Error ? error.message : 'Unknown user migration failure',
        });
      }
    }

    context.summary.rowsInserted += insertedUsers + insertedRoles;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: 'mstuser',
      targetTable: 'users / roles',
      rowCountScanned: rows.length,
      rowCountInserted: insertedUsers + insertedRoles,
      rowCountSkipped: 0,
      rowCountFailed: failed,
      note: context.mode === 'mock' ? 'Preview only' : 'Persisted to target db',
    });
    this.logger.log(`[mstuser] table migration finished scanned=${rows.length} inserted=${insertedUsers + insertedRoles} failed=${failed}`);
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
        sourceRowIdentifier: String(row.nCBLId ?? row.nBranchUserID ?? row.nUserID ?? row.id ?? ''),
        reason: 'Branch or counter relation missing',
        fallbackAction: 'Relation logged only',
      });
      return null;
    }

    const key = String(branchOldId);
    const counters = context.branchCounters.get(key) ?? [];
    if (!counters.includes(counterId)) {
      counters.push(counterId);
      context.branchCounters.set(key, counters);
    }
    if (toBoolean(row.bMainCounter)) {
      context.branchMainCounter.set(key, counterId);
    }

    if (context.mode === 'real') {
      const counter = await this.targetCounterRepository.findOne({
        where: { id: counterId },
        relations: { branch: true },
      });
      if (counter && (!counter.branch || String(counter.branch.id) !== String(branchId))) {
        counter.branch = { id: branchId } as Branch;
        await this.targetCounterRepository.save(counter);
        this.logger.log(
          `[mstBranchCounterLink] backfilled counter branch relation counterId=${counterId} branchId=${branchId}`,
        );
        this.addFieldStatus(context, {
          sourceTable,
          sourceColumn: 'nBranchID / nCounterID',
          sourceValue: { nBranchID: branchOldId, nCounterID: counterOldId, bMainCounter: toBoolean(row.bMainCounter) },
          targetColumn: 'counters.branch_id',
          targetValue: { branchId, counterId },
          status: 'saved',
          note: 'Counter branch FK backfilled from branch-counter relation table',
        });
      }
    }

    return { branchId, counterId };
  }

  private async processBranchCounterLinks(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'branchCounterLinks')) {
      return;
    }

    this.logger.log(`[mstBranchCounterLink] table migration started mode=${context.mode}`);
    const rows = await this.readSourceRows(pool, 'mstBranchCounterLink');
    this.ensureSourceRows(context, 'branchCounterLinks', rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      try {
        const relation = await this.ensureBranchCounterRelation(row, context, 'mstBranchCounterLink', pool);
        if (!relation) {
          skipped += 1;
          continue;
        }

        this.addRowResult(context, {
          sourceTable: 'mstBranchCounterLink',
          sourcePrimaryKey: String(row.nCBLId ?? row.id ?? row.ID ?? ''),
          targetId: `${relation.branchId}:${relation.counterId}`,
          status: 'mapped',
          note: 'Branch-counter relationship resolved',
        });
        inserted += 1;
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: 'mstBranchCounterLink',
          sourceRowIdentifier: String(row.nCBLId ?? row.id ?? row.ID ?? ''),
          fieldName: 'branch-counter',
          errorMessage: error instanceof Error ? error.message : 'Unknown branch-counter relation failure',
        });
      }
    }

    context.summary.rowsInserted += inserted;
    context.summary.rowsSkipped += skipped;
    context.summary.rowsFailed += failed;
    this.addTableResult(context, {
      sourceTable: 'mstBranchCounterLink',
      targetTable: 'branch-counter relation',
      rowCountScanned: rows.length,
      rowCountInserted: inserted,
      rowCountSkipped: skipped,
      rowCountFailed: failed,
      note: context.mode === 'mock' ? 'Preview only' : 'Persisted as relation metadata',
    });
    this.logger.log(`[mstBranchCounterLink] table migration finished scanned=${rows.length} inserted=${inserted} skipped=${skipped} failed=${failed}`);
  }

  private async processBranchUserLinks(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'branchUserLinks')) {
      return;
    }

    this.logger.log(`[mstBranchUserLink] table migration started mode=${context.mode}`);
    const rows = await this.readSourceRows(pool, 'mstBranchUserLink');
    this.ensureSourceRows(context, 'branchUserLinks', rows);
    context.branchUserLinks = rows;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const branchOldId = row.nBranchID ?? row.nbranchid;
      const userOldId = row.nUserID ?? row.nuserid;
      const branchId = branchOldId ? await this.resolveBranchByOldId(pool, context, branchOldId) : undefined;
      const userId = userOldId ? await this.resolveUserByOldId(pool, context, userOldId) : undefined;

      if (!branchId || !userId) {
        this.addSkippedRow(context, {
          sourceTable: 'mstBranchUserLink',
          sourceRowIdentifier: String(row.nBranchUserID ?? row.id ?? row.ID ?? ''),
          reason: 'User or branch not resolved',
          fallbackAction: 'Will retry during user-role flush',
        });
        continue;
      }

      this.addRowResult(context, {
        sourceTable: 'mstBranchUserLink',
        sourcePrimaryKey: String(row.nBranchUserID ?? row.id ?? row.ID ?? ''),
        targetId: `${userId}:${branchId}`,
        status: 'mapped',
        note: 'Branch-user relation captured',
      });
    }

    this.addTableResult(context, {
      sourceTable: 'mstBranchUserLink',
      targetTable: 'user relation context',
      rowCountScanned: rows.length,
      rowCountInserted: 0,
      rowCountSkipped: context.skippedRows.filter(row => row.sourceTable === 'mstBranchUserLink').length,
      rowCountFailed: 0,
      note: 'Used later for user-role assignments',
    });
    this.logger.log(`[mstBranchUserLink] table migration finished scanned=${rows.length} skipped=${context.skippedRows.filter(row => row.sourceTable === 'mstBranchUserLink').length}`);
  }

  private async processCounterUserLinks(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'counterUserLinks')) {
      return;
    }

    this.logger.log(`[mstCounterUserLink] table migration started mode=${context.mode}`);
    const rows = await this.readSourceRows(pool, 'mstCounterUserLink');
    this.ensureSourceRows(context, 'counterUserLinks', rows);
    context.counterUserLinks = rows;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const branchOldId = row.nBranchID ?? row.nbranchid;
      const counterOldId = row.nCounterID ?? row.ncounterid;
      const userOldId = row.nUserID ?? row.nuserid;
      const branchId = branchOldId ? await this.resolveBranchByOldId(pool, context, branchOldId) : undefined;
      const counterId = counterOldId ? await this.resolveCounterByOldId(pool, context, counterOldId) : undefined;
      const userId = userOldId ? await this.resolveUserByOldId(pool, context, userOldId) : undefined;

      if (!branchId || !counterId || !userId) {
        this.addSkippedRow(context, {
          sourceTable: 'mstCounterUserLink',
          sourceRowIdentifier: String(row.id ?? row.nTrackingID ?? ''),
          reason: 'User, branch, or counter not resolved',
          fallbackAction: 'Will retry during user-role flush',
        });
        continue;
      }

      this.addRowResult(context, {
        sourceTable: 'mstCounterUserLink',
        sourcePrimaryKey: String(row.id ?? row.nTrackingID ?? ''),
        targetId: `${userId}:${branchId}:${counterId}`,
        status: 'mapped',
        note: 'Counter-user relation captured',
      });
    }

    this.addTableResult(context, {
      sourceTable: 'mstCounterUserLink',
      targetTable: 'user relation context',
      rowCountScanned: rows.length,
      rowCountInserted: 0,
      rowCountSkipped: context.skippedRows.filter(row => row.sourceTable === 'mstCounterUserLink').length,
      rowCountFailed: 0,
      note: 'Used later for user-role assignments',
    });
    this.logger.log(`[mstCounterUserLink] table migration finished scanned=${rows.length} skipped=${context.skippedRows.filter(row => row.sourceTable === 'mstCounterUserLink').length}`);
  }

  private getBranchCounterForBranch(branchId: string, context: MigrationContext): string | null {
    const mainCounter = context.branchMainCounter.get(branchId);
    if (mainCounter) return mainCounter;
    const counters = context.branchCounters.get(branchId);
    return counters && counters.length > 0 ? counters[0] : null;
  }

  private async flushUserRoleAssignments(context: MigrationContext): Promise<void> {
    const shouldFlush = ['user', 'role', 'userRoleLinks', 'branchUserLinks', 'counterUserLinks']
      .some(task => this.isTaskIncluded(context, task as InternalTask));
    if (!shouldFlush) {
      return;
    }

    this.logger.log(`[user_roles] flush started`);
    const uniqueAssignments = new Map<string, UserRole>();
    const actorId = context.bootstrapAdminUserId ?? context.actorUserId;

    const addAssignment = (userId: string, roleId: string, branchId: string, counterId: string, note: string) => {
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
        sourceTable: 'user_roles',
        sourcePrimaryKey: key,
        targetId: key,
        status: context.mode === 'real' ? 'inserted' : 'mocked',
        note,
      });
    };

    for (const row of context.userRows) {
      const oldUserId = row.nUserID ?? row.nuserid;
      const userId = oldUserId ? context.userMap.get(String(oldUserId)) : undefined;
      const roleId = oldUserId ? context.roleMap.get(String(oldUserId)) : undefined;
      const branchOldId = row.nBranchID ?? row.nbranchid;
      const branchId = branchOldId ? context.branchMap.get(String(branchOldId)) : undefined;
      if (!userId || !roleId || !branchId) {
        continue;
      }

      const counterId = this.getBranchCounterForBranch(branchId, context);
      if (!counterId) {
        this.addWarning(context, {
          sourceTable: 'mstuser',
          sourceColumn: 'nBranchID',
          note: `No counter found for branch ${branchId}; user-role assignment deferred`,
        });
        continue;
      }

      addAssignment(userId, roleId, branchId, counterId, 'Derived from mstuser row');
    }

    for (const row of context.branchUserLinks) {
      const oldUserId = row.nUserID ?? row.nuserid;
      const oldBranchId = row.nBranchID ?? row.nbranchid;
      const userId = oldUserId ? context.userMap.get(String(oldUserId)) : undefined;
      const branchId = oldBranchId ? context.branchMap.get(String(oldBranchId)) : undefined;
      if (!userId || !branchId) {
        continue;
      }
      const roleId = oldUserId ? context.roleMap.get(String(oldUserId)) : undefined;
      const counterId = this.getBranchCounterForBranch(branchId, context) ?? null;
      if (!roleId || !counterId) {
        continue;
      }
      addAssignment(userId, roleId, branchId, counterId, 'Derived from mstBranchUserLink');
    }

    for (const row of context.counterUserLinks) {
      const oldUserId = row.nUserID ?? row.nuserid;
      const oldBranchId = row.nBranchID ?? row.nbranchid;
      const oldCounterId = row.nCounterID ?? row.ncounterid;
      const userId = oldUserId ? context.userMap.get(String(oldUserId)) : undefined;
      const branchId = oldBranchId ? context.branchMap.get(String(oldBranchId)) : undefined;
      const counterId = oldCounterId ? context.counterMap.get(String(oldCounterId)) : undefined;
      if (!userId || !branchId || !counterId) {
        continue;
      }
      const roleId = oldUserId ? context.roleMap.get(String(oldUserId)) : undefined;
      if (!roleId) {
        continue;
      }
      addAssignment(userId, roleId, branchId, counterId, 'Derived from mstCounterUserLink');
    }

    const entities = [...uniqueAssignments.values()];
    if (entities.length === 0) {
      this.addWarning(context, {
        note: 'No user-role assignments were resolved from the selected tables.',
      });
      this.logger.warn(`[user_roles] no assignments resolved`);
      return;
    }

    if (context.mode === 'real') {
      await this.targetUserRoleRepository.save(entities);
      this.logger.log(`[user_roles] saved ${entities.length} assignment(s)`);
    }
    this.logger.log(`[user_roles] flush finished count=${entities.length}`);
  }

  private buildWorkbook(context: MigrationContext) {
    this.logger.log(`Building workbook for ${context.mode} run with ${context.summary.tables} table result(s)`);
    const workbook = XLSX.utils.book_new();
    const addSheet = (name: string, rows: ReportRow[]) => {
      const safeRows = (rows.length > 0 ? rows : [{ message: 'No rows' }]).map(sanitizeWorkbookRow);
      const sheet = XLSX.utils.json_to_sheet(safeRows);
      XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
    };

    addSheet('Summary', [
      {
        mode: context.mode,
        runLabel: context.mode === 'mock' ? 'soft run / preview' : 'real migration',
        connectionMode: context.sourceConnection,
        connectionSummary: context.connectionSummary,
        selectedTables: context.selectedTables.join(', '),
        expandedTables: context.expandedTables.join(', '),
        bootstrapAdminUserId: context.bootstrapAdminUserId ?? '',
        bootstrapAdminRoleId: context.bootstrapAdminRoleId ?? '',
        bootstrapAdminSourceOldId: context.bootstrapAdminSourceOldId ?? '',
        sharedAuditColumns: 'createdAt, createdBy, updatedAt, updatedBy, deletedAt, deletedBy',
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
      'Selected Tables',
      context.selectedTables.map((table, index) => ({
        tableName: table,
        migrationOrder: index + 1,
        dependencyIncluded: context.expandedTables.includes(table) ? 'yes' : 'no',
      })),
    );
    addSheet('Source Connection', [
      {
        connectionMode: context.sourceConnection,
        connectionSummary: context.connectionSummary,
        verified: true,
      },
    ]);
    addSheet('Table Results', context.tableResults);
    addSheet('Row Results', context.rowResults);
    addSheet('Column Mapping', context.columnMappings);
    addSheet('Transformations', context.transformations);
    addSheet('Unmapped Old Columns', context.unmappedOldColumns);
    addSheet('Skipped Rows', context.skippedRows);
    addSheet('Errors', context.errors);
    addSheet('Warnings', context.warnings);
    addSheet('ID Map', context.idMap);
    addSheet('Field Status Log', context.fieldStatus);

    this.logger.log(`Workbook built with ${workbook.SheetNames.length} sheet(s)`);
    return workbook;
  }

  async run(
    dto: MigrationRunRequestDto,
    mode: MigrationMode,
    actorUserId: string,
  ): Promise<{ filename: string; buffer: Buffer; summary: MigrationSummary }> {
    if (!dto.selectedTables || dto.selectedTables.length === 0) {
      throw new BadRequestException('Please select at least one legacy table before running migration');
    }
    const context = this.createContext(dto, mode, actorUserId);
    this.activeContext = context;
    this.logger.log(`Migration run started mode=${mode} actor=${actorUserId} selectedTables=${dto.selectedTables.join(',')}`);

    try {
      await this.withTargetDatabase(dto, async targetDataSource => {
        await this.withLegacyConnections(dto, async pools => {
          const sourcePool = dto.oldTransactionConnection ? pools.transaction : pools.master;
          const selectedSet = new Set(context.expandedTables);
          this.logger.log(`Expanded migration tables: ${context.expandedTables.join(', ')}`);
          this.logger.log(`[target-db] using ${this.connectionSummary(dto.currentMasterConnection)} for data writes`);
          await this.ensureFrontendMenuCatalog(context);
          await this.ensureBootstrapAdminUser(pools.master, context);
          this.logger.log(
            `[bootstrap] adminUserId=${context.bootstrapAdminUserId ?? 'n/a'} adminRoleId=${context.bootstrapAdminRoleId ?? 'n/a'} sourceOldId=${String(context.bootstrapAdminSourceOldId ?? '')}`,
          );
          const taskOrder: InternalTask[] = [
            'company',
            'currency',
            'branch',
            'counter',
            'user',
            'role',
            'branchCounterLinks',
            'branchUserLinks',
            'counterUserLinks',
            'userRoleLinks',
          ];

          for (const task of taskOrder) {
            if (!selectedSet.has(task) && !this.shouldRunImplicitTask(task, selectedSet)) {
              continue;
            }

            switch (task) {
              case 'company':
                await this.processCompanies(pools.master, context);
                break;
              case 'currency':
                await this.processCurrencies(sourcePool, context);
                break;
              case 'branch':
                await this.processBranches(sourcePool, context);
                break;
              case 'counter':
                await this.processCounters(sourcePool, context);
                break;
              case 'user':
              case 'role':
                await this.processUsers(sourcePool, context);
                break;
              case 'branchCounterLinks':
                await this.processBranchCounterLinks(sourcePool, context);
                break;
              case 'branchUserLinks':
                await this.processBranchUserLinks(sourcePool, context);
                break;
              case 'counterUserLinks':
                await this.processCounterUserLinks(sourcePool, context);
                break;
              case 'userRoleLinks':
                break;
            }
          }

          await this.flushUserRoleAssignments(context);
          context.summary.tables = context.tableResults.length;
        });
      });

      const workbook = this.buildWorkbook(context);
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      const suffix = mode === 'mock' ? 'mock' : 'real';
      const filename = `migration-${suffix === 'mock' ? 'soft-run' : suffix}-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
      this.logger.log(
        `Migration run finished mode=${mode} rowsScanned=${context.summary.rowsScanned} rowsInserted=${context.summary.rowsInserted} rowsSkipped=${context.summary.rowsSkipped} rowsFailed=${context.summary.rowsFailed} filename=${filename}`,
      );

      return { filename, buffer, summary: context.summary };
    } finally {
      this.logger.log(`Migration context cleared for mode=${mode}`);
      this.activeContext = null;
    }
  }

  private shouldRunImplicitTask(task: InternalTask, selectedSet: Set<string>): boolean {
    // If any selected table implies this task, allow it to run.
    if (task === 'company' && [...selectedSet].some(sel => TABLE_DEPENDENCIES[sel]?.includes('company'))) return true;
    if (task === 'currency' && [...selectedSet].some(sel => TABLE_DEPENDENCIES[sel]?.includes('currency'))) return true;
    if (task === 'branch' && [...selectedSet].some(sel => TABLE_DEPENDENCIES[sel]?.includes('branch'))) return true;
    if (task === 'counter' && [...selectedSet].some(sel => TABLE_DEPENDENCIES[sel]?.includes('counter'))) return true;
    if (task === 'user' && [...selectedSet].some(sel => TABLE_DEPENDENCIES[sel]?.includes('user'))) return true;
    if (task === 'role' && [...selectedSet].some(sel => TABLE_DEPENDENCIES[sel]?.includes('role'))) return true;
    if (task === 'branchCounterLinks' && [...selectedSet].some(sel => TABLE_DEPENDENCIES[sel]?.includes('branchCounterLinks'))) return true;
    if (task === 'branchUserLinks' && [...selectedSet].some(sel => TABLE_DEPENDENCIES[sel]?.includes('branchUserLinks'))) return true;
    if (task === 'counterUserLinks' && [...selectedSet].some(sel => TABLE_DEPENDENCIES[sel]?.includes('counterUserLinks'))) return true;
    if (task === 'userRoleLinks' && [...selectedSet].some(sel => TABLE_DEPENDENCIES[sel]?.includes('userRoleLinks'))) return true;
    return false;
  }
}
