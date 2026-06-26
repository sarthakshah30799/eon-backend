import { ApiProperty } from "@nestjs/swagger";
import { SelectOptionResponseDto } from "../../category-options/dto/category-option-response.dto";
import { AccountProfile } from "../account-profile.entity";

export class AccountProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true, type: SelectOptionResponseDto })
  divisionDept: SelectOptionResponseDto | null;

  @ApiProperty()
  accountCode: string;

  @ApiProperty()
  accountName: string;

  @ApiProperty({ nullable: true, type: SelectOptionResponseDto })
  accountType: SelectOptionResponseDto | null;

  @ApiProperty({ nullable: true, type: SelectOptionResponseDto })
  subLedger: SelectOptionResponseDto | null;

  @ApiProperty({ nullable: true, type: SelectOptionResponseDto })
  bankNature: SelectOptionResponseDto | null;

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
  retailSale: boolean;

  @ApiProperty()
  retailPurchase: boolean;

  @ApiProperty()
  bulkSale: boolean;

  @ApiProperty()
  bulkPurchase: boolean;

  @ApiProperty()
  expense: boolean;

  @ApiProperty()
  receipt: boolean;

  @ApiProperty()
  payment: boolean;

  @ApiProperty()
  journalVoucher: boolean;

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
    dto.divisionDept = entity.divisionDept ? SelectOptionResponseDto.fromEntity(entity.divisionDept) : null;
    dto.accountCode = entity.accountCode;
    dto.accountName = entity.accountName;
    dto.accountType = entity.accountType ? SelectOptionResponseDto.fromEntity(entity.accountType) : null;
    dto.subLedger = entity.subLedger ? SelectOptionResponseDto.fromEntity(entity.subLedger) : null;
    dto.bankNature = entity.bankNature ? SelectOptionResponseDto.fromEntity(entity.bankNature) : null;
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
    dto.retailSale = entity.retailSale;
    dto.retailPurchase = entity.retailPurchase;
    dto.bulkSale = entity.bulkSale;
    dto.bulkPurchase = entity.bulkPurchase;
    dto.expense = entity.expense;
    dto.receipt = entity.receipt;
    dto.payment = entity.payment;
    dto.journalVoucher = entity.journalVoucher;
    dto.active = entity.active;
    dto.cmsBank = entity.cmsBank;
    dto.directRemittance = entity.directRemittance;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
