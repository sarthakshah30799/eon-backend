import { ApiProperty } from '@nestjs/swagger';
import { Company } from '../company.entity';

export class CompanyResponseDto {
  @ApiProperty({ description: 'Company ID (UUID)', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ description: 'Company name', example: 'Maraekat FX Pvt. Ltd.' })
  name: string;

  @ApiProperty({ description: 'Designation', example: 'Regional Compliance Officer' })
  designation: string;

  @ApiProperty({ description: 'RBI Name', example: 'RBI Main Office' })
  rbiName: string;

  @ApiProperty({ description: 'RBI Place', example: 'Mumbai' })
  rbiPlace: string;

  @ApiProperty({ description: 'Address line 1', example: '12 Business Tower' })
  address1: string;

  @ApiProperty({ description: 'Address line 2', example: 'Nariman Point' })
  address2: string;

  @ApiProperty({ description: 'Address line 3', example: 'Mumbai, Maharashtra' })
  address3: string;

  @ApiProperty({ description: 'Pincode', example: '400021' })
  pincode: string;

  @ApiProperty({ description: 'City', example: 'Mumbai' })
  city: string;

  @ApiProperty({ description: 'State', example: 'Maharashtra' })
  state: string;

  @ApiProperty({ description: 'Country', example: 'India' })
  country: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: Date;

  static fromEntity(entity: Company): CompanyResponseDto {
    const dto = new CompanyResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.designation = entity.designation;
    dto.rbiName = entity.rbiName;
    dto.rbiPlace = entity.rbiPlace;
    dto.address1 = entity.address1;
    dto.address2 = entity.address2;
    dto.address3 = entity.address3;
    dto.pincode = entity.pincode;
    dto.city = entity.city;
    dto.state = entity.state;
    dto.country = entity.country;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
