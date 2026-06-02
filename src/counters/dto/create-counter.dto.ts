import { IsString, IsNotEmpty, IsOptional, IsUUID, IsBoolean, IsInt, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCounterDto {
  @ApiProperty({ description: 'Branch ID (UUID)', required: false })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ description: 'Counter No.', example: 1 })
  @IsInt()
  @IsNotEmpty()
  counterNo: number;

  @ApiProperty({ description: 'Counter name', example: 'Counter 1', maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  counterName: string;

  @ApiProperty({ description: 'Is Active', default: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Is Retail Counter', default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isRetailCnt?: boolean;

  @ApiProperty({ description: 'Is Bulk Counter', default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isBulkCnt?: boolean;

  @ApiProperty({ description: 'Is Combine Counter', default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isCombineCnt?: boolean;
}

