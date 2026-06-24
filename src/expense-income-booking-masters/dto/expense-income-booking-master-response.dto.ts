import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseIncomeBookingMaster } from '../expense-income-booking-master.entity';

export class AccountProfileSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  accountCode: string;

  @ApiProperty()
  accountName: string;
}

export class ExpenseIncomeBookingMasterResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  updatedBy: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  interstateTransaction: boolean;

  @ApiProperty()
  code: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty()
  applicableCustomer: boolean;

  @ApiProperty()
  applicableVendor: boolean;

  @ApiProperty()
  applicableEmployee: boolean;

  @ApiProperty()
  applicableAgent: boolean;

  @ApiProperty()
  applicableTcIssuer: boolean;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  allowRecPay: boolean;

  @ApiProperty()
  totalGst: number;

  @ApiProperty()
  tdsApplicable: boolean;

  @ApiProperty()
  tdsValue: number;

  @ApiPropertyOptional({ nullable: true })
  tdsAccountId: string | null;

  @ApiPropertyOptional({ type: () => AccountProfileSummaryDto, nullable: true })
  tdsAccount: AccountProfileSummaryDto | null;

  @ApiPropertyOptional({ nullable: true })
  from: Date | null;

  @ApiPropertyOptional({ nullable: true })
  to: Date | null;

  static fromEntity(entity: ExpenseIncomeBookingMaster): ExpenseIncomeBookingMasterResponseDto {
    const dto = new ExpenseIncomeBookingMasterResponseDto();
    dto.id = entity.id;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.createdBy = entity.createdBy;
    dto.updatedBy = entity.updatedBy;
    dto.type = entity.type;
    dto.interstateTransaction = entity.interstateTransaction;
    dto.code = entity.code;
    dto.description = entity.description;
    dto.applicableCustomer = entity.applicableCustomer;
    dto.applicableVendor = entity.applicableVendor;
    dto.applicableEmployee = entity.applicableEmployee;
    dto.applicableAgent = entity.applicableAgent;
    dto.applicableTcIssuer = entity.applicableTcIssuer;
    dto.active = entity.active;
    dto.allowRecPay = entity.allowRecPay;
    dto.totalGst = Number(entity.totalGst);
    dto.tdsApplicable = entity.tdsApplicable;
    dto.tdsValue = Number(entity.tdsValue);
    dto.tdsAccountId = entity.tdsAccountId;
    
    if (entity.tdsAccount) {
      dto.tdsAccount = {
        id: entity.tdsAccount.id,
        accountCode: entity.tdsAccount.accountCode,
        accountName: entity.tdsAccount.accountName,
      };
    } else {
      dto.tdsAccount = null;
    }

    dto.from = entity.from;
    dto.to = entity.to;
    return dto;
  }
}
