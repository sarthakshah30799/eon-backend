import { ApiProperty } from "@nestjs/swagger";

export class PaymentMethodOptionDto {
  @ApiProperty({
    example: "UPI",
    description: "Transaction payment method enum value",
  })
  value: string;

  @ApiProperty({ example: "UPI" })
  label: string;
}
