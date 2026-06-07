import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({ description: 'Short code', required: false, maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  shortCode?: string;

  @ApiProperty({ description: 'Company name', example: 'Maraekat FX Pvt. Ltd.', maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  name: string;

  @ApiProperty({ description: 'Formerly known as', required: false, maxLength: 250 })
  @IsString()
  @IsOptional()
  @MaxLength(250)
  formerlyKnownName?: string;

  @ApiProperty({ description: 'CIN No.', required: false, maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  cinNo?: string;

  @ApiProperty({ description: 'PAN No.', required: true, maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, {
    message: 'PAN No. must follow the strict format: five letters, four digits, and one letter (e.g., ABCDE1234F)',
  })
  panNo: string;

  @ApiProperty({ description: 'FX Reg No.', required: false, maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  fxRegNo?: string;

  @ApiProperty({ description: 'FX Reg Date', required: false })
  @IsDateString()
  @IsOptional()
  fxRegDate?: string;

  @ApiProperty({ description: 'From Date', required: false })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiProperty({ description: 'To Date', required: false })
  @IsDateString()
  @IsOptional()
  toDate?: string;

  @ApiProperty({ description: 'Logo URL/data', required: false })
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiProperty({ description: 'AEON Lic No.', required: false, maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  aeonLicNo?: string;

  @ApiProperty({ description: 'Website URL', required: false })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiProperty({ description: 'Email', required: false })
  @IsString()
  @IsOptional()
  email?: string;
}
