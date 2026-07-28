import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LookupPassengerPassportDto {
  @ApiProperty({ example: 'P1234567' })
  @IsString()
  @IsNotEmpty()
  passportNumber: string;
}
