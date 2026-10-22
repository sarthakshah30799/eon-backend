import { TtReportLayout } from "./dto/tt-report-query.dto";

export interface TtReportFormatColumn {
  key: string;
  label: string;
}

export interface TtReportFormat {
  filePrefix: string;
  sheetName: string;
  emptyMessage: string;
  issuerName?: string;
  columns: TtReportFormatColumn[];
}

const column = (key: string, label: string): TtReportFormatColumn => ({
  key,
  label,
});

const INDUS_COLUMNS: TtReportFormatColumn[] = [
  column("customerReference", "Customer Reference"),
  column("tranDate", "Tran Date"),
  column("mode", "Mode"),
  column("ddNumber", "DD Number"),
  column("curr", "Curr"),
  column("amount", "Amount"),
  column("forwardBookingRef", "Forward Booking Ref"),
  column("remitterName", "Remitter Name"),
  column("remitterPan", "Remitter PAN"),
  column("remitterAddress", "Remitter Address"),
  column("remitterCity", "Remitter City"),
  column("remitterCountry", "Remitter Country"),
  column("beneficiaryName", "Beneficiary Name"),
  column("beneficiaryAddress", "Beneficiary Address"),
  column("beneficiaryCity", "Beneficiary City"),
  column("beneficiaryCountry", "Beneficiary Country"),
  column("beneficiaryAccount", "Beneficiary Ac No./ IBAN Code"),
  column("beneBankName", "Bene Bank Name"),
  column("beneBankAddress", "Bene Bank Address"),
  column("beneBankWire", "Bene Bank SORT/BSB/ABA/TRANSIT/FED WIRE CODE"),
  column("beneBankSwift", "Bene Bank SWIFT Code"),
  column("subPurposeCode", "Sub Purpose Code"),
  column("additionalDetails", "Additional Details (For Education/Tour Etc)"),
  column("fbCharges", "FB Charges"),
  column("intermBankName", "Interm Bank Name"),
  column("intermAddress", "interm Address"),
  column("intermBic", "interm BIC Code"),
  column("intermWire", "Interm Bank SORT/BSB/ABA/TRANSIT/FED WIRE CODE"),
  column("entityType", "Individual/Entity/Corporate"),
  column("remitterEmail", "Remitter Email"),
  column("remitterMobile", "Remitter Mobile"),
  column("dealNo", "Deal No"),
  column("dealAmount", "Amount"),
  column("beneUserIdentity", "Bene User Identity"),
  column("dob", "DOB"),
  column("relation", "Relation"),
  column("panHolderName", "Pan Holder Name"),
  column("panHolderPan", "Pan Holder Pan No"),
  column("panHolderDob", "Pan Holder DOB"),
  column("additionalField1", "Additional Field1"),
  column("additionalField2", "Additional Field2"),
  column("additionalField3", "Additional Field3"),
  column("download", "Download"),
];

const IDFC_COLUMNS: TtReportFormatColumn[] = [
  column("valueDate", "Value Date"),
  column("customerReference", "Customer Reference"),
  column("partnerBranchCode", "Partner Branch code"),
  column("tranDate", "Tran Date"),
  column("mode", "Mode"),
  column("remitterId", "Remitter Id"),
  column("curr", "Curr"),
  column("amount", "Amount"),
  column("rate", "Rate"),
  column("inr", "INR"),
  column("dealId", "Deal ID"),
  column("remitterFName", "Remitter FName"),
  column("remitterMName", "Remitter MName"),
  column("remitterLName", "Remitter LName"),
  column("remitterType", "Remitter Type"),
  column("remitterAddress", "Remitter Address"),
  column("remitterCity", "Remitter City"),
  column("remitterCountry", "Remitter Country"),
  column("remitterPan", "Remitter PAN"),
  column("beneficiaryFName", "Beneficiary FName"),
  column("beneficiaryMName", "Beneficiary MName"),
  column("beneficiaryLName", "Beneficiary LName"),
  column("beneficiaryType", "Beneficiary Type"),
  column("beneficiaryAddress", "Beneficiary Address"),
  column("beneCity", "Bene City"),
  column("beneCountry", "Bene Country"),
  column("beneficiaryAccount", "Beneficiary Ac No./IBAN Code"),
  column("beneBankName", "Bene Bank Name"),
  column("beneBankAddress", "Bene Bank Address"),
  column("beneBankCountry", "Bene Bank Country"),
  column("beneBankSwift", "Bene Bank SWIFT Details"),
  column("beneBankSort", "Bene Bank SORT Code"),
  column("intermBankName", "Interm Bank Name"),
  column("intermAddress", "interm Address"),
  column("intermBic", "interm BIC Code"),
  column("intermBankCountry", "interm bank country"),
  column("intermSortCode", "interm sort code"),
  column("purposeCode", "Purpose code"),
  column("educationalDetails", "Educational Details"),
  column("correspondentBankCharges", "Correspondent Bank Charges"),
  column("fbCharges", "FB Charges"),
  column("merchantUserIdentity", "Merchant User Identity"),
  column("additionalField1", "Additional Field 1"),
  column("additionalField2", "Additional Field 2"),
  column("additionalField3", "Additional Field 3"),
  column("additionalField4", "Additional Field 4"),
  column("additionalField5", "Additional Field 5"),
  column("additionalField6", "Additional Field 6"),
  column("additionalField7", "Additional Field 7"),
  column("additionalField8", "Additional Field 8"),
  column("additionalField9", "Additional Field 9"),
  column("additionalField10", "Additional Field 10"),
  column("additionalField11", "Additional Field 11"),
  column("additionalField12", "Additional Field 12"),
  column("additionalField13", "Additional Field 13"),
  column("additionalField14", "Additional Field 14"),
  column("additionalField15", "Additional Field 15"),
  column("download", "Download"),
];

export const TT_REPORT_FORMATS: Record<TtReportLayout, TtReportFormat> = {
  [TtReportLayout.INDUS]: {
    filePrefix: "indus-tt-report",
    sheetName: "INDUS TT",
    emptyMessage: "No TT transactions in this date range",
    columns: INDUS_COLUMNS,
  },
  [TtReportLayout.IDFC]: {
    filePrefix: "idfc-tt-report",
    sheetName: "IDFC TT",
    emptyMessage: "No IDFC TT transactions in this date range",
    issuerName: "IDFC",
    columns: IDFC_COLUMNS,
  },
  [TtReportLayout.ICICI]: {
    filePrefix: "icici-tt-report",
    sheetName: "ICICI TT",
    emptyMessage: "Coming soon",
    issuerName: "ICICI",
    columns: [],
  },
  [TtReportLayout.YES]: {
    filePrefix: "yes-tt-report",
    sheetName: "YES TT",
    emptyMessage: "Coming soon",
    issuerName: "YES",
    columns: [],
  },
};

export const projectTtReportRow = (
  fields: Record<string, string>,
  columns: TtReportFormatColumn[],
): Record<string, string> => {
  const row: Record<string, string> = {
    transactionId: fields.transactionId ?? "",
  };
  columns.forEach((column) => {
    row[column.key] = fields[column.key] ?? "";
  });
  return row;
};
