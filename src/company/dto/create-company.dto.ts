import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({ description: 'Company name', example: 'Maraekat FX Pvt. Ltd.' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Designation', example: 'Regional Compliance Officer', required: false })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiProperty({ description: 'RBI Name', example: 'RBI Main Office', required: false })
  @IsString()
  @IsOptional()
  rbiName?: string;

  @ApiProperty({ description: 'RBI Place', example: 'Mumbai', required: false })
  @IsString()
  @IsOptional()
  rbiPlace?: string;

  @ApiProperty({ description: 'Address line 1', example: '12 Business Tower' })
  @IsString()
  @IsNotEmpty()
  address1: string;

  @ApiProperty({ description: 'Address line 2', example: 'Nariman Point', required: false })
  @IsString()
  @IsOptional()
  address2?: string;

  @ApiProperty({ description: 'Address line 3', example: 'Mumbai, Maharashtra', required: false })
  @IsString()
  @IsOptional()
  address3?: string;

  @ApiProperty({ description: 'Pincode', example: '400021' })
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
}
