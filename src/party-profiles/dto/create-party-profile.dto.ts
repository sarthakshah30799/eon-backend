import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ClientType } from "../party-profile.entity";
import { EmptyStringToUndefined } from "../../common/decorators/empty-string-to-undefined.decorator";
import { PartyProfileCommissionRuleDto } from "./party-profile-commission-rule.dto";

export class CreatePartyProfileDto {
  @ApiProperty({ description: "Date of Introduction", example: "2026-06-09T00:00:00Z" })
  @IsString()
  @IsOptional()
  dateOfIntro?: string;

  @ApiProperty({ description: "Client Code", example: "SHREENATH", minLength: 5, maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @Length(5, 20, { message: "Code must be between 5 and 20 characters" })
  code: string;

  @ApiProperty({ description: "Client Name", example: "SHREENATH ENTERPRISES" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: "Individual category customer status flag", default: false })
  @IsBoolean()
  @IsOptional()
  isIndividual?: boolean;

  @ApiPropertyOptional({ description: "Credit Limit", example: -1 })
  @IsNumber()
  @Min(-1)
  @IsOptional()
  creditLimit?: number;

  @ApiPropertyOptional({ description: "Credit Days", example: -1 })
  @IsInt()
  @Min(-1)
  @IsOptional()
  creditDays?: number;

  @ApiPropertyOptional({ description: "Temporary Credit Limit", example: 0 })
  @IsNumber()
  @Min(-1)
  @IsOptional()
  temporaryCreditLimit?: number;

  @ApiPropertyOptional({ description: "Temporary Credit Days", example: 0 })
  @IsInt()
  @Min(-1)
  @IsOptional()
  temporaryCreditDays?: number;

  @ApiPropertyOptional({ description: "Permanent Credit Limit", example: 0 })
  @IsNumber()
  @Min(-1)
  @IsOptional()
  permanentCreditLimit?: number;

  @ApiPropertyOptional({ description: "Permanent Credit Days", example: 0 })
  @IsInt()
  @Min(-1)
  @IsOptional()
  permanentCreditDays?: number;

  @ApiPropertyOptional({ description: "Address Line 1" })
  @IsString()
  @IsNotEmpty()
  address1: string;

  @ApiPropertyOptional({ description: "Address Line 2" })
  @IsString()
  @IsOptional()
  address2?: string;

  @ApiPropertyOptional({ description: "Address Line 3" })
  @IsString()
  @IsOptional()
  address3?: string;

  @ApiPropertyOptional({ description: "City" })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ description: "Pin Code" })
  @IsString()
  @IsNotEmpty()
  pinCode: string;

  @ApiPropertyOptional({ description: "KYC Approval Number" })
  @IsString()
  @IsOptional()
  kycApprovalNumber?: string;

  @ApiPropertyOptional({ description: "KYC Risk Category" })
  @EmptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  kycRiskCategory?: string;

  @ApiPropertyOptional({ description: "Cheque Transaction Limit", example: -1 })
  @IsNumber()
  @Min(-1)
  @IsOptional()
  chqTrxnLimit?: number;

  @ApiPropertyOptional({ description: "Default Handling Charges", example: 0 })
  @IsNumber()
  @IsOptional()
  defaultHandlingCharges?: number;

  @ApiPropertyOptional({ description: "Default Agent" })
  @EmptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  defaultAgent?: string;

  @ApiPropertyOptional({ description: "Phone No" })
  @IsString()
  @IsOptional()
  phoneNo?: string;

  @ApiPropertyOptional({ description: "Block Date From" })
  @IsString()
  @IsOptional()
  blockDateFrom?: string;

  @ApiPropertyOptional({ description: "Establishment Date" })
  @IsString()
  @IsOptional()
  establishmentDate?: string;

  @ApiPropertyOptional({ description: "Remarks" })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiPropertyOptional({ description: "Email Address" })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: "Contact Name" })
  @IsString()
  @IsOptional()
  contactName?: string;

  @ApiPropertyOptional({ description: "Designation" })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiPropertyOptional({ description: "Group" })
  @EmptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  group?: string;

  @ApiPropertyOptional({ description: "Entity Type" })
  @EmptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  entityType?: string;

  @ApiPropertyOptional({ description: "PAN Name" })
  @IsString()
  @IsOptional()
  panName?: string;

  @ApiPropertyOptional({ description: "PAN Date of Birth" })
  @IsString()
  @IsOptional()
  panDob?: string;

  @ApiPropertyOptional({ description: "PAN No" })
  @IsString()
  @IsOptional()
  panNo?: string;

  @ApiPropertyOptional({ description: "Marketing Executive" })
  @EmptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  marketingExecutive?: string;

  @ApiPropertyOptional({ description: "Business Nature" })
  @EmptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  businessNature?: string;

  @ApiPropertyOptional({ description: "Is TDS Deducted flag", default: false })
  @IsBoolean()
  @IsOptional()
  isTdsDeducted?: boolean;

  @ApiPropertyOptional({ description: "TDS" })
  @IsString()
  @IsOptional()
  tds?: string;

  @ApiPropertyOptional({ description: "TDS Group" })
  @EmptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  tdsGroup?: string;

  @ApiPropertyOptional({ description: "Active status flag", default: false })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: "System isActive flag", default: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "Print Address flag", default: false })
  @IsBoolean()
  @IsOptional()
  printAddress?: boolean;

  @ApiPropertyOptional({ description: "EEFC Client flag", default: false })
  @IsBoolean()
  @IsOptional()
  eefcClient?: boolean;

  @ApiPropertyOptional({ description: "Sale flag", default: false })
  @IsBoolean()
  @IsOptional()
  sale?: boolean;

  @ApiPropertyOptional({ description: "Purchase flag", default: false })
  @IsBoolean()
  @IsOptional()
  purchase?: boolean;

  @ApiPropertyOptional({ description: "Apply Tax flag", default: false })
  @IsBoolean()
  @IsOptional()
  applyTax?: boolean;

  @ApiPropertyOptional({ description: "IGST Only flag", default: false })
  @IsBoolean()
  @IsOptional()
  igstOnly?: boolean;

  @ApiPropertyOptional({ description: "GST Number" })
  @IsString()
  @IsOptional()
  gstNo?: string;

  @ApiPropertyOptional({ description: "SGST Number" })
  @IsString()
  @IsOptional()
  sgstNo?: string;

  @ApiPropertyOptional({ description: "IGST Number" })
  @IsString()
  @IsOptional()
  igstNo?: string;

  @ApiPropertyOptional({ description: "GST State ID (UUID)" })
  @EmptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  gstStateId?: string;

  @ApiPropertyOptional({ description: "State ID (UUID)" })
  @EmptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  stateId?: string;

  @ApiPropertyOptional({ description: "Origin Branch ID (UUID)" })
  @EmptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  originBranchId?: string;

  @ApiPropertyOptional({ description: "Location" })
  @EmptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ description: "Website" })
  @IsString()
  @IsOptional()
  webSite?: string;

  @ApiPropertyOptional({ description: "Account Holder Name" })
  @IsString()
  @IsOptional()
  accountHolderName?: string;

  @ApiPropertyOptional({ description: "Bank Name" })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional({ description: "Account Number" })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiPropertyOptional({ description: "IFSC Code" })
  @IsString()
  @IsOptional()
  ifscCode?: string;

  @ApiPropertyOptional({ description: "Bank Branch Name" })
  @IsString()
  @IsOptional()
  bankBranchName?: string;

  @ApiPropertyOptional({ description: "Cancelled Cheque Copy file path" })
  @IsString()
  @IsOptional()
  cancelledChequeCopy?: string;

  @ApiPropertyOptional({ description: "FFMC Registration Number" })
  @IsString()
  @IsOptional()
  ffmcRegNo?: string;

  @ApiPropertyOptional({ description: "FFMC Registration Date" })
  @IsString()
  @IsOptional()
  ffmcRegDate?: string;

  @ApiPropertyOptional({ description: "Division Factor", example: 1 })
  @IsNumber()
  @IsOptional()
  divisionFactor?: number;

  @ApiPropertyOptional({ description: "Commission Rules", type: [PartyProfileCommissionRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartyProfileCommissionRuleDto)
  @IsOptional()
  commissionRules?: PartyProfileCommissionRuleDto[];

  @ApiPropertyOptional({ description: "Client Profile Type", enum: ClientType, default: ClientType.CORPORATE_CLIENT })
  @IsEnum(ClientType)
  @IsOptional()
  type?: ClientType;
}
