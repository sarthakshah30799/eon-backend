import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpdateCategoryDto {
  @ApiProperty({ example: "Remittance Settings Updated" })
  @IsString()
  @IsNotEmpty()
  title: string;
}
