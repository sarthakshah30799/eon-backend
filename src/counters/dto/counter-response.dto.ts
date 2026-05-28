import { ApiProperty } from '@nestjs/swagger';
import { Counter } from '../counter.entity';

export class CounterResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() counterCode: string;
  @ApiProperty() name: string;
  @ApiProperty({ required: false }) description: string;
  @ApiProperty({ required: false }) remark: string;
  @ApiProperty() status: string;
  @ApiProperty({ required: false }) branchId: string;
  @ApiProperty({ required: false }) branchCode: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: Counter): CounterResponseDto {
    const dto = new CounterResponseDto();
    dto.id = entity.id;
    dto.counterCode = entity.counterCode;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.remark = entity.remark;
    dto.status = entity.status;
    dto.branchId = entity.branch?.id || null;
    dto.branchCode = entity.branch?.branchCode || null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
