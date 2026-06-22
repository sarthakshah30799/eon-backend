import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PartyProfile, ClientType } from "../party-profile.entity";

export class PartyProfileResponseDto {
  @ApiProperty({ description: "UUID of the party profile" })
  id: string;

  @ApiProperty({ description: "Date of introduction" })
  dateOfIntro: Date;

  @ApiProperty({ description: "Party profile code" })
  code: string;

  @ApiProperty({ description: "Party profile name" })
  name: string;

  @ApiProperty({ description: "Individual category status" })
  isIndividual: boolean;

  @ApiPropertyOptional({ description: "Credit Limit" })
  creditLimit?: number;

  @ApiPropertyOptional({ description: "Credit Days" })
  creditDays?: number;

  @ApiPropertyOptional({ description: "Temporary Credit Limit" })
  temporaryCreditLimit?: number;

  @ApiPropertyOptional({ description: "Temporary Credit Days" })
  temporaryCreditDays?: number;

  @ApiPropertyOptional({ description: "Permanent Credit Limit" })
  permanentCreditLimit?: number;

  @ApiPropertyOptional({ description: "Permanent Credit Days" })
  permanentCreditDays?: number;

  @ApiProperty({ description: "Address Line 1" })
  address1: string;

  @ApiPropertyOptional({ description: "Address Line 2" })
  address2?: string;

  @ApiPropertyOptional({ description: "Address Line 3" })
  address3?: string;

  @ApiProperty({ description: "City" })
  city: string;

  @ApiProperty({ description: "Pin Code" })
  pinCode: string;

  @ApiPropertyOptional({ description: "KYC Approval Number" })
  kycApprovalNumber?: string;

  @ApiPropertyOptional({ description: "KYC Risk Category" })
  kycRiskCategory?: string;

  @ApiPropertyOptional({ description: "Cheque Transaction Limit" })
  chqTrxnLimit?: number;

  @ApiPropertyOptional({ description: "Default Handling Charges" })
  defaultHandlingCharges?: number;

  @ApiPropertyOptional({ description: "Default Agent" })
  defaultAgent?: string;

  @ApiPropertyOptional({ description: "Phone No" })
  phoneNo?: string;

  @ApiPropertyOptional({ description: "Block Date From" })
  blockDateFrom?: Date;

  @ApiPropertyOptional({ description: "Establishment Date" })
  establishmentDate?: Date;

  @ApiPropertyOptional({ description: "Remarks" })
  remarks?: string;

  @ApiPropertyOptional({ description: "Email Address" })
  email?: string;

  @ApiPropertyOptional({ description: "Contact Name" })
  contactName?: string;

  @ApiPropertyOptional({ description: "Designation" })
  designation?: string;

  @ApiPropertyOptional({ description: "Group" })
  group?: string;

  @ApiPropertyOptional({ description: "Entity Type" })
  entityType?: string;

  @ApiPropertyOptional({ description: "PAN Name" })
  panName?: string;

  @ApiPropertyOptional({ description: "PAN DOB" })
  panDob?: Date;

  @ApiPropertyOptional({ description: "PAN No" })
  panNo?: string;

  @ApiPropertyOptional({ description: "Marketing Executive" })
  marketingExecutive?: string;

  @ApiPropertyOptional({ description: "Business Nature" })
  businessNature?: string;

  @ApiProperty({ description: "Is TDS Deducted flag" })
  isTdsDeducted: boolean;

  @ApiPropertyOptional({ description: "TDS value/type" })
  tds?: string;

  @ApiPropertyOptional({ description: "TDS Group" })
  tdsGroup?: string;

  @ApiProperty({ description: "Active status flag" })
  active: boolean;

  @ApiProperty({ description: "System isActive flag" })
  isActive: boolean;

  @ApiProperty({ description: "Print Address flag" })
  printAddress: boolean;

  @ApiProperty({ description: "EEFC Client flag" })
  eefcClient: boolean;

  @ApiProperty({ description: "Sale flag" })
  sale: boolean;

  @ApiProperty({ description: "Purchase flag" })
  purchase: boolean;

  @ApiProperty({ description: "Apply Tax flag" })
  applyTax: boolean;

  @ApiProperty({ description: "IGST Only flag" })
  igstOnly: boolean;

  @ApiPropertyOptional({ description: "GST Number" })
  gstNo?: string;

  @ApiPropertyOptional({ description: "SGST Number" })
  sgstNo?: string;

  @ApiPropertyOptional({ description: "IGST Number" })
  igstNo?: string;

  @ApiPropertyOptional({ description: "GST State ID" })
  gstStateId?: string;

  @ApiPropertyOptional({ description: "GST State Name" })
  gstStateName?: string;



  @ApiPropertyOptional({ description: "Origin Branch ID" })
  originBranchId?: string;

  @ApiPropertyOptional({ description: "Origin Branch Name" })
  originBranchName?: string;

  @ApiPropertyOptional({ description: "Location" })
  location?: string;

  @ApiPropertyOptional({ description: "Website" })
  webSite?: string;

  @ApiPropertyOptional({ description: "Account Holder Name" })
  accountHolderName?: string;

  @ApiPropertyOptional({ description: "Bank Name" })
  bankName?: string;

  @ApiPropertyOptional({ description: "Account Number" })
  accountNumber?: string;

  @ApiPropertyOptional({ description: "IFSC Code" })
  ifscCode?: string;

  @ApiPropertyOptional({ description: "Bank Address" })
  bankAddress?: string;

  @ApiPropertyOptional({ description: "Cancelled Cheque Copy" })
  cancelledChequeCopy?: string;

  @ApiPropertyOptional({ description: "FFMC Registration Number" })
  ffmcRegNo?: string;

  @ApiPropertyOptional({ description: "FFMC Registration Date" })
  ffmcRegDate?: Date;

  @ApiProperty({ description: "Party profile type", enum: ClientType })
  type: ClientType;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;

  static fromEntity(entity: PartyProfile): PartyProfileResponseDto {
    const dto = new PartyProfileResponseDto();
    dto.id = entity.id;
    dto.dateOfIntro = entity.dateOfIntro;
    dto.code = entity.code;
    dto.name = entity.name;
    dto.isIndividual = entity.isIndividual;
    dto.creditLimit = entity.creditLimit ? Number(entity.creditLimit) : undefined;
    dto.creditDays = entity.creditDays;
    dto.temporaryCreditLimit = entity.temporaryCreditLimit ? Number(entity.temporaryCreditLimit) : undefined;
    dto.temporaryCreditDays = entity.temporaryCreditDays;
    dto.permanentCreditLimit = entity.permanentCreditLimit ? Number(entity.permanentCreditLimit) : undefined;
    dto.permanentCreditDays = entity.permanentCreditDays;
    dto.address1 = entity.address1;
    dto.address2 = entity.address2;
    dto.address3 = entity.address3;
    dto.city = entity.city;
    dto.pinCode = entity.pinCode;
    dto.kycApprovalNumber = entity.kycApprovalNumber;
    dto.kycRiskCategory = entity.kycRiskCategory;
    dto.chqTrxnLimit = entity.chqTrxnLimit ? Number(entity.chqTrxnLimit) : undefined;
    dto.defaultHandlingCharges = entity.defaultHandlingCharges ? Number(entity.defaultHandlingCharges) : undefined;
    dto.defaultAgent = entity.defaultAgent;
    dto.phoneNo = entity.phoneNo;
    dto.blockDateFrom = entity.blockDateFrom;
    dto.establishmentDate = entity.establishmentDate;
    dto.remarks = entity.remarks;
    dto.email = entity.email;
    dto.contactName = entity.contactName;
    dto.designation = entity.designation;
    dto.group = entity.group;
    dto.entityType = entity.entityType;
    dto.panName = entity.panName;
    dto.panDob = entity.panDob;
    dto.panNo = entity.panNo;
    dto.marketingExecutive = entity.marketingExecutive;
    dto.businessNature = entity.businessNature;
    dto.isTdsDeducted = entity.isTdsDeducted;
    dto.tds = entity.tds;
    dto.tdsGroup = entity.tdsGroup;
    dto.active = entity.active;
    dto.isActive = entity.isActive;
    dto.printAddress = entity.printAddress;
    dto.eefcClient = entity.eefcClient;
    dto.sale = entity.sale;
    dto.purchase = entity.purchase;
    dto.applyTax = entity.applyTax;
    dto.igstOnly = entity.igstOnly;
    dto.gstNo = entity.gstNo;
    dto.sgstNo = entity.sgstNo;
    dto.igstNo = entity.igstNo;
    dto.gstStateId = entity.gstStateId;
    dto.gstStateName = entity.gstState?.name;

    dto.originBranchId = entity.originBranchId;
    dto.originBranchName = entity.originBranch?.name;
    dto.location = entity.location;
    dto.webSite = entity.webSite;
    dto.accountHolderName = entity.accountHolderName;
    dto.bankName = entity.bankName;
    dto.accountNumber = entity.accountNumber;
    dto.ifscCode = entity.ifscCode;
    dto.bankAddress = entity.bankAddress;
    dto.cancelledChequeCopy = entity.cancelledChequeCopy;
    dto.ffmcRegNo = entity.ffmcRegNo;
    dto.ffmcRegDate = entity.ffmcRegDate;
    dto.type = entity.type;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
