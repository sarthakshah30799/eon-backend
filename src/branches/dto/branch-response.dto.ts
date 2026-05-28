import { ApiProperty } from '@nestjs/swagger';
import { Branch } from '../branch.entity';

export class BranchResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() branchCode: string;
  @ApiProperty() branchNumber: number;
  @ApiProperty() address1: string;
  @ApiProperty({ required: false }) address2: string;
  @ApiProperty({ required: false }) address3: string;
  @ApiProperty() pincode: string;
  @ApiProperty() city: string;
  @ApiProperty() state: string;
  @ApiProperty() country: string;
  @ApiProperty() stateCode: string;
  @ApiProperty() gstStateCode: string;
  @ApiProperty() countryCode1: string;
  @ApiProperty() phoneNumber1: string;
  @ApiProperty({ required: false }) countryCode2: string;
  @ApiProperty({ required: false }) phoneNumber2: string;
  @ApiProperty({ required: false }) contactPersonName: string;
  @ApiProperty({ required: false }) contactPersonCountryCode: string;
  @ApiProperty({ required: false }) contactPersonPhone: string;
  @ApiProperty({ required: false }) operationGroup: string;
  @ApiProperty({ required: false }) companyId: string;
  @ApiProperty({ required: false }) companyName: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: Branch): BranchResponseDto {
    const dto = new BranchResponseDto();
    dto.id = entity.id;
    dto.branchCode = entity.branchCode;
    dto.branchNumber = entity.branchNumber;
    dto.address1 = entity.address1;
    dto.address2 = entity.address2;
    dto.address3 = entity.address3;
    dto.pincode = entity.pincode;
    dto.city = entity.city;
    dto.state = entity.state;
    dto.country = entity.country;
    dto.stateCode = entity.stateCode;
    dto.gstStateCode = entity.gstStateCode;
    dto.countryCode1 = entity.countryCode1;
    dto.phoneNumber1 = entity.phoneNumber1;
    dto.countryCode2 = entity.countryCode2;
    dto.phoneNumber2 = entity.phoneNumber2;
    dto.contactPersonName = entity.contactPersonName;
    dto.contactPersonCountryCode = entity.contactPersonCountryCode;
    dto.contactPersonPhone = entity.contactPersonPhone;
    dto.operationGroup = entity.operationGroup;
    dto.companyId = entity.company?.id || null;
    dto.companyName = entity.company?.name || null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
