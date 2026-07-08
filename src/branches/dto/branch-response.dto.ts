import { ApiProperty } from '@nestjs/swagger';
import { Branch } from '../branch.entity';
import { CountryResponseDto } from '../../country/dto/country-response.dto';
import { StateResponseDto } from '../../state/dto/state-response.dto';
import { SelectOptionResponseDto } from '../../category-options/dto/category-option-response.dto';

export class BranchResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty() branchNumber: number;
  @ApiProperty({ required: false, type: CountryResponseDto })
  country: CountryResponseDto | null;
  @ApiProperty({ required: false, type: StateResponseDto })
  state: StateResponseDto | null;
  @ApiProperty() address1: string;
  @ApiProperty({ required: false }) address2: string;
  @ApiProperty({ required: false }) address3: string;
  @ApiProperty() pinCode: string;
  @ApiProperty() city: string;
  @ApiProperty({ required: false }) gstState: string;
  @ApiProperty({ required: false }) gstNo: string;
  @ApiProperty({ required: false }) fxRegNo: string;
  @ApiProperty({ required: false }) fxRegDate: Date;
  @ApiProperty({ required: false }) contactName: string;
  @ApiProperty({ required: false }) contactNo: string;
  @ApiProperty({ required: false }) branchEmail: string;
  @ApiProperty({ required: false }) aeonBranchLic: string;
  @ApiProperty({ required: false, type: SelectOptionResponseDto })
  locationType: SelectOptionResponseDto | null;
  @ApiProperty({ required: false }) cashHolding: number;
  @ApiProperty({ required: false }) cashHoldingTemp: number;
  @ApiProperty({ required: false }) currHolding: number;
  @ApiProperty({ required: false }) currHoldingTemp: number;
  @ApiProperty() isHeadOffice: boolean;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ required: false }) companyId: string;
  @ApiProperty({ required: false }) companyName: string;
  @ApiProperty({ type: [String], required: false }) counterIds: string[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: Branch): BranchResponseDto {
    const dto = new BranchResponseDto();
    dto.id = entity.id;
    dto.code = entity.code;
    dto.name = entity.name;
    dto.branchNumber = entity.branchNumber;
    dto.country = entity.country ? CountryResponseDto.fromEntity(entity.country) : null;
    dto.state = entity.state ? StateResponseDto.fromEntity(entity.state) : null;
    dto.address1 = entity.address1;
    dto.address2 = entity.address2;
    dto.address3 = entity.address3;
    dto.pinCode = entity.pinCode;
    dto.city = entity.city;
    dto.gstState = entity.gstState;
    dto.gstNo = entity.gstNo;
    dto.fxRegNo = entity.fxRegNo;
    dto.fxRegDate = entity.fxRegDate;
    dto.contactName = entity.contactName;
    dto.contactNo = entity.contactNo;
    dto.branchEmail = entity.branchEmail;
    dto.aeonBranchLic = entity.aeonBranchLic;
    dto.locationType = entity.locationType ? SelectOptionResponseDto.fromEntity(entity.locationType) : null;
    dto.cashHolding = entity.cashHolding !== null ? Number(entity.cashHolding) : null;
    dto.cashHoldingTemp = entity.cashHoldingTemp !== null ? Number(entity.cashHoldingTemp) : null;
    dto.currHolding = entity.currHolding !== null ? Number(entity.currHolding) : null;
    dto.currHoldingTemp = entity.currHoldingTemp !== null ? Number(entity.currHoldingTemp) : null;
    dto.isHeadOffice = entity.isHeadOffice;
    dto.isActive = entity.isActive;
    dto.companyId = entity.company?.id || null;
    dto.companyName = entity.company?.name || null;
    dto.counterIds = entity.counters ? entity.counters.map(c => c.id) : [];
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
