import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";

export class CreateAdvanceAdjustmentItemDto {
  @ApiProperty({ description: "Sale transaction ID being adjusted" })
  @IsUUID()
  @IsNotEmpty()
  transactionId: string;

  @ApiProperty({
    description: "Adjustment amount allocated to this sale",
    example: "20000.00",
  })
  @IsNumberString()
  @IsNotEmpty()
  adjustmentAmount: string;
}

export class CreateAdvanceAdjustmentDto {
  @ApiProperty({ description: "Branch ID (UUID)" })
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ description: "Counter ID (UUID)" })
  @IsUUID()
  @IsNotEmpty()
  counterId: string;

  @ApiProperty({ description: "Transaction Date (YYYY-MM-DD)" })
  @IsDateString()
  @IsNotEmpty()
  transactionDate: string;

  @ApiProperty({ description: "As-on Date for filtering sales (YYYY-MM-DD)" })
  @IsDateString()
  @IsNotEmpty()
  asOnDate: string;

  @ApiProperty({ description: "Party Profile ID (UUID)" })
  @IsUUID()
  @IsNotEmpty()
  partyProfileId: string;

  @ApiPropertyOptional({ description: "PAN Card Number" })
  @IsString()
  @IsOptional()
  panNumber?: string;

  @ApiPropertyOptional({ description: "PAN Holder Name" })
  @IsString()
  @IsOptional()
  panName?: string;

  @ApiPropertyOptional({ description: "PAN Date of Birth (YYYY-MM-DD)" })
  @IsDateString()
  @IsOptional()
  panDob?: string;

  @ApiProperty({ description: "Narration / remarks" })
  @IsString()
  @IsNotEmpty()
  narration: string;

  @ApiProperty({
    type: [CreateAdvanceAdjustmentItemDto],
    description: "Outstanding sales to adjust",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateAdvanceAdjustmentItemDto)
  items: CreateAdvanceAdjustmentItemDto[];
}
