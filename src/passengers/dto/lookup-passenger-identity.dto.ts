import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class LookupPassengerIdentityDto {
  @ApiPropertyOptional({ example: "ABCDE1234F" })
  @IsOptional()
  @IsString()
  panNumber?: string;
  @ApiPropertyOptional({ example: "P1234567" })
  @IsOptional()
  @IsString()
  passportNumber?: string;
}
