import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CounterStatus } from '../counter.entity';

export class CreateCounterDto {
  @ApiProperty({ description: 'Branch ID (UUID)', required: false })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ description: 'Unique counter code', example: 'CTR-001' })
  @IsString()
  @IsNotEmpty()
  counterCode: string;

  @ApiProperty({ description: 'Counter name', example: 'Counter 1' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Remark', required: false })
  @IsString()
  @IsOptional()
  remark?: string;

  @ApiProperty({ description: 'Status', enum: CounterStatus, default: CounterStatus.PENDING, required: false })
  @IsEnum(CounterStatus)
  @IsOptional()
  status?: CounterStatus;
}
