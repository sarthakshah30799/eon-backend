import { ApiProperty } from "@nestjs/swagger";
import { SelectOptionResponseDto } from "../../category-options/dto/category-option-response.dto";
import { FinancialSubProfile } from "../financial-sub-profile.entity";

export class FinancialSubProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  financialCodeId: string;

  @ApiProperty()
  financialCode: string;

  @ApiProperty({ nullable: true, type: SelectOptionResponseDto })
  financialType: SelectOptionResponseDto | null;

  @ApiProperty()
  financialName: string;

  @ApiProperty()
  financialSubCode: string;

  @ApiProperty()
  financialSubName: string;

  @ApiProperty()
  priority: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: FinancialSubProfile): FinancialSubProfileResponseDto {
    const dto = new FinancialSubProfileResponseDto();
    dto.id = entity.id;
    dto.financialCodeId = entity.financialCode?.id || null;
    dto.financialCode = entity.financialCode?.financialCode || null;
    dto.financialType = entity.financialCode?.financialType
      ? SelectOptionResponseDto.fromEntity(entity.financialCode.financialType)
      : null;
    dto.financialName = entity.financialCode?.financialName || null;
    dto.financialSubCode = entity.financialSubCode;
    dto.financialSubName = entity.financialSubName;
    dto.priority = entity.priority;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
