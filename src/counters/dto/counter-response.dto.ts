import { ApiProperty } from '@nestjs/swagger';
import { Counter } from '../counter.entity';

export class CounterResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() counterNo: number;
  @ApiProperty() counterName: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() isRetailCnt: boolean;
  @ApiProperty() isBulkCnt: boolean;
  @ApiProperty() isCombineCnt: boolean;
  @ApiProperty({ required: false }) branchId: string;
  @ApiProperty({ required: false }) branchCode: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: Counter): CounterResponseDto {
    const dto = new CounterResponseDto();
    dto.id = entity.id;
    dto.counterNo = entity.counterNo;
    dto.counterName = entity.counterName;
    dto.isActive = entity.isActive;
    dto.isRetailCnt = entity.isRetailCnt;
    dto.isBulkCnt = entity.isBulkCnt;
    dto.isCombineCnt = entity.isCombineCnt;
    dto.branchId = entity.branch?.id || null;
    dto.branchCode = entity.branch?.branchCode || null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
