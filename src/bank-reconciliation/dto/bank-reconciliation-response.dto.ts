import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BankReconciliationSourceType } from "./bank-reconciliation-clear.dto";

export const BankReconciliationSection = {
  RECEIVED_NOT_DEPOSITED: "RECEIVED_NOT_DEPOSITED",
  ISSUED_NOT_PRESENTED: "ISSUED_NOT_PRESENTED",
} as const;

export type BankReconciliationSection =
  (typeof BankReconciliationSection)[keyof typeof BankReconciliationSection];

export class BankReconciliationRowDto {
  @ApiProperty({ enum: Object.values(BankReconciliationSourceType) })
  sourceType!: string;

  @ApiProperty()
  sourceId!: string;

  @ApiProperty({ enum: Object.values(BankReconciliationSection) })
  section!: string;

  @ApiProperty()
  branchCode!: string;

  @ApiProperty()
  docType!: string;

  @ApiProperty()
  docNumber!: string;

  @ApiProperty()
  docDate!: string;

  @ApiProperty()
  passengerName!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  chequeNo!: string;

  @ApiProperty()
  chequeDate!: string;

  @ApiProperty()
  bankCode!: string;

  @ApiPropertyOptional({ nullable: true })
  bankDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reconciliationRemarks!: string | null;

  @ApiProperty()
  isDishonored!: boolean;

  @ApiPropertyOptional({ nullable: true })
  reversalNumber!: string | null;
}

export class BankReconciliationResponseDto {
  @ApiProperty({ type: [BankReconciliationRowDto] })
  receivedNotDeposited!: BankReconciliationRowDto[];

  @ApiProperty({ type: [BankReconciliationRowDto] })
  issuedNotPresented!: BankReconciliationRowDto[];
}

export class BankReconciliationClearResultDto {
  @ApiProperty()
  updated!: number;
}
