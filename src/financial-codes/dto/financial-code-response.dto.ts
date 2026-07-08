import { ApiProperty } from "@nestjs/swagger";
import { SelectOptionResponseDto } from "../../category-options/dto/category-option-response.dto";
import { FinancialCode } from "../financial-code.entity";

export class FinancialSubProfileNestedResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  financialSubCode: string;

  @ApiProperty()
  financialSubName: string;

  @ApiProperty()
  priority: number;
}

export class FinancialCodeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true, type: SelectOptionResponseDto })
  financialType: SelectOptionResponseDto | null;

  @ApiProperty()
  financialCode: string;

  @ApiProperty()
  financialName: string;

  @ApiProperty({ nullable: true, type: SelectOptionResponseDto })
  defaultSign: SelectOptionResponseDto | null;

  @ApiProperty()
  priority: number;

  @ApiProperty({ type: [FinancialSubProfileNestedResponseDto], required: false })
  subProfiles?: FinancialSubProfileNestedResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: FinancialCode): FinancialCodeResponseDto {
    const dto = new FinancialCodeResponseDto();
    dto.id = entity.id;
    dto.financialType = entity.financialType ? SelectOptionResponseDto.fromEntity(entity.financialType) : null;
    dto.financialCode = entity.financialCode;
    dto.financialName = entity.financialName;
    dto.defaultSign = entity.defaultSign ? SelectOptionResponseDto.fromEntity(entity.defaultSign) : null;
    dto.priority = entity.priority;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    if (entity.subProfiles) {
      dto.subProfiles = entity.subProfiles.map(sp => {
        const subDto = new FinancialSubProfileNestedResponseDto();
        subDto.id = sp.id;
        subDto.financialSubCode = sp.financialSubCode;
        subDto.financialSubName = sp.financialSubName;
        subDto.priority = sp.priority;
        return subDto;
      });
    }

    return dto;
  }
}
