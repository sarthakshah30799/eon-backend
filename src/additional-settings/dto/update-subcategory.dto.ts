import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpdateSubcategoryDto {
  @ApiProperty({ example: "Activate Direct Remittance Updated" })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: "YES" })
  @IsString()
  @IsNotEmpty()
  value: string;
}
