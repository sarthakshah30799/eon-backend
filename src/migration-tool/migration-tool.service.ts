import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as mssql from 'mssql';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';
import { MigrationRunRequestDto } from './dto/migration-run-request.dto';
import { Company } from '../company/company.entity';
import { Branch } from '../branches/branch.entity';
import { Counter } from '../counters/counter.entity';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../user-roles/user-role.entity';

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
}

const TEMP_INITIAL_PASSWORD = 'Temp@1234';

const TABLE_DEPENDENCIES: Record<string, InternalTask[]> = {
  company: ['company'],
  mstcompanyrecord: ['company'],
  branches: ['company', 'branch'],
  mstcompany: ['company', 'branch'],
  counters: ['company', 'branch', 'counter', 'branchCounterLinks'],
  mstcounter: ['company', 'branch', 'counter', 'branchCounterLinks'],
  users: ['company', 'branch', 'counter', 'user', 'role', 'branchUserLinks', 'counterUserLinks', 'branchCounterLinks'],
  mstuser: ['company', 'branch', 'counter', 'user', 'role', 'branchUserLinks', 'counterUserLinks', 'branchCounterLinks'],
  roles: ['company', 'branch', 'counter', 'user', 'role', 'branchUserLinks', 'counterUserLinks', 'branchCounterLinks'],
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

@Injectable()
export class MigrationToolService {
  private readonly logger = new Logger(MigrationToolService.name);
  private activeContext: MigrationContext | null = null;

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
    private readonly dataSource: DataSource,
  ) {}

  private get companyMap() {
    return this.activeContext?.companyMap ?? new Map<string, string>();
  }

  private get branchMap() {
    return this.activeContext?.branchMap ?? new Map<string, string>();
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

  private buildSourceConfig(dto: MigrationRunRequestDto): MigrationConnectionConfig {
    if (dto.connectionMode === 'string') {
      if (!dto.connectionString?.trim()) {
        throw new BadRequestException('Connection string is required');
      }
      return { connectionString: dto.connectionString.trim() };
    }

    if (!dto.host?.trim() || !dto.username?.trim() || !dto.password?.trim() || !dto.database?.trim()) {
      throw new BadRequestException(
        'Host, port, username, password, and database are required in options mode',
      );
    }

    return {
      server: dto.host.trim(),
      port: dto.port ?? 1433,
      user: dto.username.trim(),
      password: dto.password,
      database: dto.database.trim(),
      options: {
        encrypt: dto.ssl === true,
        trustServerCertificate: dto.ssl !== true,
      },
    };
  }

  private async withSourceConnection<T>(
    dto: MigrationRunRequestDto,
    handler: (pool: mssql.ConnectionPool) => Promise<T>,
  ): Promise<T> {
    const config = this.buildSourceConfig(dto);
    const pool = new mssql.ConnectionPool(config as mssql.config);

    try {
      await pool.connect();
      return await handler(pool);
    } finally {
      await pool.close().catch(() => undefined);
    }
  }

  async verifyConnection(dto: MigrationRunRequestDto) {
    return this.withSourceConnection(dto, async pool => {
      const result = await pool.request().query('SELECT 1 AS ok');
      return {
        verified: Array.isArray(result.recordset) && result.recordset.length > 0,
        message: 'Source database connection verified successfully.',
      };
    });
  }

  private createContext(
    dto: MigrationRunRequestDto,
    mode: MigrationMode,
    actorUserId: string,
  ): MigrationContext {
    const expandedTables = this.expandSelectedTables(dto.selectedTables);
    return {
      mode,
      actorUserId,
      selectedTables: dto.selectedTables,
      expandedTables,
      sourceConnection: dto.connectionMode,
      summary: {
        tables: 0,
        rowsScanned: 0,
        rowsInserted: 0,
        rowsSkipped: 0,
        rowsFailed: 0,
        transformations: 0,
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
    const query = `SELECT * FROM ${escapeIdentifier(tableName)}`;
    const result = await pool.request().query(query);
    return result.recordset ?? [];
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

  private async resolveCompany(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const oldId = row.nCompID ?? row.ncompid ?? row.id ?? row.ID;
    const lookupKey = toNullableString(row.vCompanyName) || `company-${oldId}`;
    const targetTable = 'company';

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
    const existing = await this.companyRepository.findOne({ where: [{ panNo }, { name }] });

    if (existing) {
      this.companyMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: 'mstcompanyrecord',
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      return { id: existing.id, created: false, sourceId: oldId, targetTable, lookupKey };
    }

      const company = this.companyRepository.create({
        name,
        shortCode: toNullableString(row.vBranchCode),
        formerlyKnownName: toNullableString(row.VCOMPANYNAME2),
        cinNo: toNullableString(row.vRBIName),
        panNo,
        fxRegNo: toNullableString(row.VRBILICENCENUMBER),
        fxRegDate: toNullableDate(row.FROMDATE),
        fromDate: toNullableDate(row.FROMDATE),
        toDate: toNullableDate(row.TODATE),
        logo: toNullableString(row.LOGOPATH),
        aeonLicNo: toNullableString(row.VRBILICENCENUMBER),
        website: null,
        email: null,
        createdBy: context.actorUserId,
        updatedBy: context.actorUserId,
        deletedAt: null,
        deletedBy: null,
      });

    if (context.mode === 'real') {
      const saved = await this.companyRepository.save(company);
      this.companyMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: 'mstcompanyrecord',
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      return { id: saved.id, created: true, sourceId: oldId, targetTable, lookupKey };
    }

    const mockId = `mock-company-${oldId ?? randomUUID()}`;
    this.companyMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: 'mstcompanyrecord',
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    return { id: mockId, created: true, sourceId: oldId, targetTable, lookupKey };
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

  private async resolveBranch(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const oldId = row.nBranchID ?? row.nbranchid ?? row.id ?? row.ID;
    const lookupKey = toNullableString(row.vBranchCode) || `branch-${oldId}`;
    const targetTable = 'branches';

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
    const existing = await this.branchRepository.findOne({
      where: [
        { code: transformedCode.value },
        { branchNumber },
      ],
    });

    if (existing) {
      this.branchMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: 'mstcompany',
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      return { id: existing.id, created: false, sourceId: oldId, targetTable, lookupKey };
    }

    const branch = this.branchRepository.create({
      company: companyId ? ({ id: companyId } as Company) : null,
      code: transformedCode.value,
      name: toStringOrFallback(row.vLocation || row.vCity || row.vBranchCode, `Branch ${oldId}`),
      branchNumber,
      address1: toStringOrFallback(row.vAddress1, 'UNKNOWN'),
      address2: toNullableString(row.vAddress2),
      address3: toNullableString(row.vAddress3),
      city: toStringOrFallback(row.vCity, 'UNKNOWN'),
      gstState: toNullableString(row.vLocation),
      pinCode: toStringOrFallback(row.vPinCode, '000000'),
      gstNo: toNullableString(row.vServiceTaxRegNo),
      fxRegNo: toNullableString(row.vRBILicenseNo),
      fxRegDate: toNullableDate(row.dRBIRegDate),
      contactName: toNullableString(row.vContactPeron),
      contactNo: toNullableString(row.vContactPeronNo || row.vTellNo1),
      branchEmail: toNullableString(row.vEmailID),
      aeonBranchLic: toNullableString(row.vRBILicenseNo),
      locationType: null as any,
      cashHolding: toNullableNumber(row.nCashLimit),
      cashHoldingTemp: toNullableNumber(row.ntempCashLimit),
      currHolding: toNullableNumber(row.nCurrencyLimit),
      currHoldingTemp: toNullableNumber(row.ntempCurrencyLimit),
      isHeadOffice: toBoolean(row.IsHubBranch) || transformedCode.value === 'HO',
      isActive: toBoolean(row.bActive),
      createdBy: context.actorUserId,
      updatedBy: context.actorUserId,
      deletedAt: null,
      deletedBy: null,
    });

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
      const saved = await this.branchRepository.save(branch);
      this.branchMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: 'mstcompany',
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      return { id: saved.id, created: true, sourceId: oldId, targetTable, lookupKey };
    }

    const mockId = `mock-branch-${oldId ?? randomUUID()}`;
    this.branchMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: 'mstcompany',
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    return { id: mockId, created: true, sourceId: oldId, targetTable, lookupKey };
  }

  private async resolveCounter(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const oldId = row.nCounterId ?? row.ncounterid ?? row.id ?? row.ID;
    const lookupKey = toNullableString(row.vCounterId) || toNullableString(row.vCounterName) || `counter-${oldId}`;
    const targetTable = 'counters';

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
    const counterNo = toNullableNumber(row.vCounterId) ?? toNullableNumber(row.nCounterId) ?? 1;
    const existing = await this.counterRepository.findOne({
      where: [
        { counterNo, name: toStringOrFallback(row.vCounterName || row.vDescription, `Counter ${oldId}`) },
      ],
    });

    if (existing) {
      this.counterMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: 'mstcounter',
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      return { id: existing.id, created: false, sourceId: oldId, targetTable, lookupKey };
    }

    const counter = this.counterRepository.create({
      branch: branchId ? ({ id: branchId } as Branch) : null,
      counterNo,
      name: toStringOrFallback(row.vCounterName || row.vDescription, `Counter ${oldId}`),
      isActive: toBoolean(row.bIsActive),
      isRetail: false,
      isBulk: false,
      isCombine: false,
      createdBy: context.actorUserId,
      updatedBy: context.actorUserId,
      deletedAt: null,
      deletedBy: null,
    });

    if (context.mode === 'real') {
      const saved = await this.counterRepository.save(counter);
      this.counterMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: 'mstcounter',
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      return { id: saved.id, created: true, sourceId: oldId, targetTable, lookupKey };
    }

    const mockId = `mock-counter-${oldId ?? randomUUID()}`;
    this.counterMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: 'mstcounter',
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    return { id: mockId, created: true, sourceId: oldId, targetTable, lookupKey };
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

  private async resolveUserRoleBundle(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const oldId = row.nUserID ?? row.nuserid ?? row.id ?? row.ID;
    const lookupKey = toNullableString(row.vUID) || `user-${oldId}`;
    const targetTable = 'roles';
    const roleCode = `OLD_${normalizeCode(toStringOrFallback(row.vUID, String(oldId)))}`;

    if (this.roleMap.has(String(oldId))) {
      return {
        id: this.roleMap.get(String(oldId))!,
        created: false,
        sourceId: oldId,
        targetTable,
        lookupKey,
      };
    }

    const existing = await this.roleRepository.findOne({ where: { code: roleCode } });
    if (existing) {
      this.roleMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: 'mstuser',
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      return { id: existing.id, created: false, sourceId: oldId, targetTable, lookupKey };
    }

    const role = this.roleRepository.create({
      code: roleCode,
      name: toStringOrFallback(row.vName, roleCode),
      ...this.roleFlagsFromUserRow(row),
      createdBy: context.actorUserId,
      updatedBy: context.actorUserId,
      deletedAt: null,
      deletedBy: null,
    });

    if (context.mode === 'real') {
      const saved = await this.roleRepository.save(role);
      this.roleMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: 'mstuser',
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      return { id: saved.id, created: true, sourceId: oldId, targetTable, lookupKey };
    }

    const mockId = `mock-role-${oldId ?? randomUUID()}`;
    this.roleMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: 'mstuser',
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    return { id: mockId, created: true, sourceId: oldId, targetTable, lookupKey };
  }

  private async resolveUser(
    row: SourceRow,
    context: MigrationContext,
  ): Promise<ResolvedRecord> {
    const oldId = row.nUserID ?? row.nuserid ?? row.id ?? row.ID;
    const lookupKey = toNullableString(row.vUID) || `user-${oldId}`;
    const targetTable = 'users';

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
    const existing = await this.userRepository.findOne({ where: [{ code }, { email }] });

    if (existing) {
      this.userMap.set(String(oldId), existing.id);
      this.addIdMap(context, {
        oldTable: 'mstuser',
        oldId,
        newTable: targetTable,
        newUuid: existing.id,
        lookupKey,
      });
      return { id: existing.id, created: false, sourceId: oldId, targetTable, lookupKey };
    }

    const hashedPassword = await bcrypt.hash(TEMP_INITIAL_PASSWORD, 10);
    const user = this.userRepository.create({
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
      createdBy: context.actorUserId,
      updatedBy: context.actorUserId,
      deletedAt: null,
      deletedBy: null,
    });

    if (context.mode === 'real') {
      const saved = await this.userRepository.save(user);
      this.userMap.set(String(oldId), saved.id);
      this.addIdMap(context, {
        oldTable: 'mstuser',
        oldId,
        newTable: targetTable,
        newUuid: saved.id,
        lookupKey,
      });
      return { id: saved.id, created: true, sourceId: oldId, targetTable, lookupKey };
    }

    const mockId = `mock-user-${oldId ?? randomUUID()}`;
    this.userMap.set(String(oldId), mockId);
    this.addIdMap(context, {
      oldTable: 'mstuser',
      oldId,
      newTable: targetTable,
      newUuid: mockId,
      lookupKey,
    });
    return { id: mockId, created: true, sourceId: oldId, targetTable, lookupKey };
  }

  private async processCompanies(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'company')) {
      return;
    }

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
          note: resolved.created ? 'Company created or mapped' : 'Company reused from target db',
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
  }

  private async processBranches(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'branch')) {
      return;
    }

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
          note: resolved.created ? 'Branch created or mapped' : 'Branch reused from target db',
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
  }

  private async processCounters(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'counter')) {
      return;
    }

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
          sourcePrimaryKey: String(row.nCounterId ?? row.id ?? row.ID ?? ''),
          targetId: resolved.id,
          status: resolved.created ? 'inserted' : 'reused',
          note: resolved.created ? 'Counter created or mapped' : 'Counter reused from target db',
        });
        if (resolved.created) {
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        this.addError(context, {
          sourceTable: 'mstcounter',
          sourceRowIdentifier: String(row.nCounterId ?? row.id ?? row.ID ?? ''),
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
  }

  private async processUsers(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'user') && !this.isTaskIncluded(context, 'role')) {
      return;
    }

    const rows = await this.readSourceRows(pool, 'mstuser');
    this.ensureSourceRows(context, 'user', rows);
    let insertedUsers = 0;
    let insertedRoles = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      try {
        const userResolved = await this.resolveUser(row, context);
        const roleResolved = await this.resolveUserRoleBundle(row, context);
        context.userRows.push(row);

        this.addRowResult(context, {
          sourceTable: 'mstuser',
          sourcePrimaryKey: String(row.nUserID ?? row.id ?? row.ID ?? ''),
          targetId: userResolved.id,
          status: userResolved.created ? 'inserted' : 'reused',
          note: userResolved.created ? 'User created or mapped' : 'User reused from target db',
        });
        this.addRowResult(context, {
          sourceTable: 'mstuser',
          sourcePrimaryKey: String(row.nUserID ?? row.id ?? row.ID ?? ''),
          targetId: roleResolved.id,
          status: roleResolved.created ? 'inserted' : 'reused',
          note: roleResolved.created ? 'Role created from user access bundle' : 'Role reused from target db',
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
  }

  private async ensureBranchCounterRelation(
    row: SourceRow,
    context: MigrationContext,
    sourceTable: string,
  ) {
    const branchOldId = row.nBranchID ?? row.nbranchid;
    const counterOldId = row.nCounterID ?? row.ncounterid;
    if (!branchOldId || !counterOldId) {
      return null;
    }
    const branchId = this.branchMap.get(String(branchOldId));
    const counterId = this.counterMap.get(String(counterOldId));
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

    return { branchId, counterId };
  }

  private async processBranchCounterLinks(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'branchCounterLinks')) {
      return;
    }

    const rows = await this.readSourceRows(pool, 'mstBranchCounterLink');
    this.ensureSourceRows(context, 'branchCounterLinks', rows);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      try {
        const relation = await this.ensureBranchCounterRelation(row, context, 'mstBranchCounterLink');
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
  }

  private async processBranchUserLinks(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'branchUserLinks')) {
      return;
    }

    const rows = await this.readSourceRows(pool, 'mstBranchUserLink');
    this.ensureSourceRows(context, 'branchUserLinks', rows);
    context.branchUserLinks = rows;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const branchOldId = row.nBranchID ?? row.nbranchid;
      const userOldId = row.nUserID ?? row.nuserid;
      const branchId = branchOldId ? this.branchMap.get(String(branchOldId)) : undefined;
      const userId = userOldId ? this.userMap.get(String(userOldId)) : undefined;

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
  }

  private async processCounterUserLinks(pool: mssql.ConnectionPool, context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'counterUserLinks')) {
      return;
    }

    const rows = await this.readSourceRows(pool, 'mstCounterUserLink');
    this.ensureSourceRows(context, 'counterUserLinks', rows);
    context.counterUserLinks = rows;

    for (const row of rows) {
      context.summary.rowsScanned += 1;
      const branchOldId = row.nBranchID ?? row.nbranchid;
      const counterOldId = row.nCounterID ?? row.ncounterid;
      const userOldId = row.nUserID ?? row.nuserid;
      const branchId = branchOldId ? this.branchMap.get(String(branchOldId)) : undefined;
      const counterId = counterOldId ? this.counterMap.get(String(counterOldId)) : undefined;
      const userId = userOldId ? this.userMap.get(String(userOldId)) : undefined;

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
  }

  private getBranchCounterForBranch(branchId: string, context: MigrationContext): string | null {
    const mainCounter = context.branchMainCounter.get(branchId);
    if (mainCounter) return mainCounter;
    const counters = context.branchCounters.get(branchId);
    return counters && counters.length > 0 ? counters[0] : null;
  }

  private async flushUserRoleAssignments(context: MigrationContext): Promise<void> {
    if (!this.isTaskIncluded(context, 'userRoleLinks')) {
      return;
    }

    const uniqueAssignments = new Map<string, UserRole>();
    const actorId = context.actorUserId;

    const addAssignment = (userId: string, roleId: string, branchId: string, counterId: string, note: string) => {
      const key = `${userId}:${roleId}:${branchId}:${counterId}`;
      if (uniqueAssignments.has(key)) {
        return;
      }

      const entity = this.userRoleRepository.create({
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
      const roleId = context.roleMap.values().next().value as string | undefined;
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
      const roleId = context.roleMap.get(String(oldUserId)) ?? context.roleMap.values().next().value;
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
      return;
    }

    if (context.mode === 'real') {
      await this.userRoleRepository.save(entities);
    }
  }

  private buildWorkbook(context: MigrationContext) {
    const workbook = XLSX.utils.book_new();
    const addSheet = (name: string, rows: ReportRow[]) => {
      const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ message: 'No rows' }]);
      XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
    };

    addSheet('Summary', [
      {
        mode: context.mode,
        connectionMode: context.sourceConnection,
        selectedTables: context.selectedTables.join(', '),
        expandedTables: context.expandedTables.join(', '),
        sharedAuditColumns: 'createdAt, createdBy, updatedAt, updatedBy, deletedAt, deletedBy',
        tables: context.summary.tables,
        rowsScanned: context.summary.rowsScanned,
        rowsInserted: context.summary.rowsInserted,
        rowsSkipped: context.summary.rowsSkipped,
        rowsFailed: context.summary.rowsFailed,
        transformations: context.summary.transformations,
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

    return workbook;
  }

  async run(
    dto: MigrationRunRequestDto,
    mode: MigrationMode,
    actorUserId: string,
  ): Promise<{ filename: string; buffer: Buffer; summary: MigrationSummary }> {
    const context = this.createContext(dto, mode, actorUserId);
    this.activeContext = context;

    try {
      await this.withSourceConnection(dto, async pool => {
        const selectedSet = new Set(context.expandedTables);
        const taskOrder: InternalTask[] = [
          'company',
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
              await this.processCompanies(pool, context);
              break;
            case 'branch':
              await this.processBranches(pool, context);
              break;
            case 'counter':
              await this.processCounters(pool, context);
              break;
            case 'user':
            case 'role':
              await this.processUsers(pool, context);
              break;
            case 'branchCounterLinks':
              await this.processBranchCounterLinks(pool, context);
              break;
            case 'branchUserLinks':
              await this.processBranchUserLinks(pool, context);
              break;
            case 'counterUserLinks':
              await this.processCounterUserLinks(pool, context);
              break;
            case 'userRoleLinks':
              break;
          }
        }

        await this.flushUserRoleAssignments(context);
        context.summary.tables = context.tableResults.length;
      });

      const workbook = this.buildWorkbook(context);
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      const suffix = mode === 'mock' ? 'mock' : 'real';
      const filename = `migration-${suffix}-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;

      return { filename, buffer, summary: context.summary };
    } finally {
      this.activeContext = null;
    }
  }

  private shouldRunImplicitTask(task: InternalTask, selectedSet: Set<string>): boolean {
    // If any selected table implies this task, allow it to run.
    if (task === 'company' && [...selectedSet].some(sel => TABLE_DEPENDENCIES[sel]?.includes('company'))) return true;
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
