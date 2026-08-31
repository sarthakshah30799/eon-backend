import { ApiProperty } from "@nestjs/swagger";
import { Counter } from "../counter.entity";

export class CounterResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() counterNo: number;
  @ApiProperty() name: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() isRetail: boolean;
  @ApiProperty() isBulk: boolean;
  @ApiProperty() isCombine: boolean;
  @ApiProperty({ type: [String], required: false }) branchIds: string[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: Counter): CounterResponseDto {
    const dto = new CounterResponseDto();
    dto.id = entity.id;
    dto.counterNo = entity.counterNo;
    dto.name = entity.name;
    dto.isActive = entity.isActive;
    dto.isRetail = entity.isRetail;
    dto.isBulk = entity.isBulk;
    dto.isCombine = entity.isCombine;
    dto.branchIds = entity.branchLinks
      ? entity.branchLinks
          .map((link) => link.branchId || link.branch?.id)
          .filter((id): id is string => Boolean(id))
      : [];
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
