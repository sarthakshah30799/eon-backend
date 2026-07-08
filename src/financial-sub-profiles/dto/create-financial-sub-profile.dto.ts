import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CreateFinancialSubProfileDto {
  @ApiProperty({ description: "Financial code ID (UUID)", example: "123e4567-e89b-12d3-a456-426614174000" })
  @IsUUID()
  @IsNotEmpty()
  financialCodeId: string;

  @ApiProperty({ description: "Financial sub code", example: "OPSTOK" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  financialSubCode: string;

  @ApiProperty({ description: "Financial sub name", example: "OPENING STOCK" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  financialSubName: string;

  @ApiProperty({ description: "Priority/Sort order", example: 0, default: 0 })
  @IsInt()
  @Min(0)
  priority: number = 0;
}
