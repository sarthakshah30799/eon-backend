import { DataSource } from "typeorm";
import { TransactionTypeProfileEnum } from "../transactions/transactions.enums";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
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

export const resolveFlm5DateRange = resolveFlm3DateRange;
export const loadFlm5PaymentRows = loadFlm3PaymentRows;
export const loadFlm5OtherDocumentRows = loadFlm3OtherDocumentRows;

export const loadFlm5ItemRows = (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    branchIds: string[];
    productId?: string;
  },
): Promise<Flm3ItemRow[]> =>
  loadFlmRegisterItemRows(database2, filters, [
    TransactionTypeProfileEnum.SALE_CORPORATE_INDIVIDUAL,
  ]);

export const buildFlm5SalesToPublic = (
  itemRows: Flm3ItemRow[],
  paymentRows: Parameters<typeof buildFlm3PurchaseFromPublic>[1],
  otherDocumentRows: Parameters<typeof buildFlm3PurchaseFromPublic>[2],
  view?: string,
) =>
  buildFlm3PurchaseFromPublic(itemRows, paymentRows, otherDocumentRows, view, {
    includePanColumns: true,
  });

export const buildFlm5SalesToPublicExport = (
  report: Flm3ReportResponse,
  format: CardSettlementReportFormat,
) => {
  const payload = buildFlm3PurchaseFromPublicExport(report, format);
  return {
    ...payload,
    filename:
      format === CardSettlementReportFormat.CSV
        ? "flm5-sales-to-public.csv"
        : "flm5-sales-to-public.xlsx",
  };
};
