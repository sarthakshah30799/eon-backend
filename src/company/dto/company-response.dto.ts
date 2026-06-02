import { ApiProperty } from '@nestjs/swagger';
import { Company } from '../company.entity';

export class CompanyResponseDto {
  @ApiProperty({ description: 'Company ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Short code', required: false })
  shortCode: string;

  @ApiProperty({ description: 'Company name' })
  name: string;

  @ApiProperty({ description: 'Formerly known as', required: false })
  formerlyKnownName: string;

  @ApiProperty({ description: 'CIN No.', required: false })
  cinNo: string;

  @ApiProperty({ description: 'PAN No.', required: false })
  panNo: string;

  @ApiProperty({ description: 'FX Reg No.', required: false })
  fxRegNo: string;

  @ApiProperty({ description: 'FX Reg Date', required: false })
  fxRegDate: Date;

  @ApiProperty({ description: 'From Date', required: false })
  fromDate: Date;

  @ApiProperty({ description: 'To Date', required: false })
  toDate: Date;

  @ApiProperty({ description: 'Logo URL/data', required: false })
  logo: string;

  @ApiProperty({ description: 'AEON Lic No.', required: false })
  aeonLicNo: string;

  @ApiProperty({ description: 'Website URL', required: false })
  website: string;

  @ApiProperty({ description: 'Email', required: false })
  email: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: Date;

  static fromEntity(entity: Company): CompanyResponseDto {
    const dto = new CompanyResponseDto();
    dto.id = entity.id;
    dto.shortCode = entity.shortCode;
    dto.name = entity.name;
    dto.formerlyKnownName = entity.formerlyKnownName;
    dto.cinNo = entity.cinNo;
    dto.panNo = entity.panNo;
    dto.fxRegNo = entity.fxRegNo;
    dto.fxRegDate = entity.fxRegDate;
    dto.fromDate = entity.fromDate;
    dto.toDate = entity.toDate;
    dto.logo = entity.logo;
    dto.aeonLicNo = entity.aeonLicNo;
    dto.website = entity.website;
    dto.email = entity.email;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
