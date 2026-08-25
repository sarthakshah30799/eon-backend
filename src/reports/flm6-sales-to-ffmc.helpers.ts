import { DataSource } from "typeorm";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { resolveFlm6ProfileSlugs } from "./flm-ffmc-profile.constants";
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

export const resolveFlm6DateRange = resolveFlm3DateRange;
export const loadFlm6PaymentRows = loadFlm3PaymentRows;
export const loadFlm6OtherDocumentRows = loadFlm3OtherDocumentRows;

export const loadFlm6ItemRows = (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    branchIds: string[];
    productId?: string;
    profileTypes?: string[];
  },
): Promise<Flm3ItemRow[]> =>
  loadFlmRegisterItemRows(
    database2,
    filters,
    resolveFlm6ProfileSlugs(filters.profileTypes),
  );

export const buildFlm6SalesToFfmc = (
  itemRows: Flm3ItemRow[],
  paymentRows: Parameters<typeof buildFlm3PurchaseFromPublic>[1],
  otherDocumentRows: Parameters<typeof buildFlm3PurchaseFromPublic>[2],
  view?: string,
) =>
  buildFlm3PurchaseFromPublic(itemRows, paymentRows, otherDocumentRows, view, {
    includePanColumns: true,
  });

export const buildFlm6SalesToFfmcExport = (
  report: Flm3ReportResponse,
  format: CardSettlementReportFormat,
) => {
  const payload = buildFlm3PurchaseFromPublicExport(report, format);
  return {
    ...payload,
    filename:
      format === CardSettlementReportFormat.CSV
        ? "flm6-sales-to-ffmc.csv"
        : "flm6-sales-to-ffmc.xlsx",
  };
};
