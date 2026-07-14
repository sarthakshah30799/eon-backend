import { ApiProperty } from '@nestjs/swagger';

export class MigrationVerifyResponseDto {
  @ApiProperty()
  verified: boolean;

  @ApiProperty()
  message: string;
}

