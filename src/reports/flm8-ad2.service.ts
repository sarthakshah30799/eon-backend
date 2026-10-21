import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { Currency } from "../currencies/currency.entity";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import {
  Flm8Ad2QueryDto,
  Flm8Ad2ReportFormat,
} from "./dto/flm8-ad2-query.dto";
import { resolveFlmAccessibleBranchIds } from "./flm-report-access.helpers";
import {
  buildFlm8Ad2CurrencyReport,
  buildFlm8Ad2Export,
  buildFlm8Ad2PartyReport,
  buildFlm8Ad2PurposeReport,
  loadFlm8Ad2CurrencyCatalog,
  loadFlm8Ad2CurrencyRows,
  loadFlm8Ad2PartyRows,
  loadFlm8Ad2PurposeMeta,
  loadFlm8Ad2PurposeRows,
  resolveFlm8Ad2DateRange,
} from "./flm8-ad2.helpers";

@Injectable()
export class Flm8Ad2Service {
  constructor(
    @InjectDataSource()
    private readonly database: DataSource,
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
  ) {}

  private async loadApConnectLabels(currencyIds: string[]) {
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
            : currencyName || countryName || currency.currencyCode;
        return [currency.id, label];
      }),
    );
  }

  async buildReport(query: Flm8Ad2QueryDto, session?: SessionContext) {
    const { startDate, endDateExclusive } = resolveFlm8Ad2DateRange(
      query.startDate,
      query.endDate,
    );
    const startLabel = query.startDate.slice(0, 10);
    const endLabel = query.endDate.slice(0, 10);
    const branchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );
    const reportFormat = query.reportFormat ?? Flm8Ad2ReportFormat.CURRENCY;
    const apConnect = Boolean(query.apConnect);
    const currencies = await loadFlm8Ad2CurrencyCatalog(this.database);
    const options = {
      startDate: startLabel,
      endDate: endLabel,
      apConnect,
      currencies,
    };

    if (reportFormat === Flm8Ad2ReportFormat.PURPOSE) {
      const sourceRows = await loadFlm8Ad2PurposeRows(this.database2, {
        startDate,
        endDateExclusive,
        branchIds,
      });
      const purposeMeta = await loadFlm8Ad2PurposeMeta(this.database);
      const currencyLabelById = apConnect
        ? await this.loadApConnectLabels([
            ...currencies.map((currency) => currency.id),
            ...sourceRows.map((row) => String(row.currencyId ?? "")),
          ])
        : undefined;
      return buildFlm8Ad2PurposeReport(sourceRows, purposeMeta, {
        ...options,
        currencyLabelById,
      });
    }

    if (reportFormat === Flm8Ad2ReportFormat.PARTY) {
      const rows = await loadFlm8Ad2PartyRows(this.database, {
        startDate,
        endDateExclusive,
        branchIds,
      });
      return buildFlm8Ad2PartyReport(rows, options);
    }

    const sourceRows = await loadFlm8Ad2CurrencyRows(this.database2, {
      startDate,
      endDateExclusive,
      branchIds,
    });
    const currencyLabelById = apConnect
      ? await this.loadApConnectLabels([
          ...currencies.map((currency) => currency.id),
          ...sourceRows.map((row) => String(row.currencyId ?? "")),
        ])
      : undefined;

    return buildFlm8Ad2CurrencyReport(sourceRows, {
      ...options,
      currencyLabelById,
    });
  }

  async buildExport(
    query: Flm8Ad2QueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    return buildFlm8Ad2Export(report, format);
  }
}
