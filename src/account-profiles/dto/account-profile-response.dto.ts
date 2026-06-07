import { ApiProperty } from "@nestjs/swagger";
import { AccountProfile } from "../account-profile.entity";

export class AccountProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  divisionDept: string;

  @ApiProperty()
  accountCode: string;

  @ApiProperty()
  accountName: string;

  @ApiProperty({ nullable: true })
  accountType: string;

  @ApiProperty({ nullable: true })
  subLedger: string;

  @ApiProperty({ nullable: true })
  bankNature: string;

  @ApiProperty()
  currencyId: string;

  @ApiProperty({ required: false })
  currencyCode?: string;

  @ApiProperty()
  financialCodeId: string;

  @ApiProperty({ required: false })
  financialCode?: string;

  @ApiProperty({ nullable: true })
  financialSubProfileId: string;

  @ApiProperty({ required: false })
  financialSubCode?: string;

  @ApiProperty({ nullable: true })
  pettyCashExpenseId: string;

  @ApiProperty()
  zeroBalanceAtEod: boolean;

  @ApiProperty({ nullable: true })
  branchIdToTransfer: string;

  @ApiProperty({ nullable: true })
  mapToAccountId: string;

  @ApiProperty()
  doSale: boolean;

  @ApiProperty()
  doPurchase: boolean;

  @ApiProperty()
  doReceipt: boolean;

  @ApiProperty()
  doPayment: boolean;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  cmsBank: boolean;

  @ApiProperty()
  directRemittance: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: AccountProfile): AccountProfileResponseDto {
    const dto = new AccountProfileResponseDto();
    dto.id = entity.id;
    dto.divisionDept = entity.divisionDept;
    dto.accountCode = entity.accountCode;
    dto.accountName = entity.accountName;
    dto.accountType = entity.accountType;
    dto.subLedger = entity.subLedger;
    dto.bankNature = entity.bankNature;
    dto.currencyId = entity.currencyId;
    dto.currencyCode = entity.currency?.currencyCode;
    dto.financialCodeId = entity.financialCodeId;
    dto.financialCode = entity.financialCode?.financialCode;
    dto.financialSubProfileId = entity.financialSubProfileId;
    dto.financialSubCode = entity.financialSubProfile?.financialSubCode;
    dto.pettyCashExpenseId = entity.pettyCashExpenseId;
    dto.zeroBalanceAtEod = entity.zeroBalanceAtEod;
    dto.branchIdToTransfer = entity.branchIdToTransfer;
    dto.mapToAccountId = entity.mapToAccountId;
    dto.doSale = entity.doSale;
    dto.doPurchase = entity.doPurchase;
    dto.doReceipt = entity.doReceipt;
    dto.doPayment = entity.doPayment;
    dto.active = entity.active;
    dto.cmsBank = entity.cmsBank;
    dto.directRemittance = entity.directRemittance;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
