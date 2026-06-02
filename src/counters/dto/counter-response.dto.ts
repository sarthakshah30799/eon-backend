import { ApiProperty } from '@nestjs/swagger';
import { Counter } from '../counter.entity';

export class CounterResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() counterNo: number;
  @ApiProperty() name: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() isRetail: boolean;
  @ApiProperty() isBulk: boolean;
  @ApiProperty() isCombine: boolean;
  @ApiProperty({ required: false }) branchId: string;
  @ApiProperty({ required: false }) branchCode: string;
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
    dto.branchId = entity.branch?.id || null;
    dto.branchCode = entity.branch?.code || null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
