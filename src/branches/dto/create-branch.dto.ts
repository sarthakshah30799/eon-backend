import { IsString, IsNotEmpty, IsOptional, IsInt, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({ description: 'Company ID (UUID)', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', required: false })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiProperty({ description: 'Unique branch code', example: 'BR-001' })
  @IsString()
  @IsNotEmpty()
  branchCode: string;

  @ApiProperty({ description: 'Unique branch number', example: 1 })
  @IsInt()
  @IsNotEmpty()
  branchNumber: number;

  @ApiProperty({ description: 'Address line 1', example: '123 Main Street' })
  @IsString()
  @IsNotEmpty()
  address1: string;

  @ApiProperty({ description: 'Address line 2', required: false })
  @IsString()
  @IsOptional()
  address2?: string;

  @ApiProperty({ description: 'Address line 3', required: false })
  @IsString()
  @IsOptional()
  address3?: string;

  @ApiProperty({ description: 'Pincode', example: '400001' })
  @IsString()
  @IsNotEmpty()
  pincode: string;

  @ApiProperty({ description: 'City', example: 'Mumbai' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'State', example: 'Maharashtra' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ description: 'Country', example: 'India', required: false })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ description: 'State code (2 chars)', example: 'MH' })
  @IsString()
  @IsNotEmpty()
  stateCode: string;

  @ApiProperty({ description: 'GST state code', example: '27' })
  @IsString()
  @IsNotEmpty()
  gstStateCode: string;

  @ApiProperty({ description: 'Phone 1 country code', example: 'IN', required: false })
  @IsString()
  @IsOptional()
  countryCode1?: string;

  @ApiProperty({ description: 'Phone number 1', example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  phoneNumber1: string;

  @ApiProperty({ description: 'Phone 2 country code', example: 'IN', required: false })
  @IsString()
  @IsOptional()
  countryCode2?: string;

  @ApiProperty({ description: 'Phone number 2', required: false })
  @IsString()
  @IsOptional()
  phoneNumber2?: string;

  @ApiProperty({ description: 'Contact person name', required: false })
  @IsString()
  @IsOptional()
  contactPersonName?: string;

  @ApiProperty({ description: 'Contact person country code', example: 'IN', required: false })
  @IsString()
  @IsOptional()
  contactPersonCountryCode?: string;

  @ApiProperty({ description: 'Contact person phone', required: false })
  @IsString()
  @IsOptional()
  contactPersonPhone?: string;

  @ApiProperty({ description: 'Operation group', required: false })
  @IsString()
  @IsOptional()
  operationGroup?: string;
}
