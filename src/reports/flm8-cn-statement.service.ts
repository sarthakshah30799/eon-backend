import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { PurposeGroupService } from "../purpose/purpose-group.service";
import { PurposeGroupProfileType } from "../purpose/purpose.enums";
import { SessionContext } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import { Currency } from "../currencies/currency.entity";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { Flm8CnStatementQueryDto } from "./dto/flm8-cn-statement-query.dto";
import {
  FLM1_CURRENCY_COLUMN_COUNT_CODE,
  FLM1_DEFAULT_CURRENCY_COLUMNS,
  FLM1_MAX_CURRENCY_COLUMNS,
  FLM1_MIN_CURRENCY_COLUMNS,
  FLM1_REPORTS_SETTING_CATEGORY,
} from "./flm1-report.constants";
import {
  clampCurrencyColumnCount,
  type Flm1BranchMeta,
  type Flm1SaleGroup,
} from "./flm1-daily-cn-summary.helpers";
import {
  buildFlm8CnStatement,
  buildFlm8CnStatementExport,
  loadFlm8SourceRows,
  resolveFlm8DateRange,
} from "./flm8-cn-statement.helpers";

@Injectable()
export class Flm8CnStatementService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    private readonly additionalSettingService: AdditionalSettingService,
    private readonly purposeGroupService: PurposeGroupService,
  ) {}

  private isApConnectEnabled(query: Flm8CnStatementQueryDto) {
    return (
      query.profileType === PurposeGroupProfileType.AD && Boolean(query.apConnect)
    );
  }

  private async loadSaleGroups(
    profileType: Flm8CnStatementQueryDto["profileType"],
  ): Promise<Flm1SaleGroup[]> {
    const groups = await this.purposeGroupService.findAll({ profileType });
    return groups
      .slice()
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
      )
      .map((group) => ({
        id: group.id,
        title: group.title,
        purposeIds: group.purposes.map((purpose) => purpose.id),
        sortOrder: group.sortOrder,
      }));
  }

  private async loadApConnectCurrencyLabels(
    currencyIds: string[],
  ): Promise<Record<string, string>> {
    const uniqueIds = [...new Set(currencyIds.filter(Boolean))];
    if (!uniqueIds.length) {
      return {};
    }

    const currencies = await this.currencyRepository.find({
      where: { id: In(uniqueIds) },
      relations: { country: true },
    });

    return Object.fromEntries(
      currencies.map((currency) => {
        const currencyName = String(currency.currencyName ?? "").trim();
        const countryName = String(currency.country?.name ?? "").trim();
        const label =
          currencyName && countryName
            ? `${currencyName}(${countryName})`
            : currencyName || countryName || currency.currencyCode || currency.id;
        return [currency.id, label];
      }),
    );
  }

  async buildReport(query: Flm8CnStatementQueryDto, session?: SessionContext) {
    const { startDate, endDateExclusive } = resolveFlm8DateRange(
      query.startDate,
      query.endDate,
    );
    const startLabel = (query.startDate || startDate.toISOString().slice(0, 10)).slice(
      0,
      10,
    );
    const endLabel = (
      query.endDate ||
      query.startDate ||
      startLabel
    ).slice(0, 10);
    const resolvedBranchIds = await this.resolveAccessibleBranchIds(
      query.branchIds ?? [],
      session,
    );
    const currenciesPerBlock = await this.loadCurrencyColumnCount();
    const hasNoBranchAccess =
      !this.canSeeAllBranches(session) && resolvedBranchIds.length === 0;
    const saleGroups = await this.loadSaleGroups(query.profileType);
    const apConnect = this.isApConnectEnabled(query);

    if (hasNoBranchAccess) {
      return buildFlm8CnStatement([], {
        startDate: startLabel,
        endDate: endLabel,
        view: query.view,
        currenciesPerBlock,
        selectedBranches: [],
        saleGroups,
      });
    }

    const selectedBranches = await this.loadSelectedBranches(resolvedBranchIds);
    const sourceRows = await loadFlm8SourceRows(this.database2, {
      startDate,
      endDateExclusive,
      branchIds: resolvedBranchIds,
      productId: query.productId,
    });

    const currencyLabelById = apConnect
      ? await this.loadApConnectCurrencyLabels(
          sourceRows.map((row) => row.currencyId),
        )
      : undefined;

    return buildFlm8CnStatement(sourceRows, {
      startDate: startLabel,
      endDate: endLabel,
      view: query.view,
      currenciesPerBlock,
      selectedBranches,
      saleGroups,
      currencyLabelById,
    });
  }

  async buildExport(
    query: Flm8CnStatementQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    return buildFlm8CnStatementExport(report, format);
  }

  private canSeeAllBranches(session?: SessionContext) {
    return Boolean(session?.isAdmin || session?.isHo || session?.isHoStaff);
  }

  private async resolveAccessibleBranchIds(
    requestedBranchIds: string[],
    session?: SessionContext,
  ) {
    if (this.canSeeAllBranches(session)) {
      return requestedBranchIds;
    }

    const assignedBranchIds = await this.loadAssignedBranchIds(session?.userId);
    if (!assignedBranchIds.length) {
      return [];
    }

    if (!requestedBranchIds.length) {
      return assignedBranchIds;
    }

    const assignedBranchIdSet = new Set(assignedBranchIds);
    return requestedBranchIds.filter((branchId) => assignedBranchIdSet.has(branchId));
  }

  private async loadAssignedBranchIds(userId?: string | null) {
    if (!userId) {
      return [];
    }

    const assignments = await this.userRoleRepository.find({
      where: { user: { id: userId } },
      relations: { branch: true },
    });

    return [
      ...new Set(
        assignments
          .map((assignment) => assignment.branch?.id)
          .filter((branchId): branchId is string => Boolean(branchId)),
      ),
    ];
  }

  private async loadSelectedBranches(branchIds: string[]): Promise<Flm1BranchMeta[]> {
    if (!branchIds.length) {
      return [];
    }

    const branches = await this.branchRepository.find({
      where: { id: In(branchIds) },
      select: ["id", "code", "name"],
    });
    const labelById = new Map(
      branches.map((branch) => [
        branch.id,
        branch.code && branch.name
          ? `${branch.code} - ${branch.name}`
          : branch.name || branch.code || branch.id,
      ]),
    );

    return branchIds.map((id) => ({
      id,
      label: labelById.get(id) ?? id,
    }));
  }

  private async loadCurrencyColumnCount() {
    const stored = await this.additionalSettingService.getSettingNumberValue(
      FLM1_REPORTS_SETTING_CATEGORY,
      FLM1_CURRENCY_COLUMN_COUNT_CODE,
      FLM1_DEFAULT_CURRENCY_COLUMNS,
    );
    return clampCurrencyColumnCount(
      Math.min(FLM1_MAX_CURRENCY_COLUMNS, Math.max(FLM1_MIN_CURRENCY_COLUMNS, stored)),
    );
  }
}
