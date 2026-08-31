import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PassengerPassportLookupResponseDto {
  @ApiProperty({ example: true })
  found: boolean;

  @ApiProperty({ example: "Passenger found" })
  message: string;

  @ApiPropertyOptional({ type: Object })
  passenger: Record<string, unknown> | null;
}
