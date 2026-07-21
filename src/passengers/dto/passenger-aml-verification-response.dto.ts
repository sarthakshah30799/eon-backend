import { ApiProperty } from '@nestjs/swagger';

export class PassengerAmlVerificationResponseDto {
  @ApiProperty({ example: true })
  verified: boolean;

  @ApiProperty({ example: 'Passenger AML details verified successfully' })
  message: string;
}
