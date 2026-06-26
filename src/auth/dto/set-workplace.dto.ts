import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SetWorkplaceDto {
  @ApiProperty({ description: 'Branch ID (UUID)' })
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ description: 'Counter ID (UUID)' })
  @IsString()
  @IsNotEmpty()
  counterId: string;
}
