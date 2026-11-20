import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RejectTransferDto {
  @ApiPropertyOptional({
    description: "Rejection reason or remarks",
    example: "Insufficient stock balance at source counter",
  })
  @IsOptional()
  @IsString()
  remarks?: string | null;
}
