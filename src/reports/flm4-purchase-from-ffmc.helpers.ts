import { DataSource } from "typeorm";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { resolveFlm4ProfileFilter } from "./flm-ffmc-profile.constants";
import {
  buildFlm3PurchaseFromPublic,
  buildFlm3PurchaseFromPublicExport,
  loadFlm3OtherDocumentRows,
  loadFlm3PaymentRows,
  loadFlmRegisterItemRows,
  resolveFlm3DateRange,
  type Flm3ItemRow,
  type Flm3ReportResponse,
} from "./flm3-purchase-from-public.helpers";

export const resolveFlm4DateRange = resolveFlm3DateRange;
export const loadFlm4PaymentRows = loadFlm3PaymentRows;
export const loadFlm4OtherDocumentRows = loadFlm3OtherDocumentRows;
export const buildFlm4PurchaseFromFfmc = buildFlm3PurchaseFromPublic;

export const loadFlm4ItemRows = (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    branchIds: string[];
    productId?: string;
    profileTypes?: string[];
  },
): Promise<Flm3ItemRow[]> => {
  const { slugs, partyProfileTypes, slugOnlyFallbackSlugs } =
    resolveFlm4ProfileFilter(filters.profileTypes);
  return loadFlmRegisterItemRows(
    database2,
    {
      ...filters,
      partyProfileTypes,
      slugOnlyFallbackSlugs,
    },
    slugs,
  );
};


export const buildFlm4PurchaseFromFfmcExport = (
  report: Flm3ReportResponse,
  format: CardSettlementReportFormat,
) => {
  const payload = buildFlm3PurchaseFromPublicExport(report, format);
  return {
    ...payload,
    filename:
      format === CardSettlementReportFormat.CSV
        ? "flm4-purchase-from-ffmc.csv"
        : "flm4-purchase-from-ffmc.xlsx",
  };
};
