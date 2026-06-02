import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID, IsNumber, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({ description: 'Company ID (UUID)', required: false })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiProperty({ description: 'Branch Code', example: 'BR-001', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({ description: 'Branch Number', example: 101 })
  @IsNumber()
  @IsNotEmpty()
  branchNumber: number;

  @ApiProperty({ description: 'Address Line 1', example: '123 Business Road', maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  address1: string;

  @ApiProperty({ description: 'Address Line 2', required: false, maxLength: 250 })
  @IsString()
  @IsOptional()
  @MaxLength(250)
  address2?: string;

  @ApiProperty({ description: 'Address Line 3', required: false, maxLength: 250 })
  @IsString()
  @IsOptional()
  @MaxLength(250)
  address3?: string;

  @ApiProperty({ description: 'City', example: 'Mumbai', maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  city: string;

  @ApiProperty({ description: 'State', example: 'Maharashtra', maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  state: string;

  @ApiProperty({ description: 'GST State', required: false, maxLength: 250 })
  @IsString()
  @IsOptional()
  @MaxLength(250)
  gstState?: string;

  @ApiProperty({ description: 'Pin Code', example: '400001' })
  @IsString()
  @IsNotEmpty()
  pinCode: string;

  @ApiProperty({ description: 'GST No.', required: false, maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  gstNo?: string;

  @ApiProperty({ description: 'FX Reg No.', required: false, maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  fxRegNo?: string;

  @ApiProperty({ description: 'FX Reg Date', required: false })
  @IsDateString()
  @IsOptional()
  fxRegDate?: string;

  @ApiProperty({ description: 'Contact Name', required: false, maxLength: 250 })
  @IsString()
  @IsOptional()
  @MaxLength(250)
  contactName?: string;

  @ApiProperty({ description: 'Contact No.', required: false })
  @IsString()
  @IsOptional()
  contactNo?: string;

  @ApiProperty({ description: 'Branch Email', required: false })
  @IsString()
  @IsOptional()
  branchEmail?: string;

  @ApiProperty({ description: 'AEON Branch Lic', required: false, maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  aeonBranchLic?: string;

  @ApiProperty({ description: 'Location Type', required: false, maxLength: 250 })
  @IsString()
  @IsOptional()
  @MaxLength(250)
  locationType?: string;

  @ApiProperty({ description: 'Cash Holding', required: false })
  @IsNumber()
  @IsOptional()
  cashHolding?: number;

  @ApiProperty({ description: 'Cash Holding Temp', required: false })
  @IsNumber()
  @IsOptional()
  cashHoldingTemp?: number;

  @ApiProperty({ description: 'Currency Holding', required: false })
  @IsNumber()
  @IsOptional()
  currHolding?: number;

  @ApiProperty({ description: 'Currency Holding Temp', required: false })
  @IsNumber()
  @IsOptional()
  currHoldingTemp?: number;

  @ApiProperty({ description: 'Is Head Office', default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isHeadOffice?: boolean;

  @ApiProperty({ description: 'Is Active', default: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Connected counter IDs (UUIDs)', type: [String], required: false })
  @IsUUID(undefined, { each: true })
  @IsOptional()
  counterIds?: string[];
}
