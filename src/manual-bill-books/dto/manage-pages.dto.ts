import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class AllocateManualBookPagesDto {
  @ApiProperty({ type: [String], description: "List of page UUIDs" })
  @IsArray()
  @IsUUID("4", { each: true })
  pageIds: string[];

  @ApiProperty({ description: "Target delivery person UUID" })
  @IsUUID()
  @IsNotEmpty()
  deliveryPersonId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class DeallocateManualBookPagesDto {
  @ApiProperty({ type: [String], description: "List of page UUIDs to deallocate" })
  @IsArray()
  @IsUUID("4", { each: true })
  pageIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UnmapManualBookPagesDto {
  @ApiProperty({ description: "Delivery person UUID" })
  @IsUUID()
  @IsNotEmpty()
  dpUserId: string;

  @ApiProperty({ description: "Manual bill book UUID" })
  @IsUUID()
  @IsNotEmpty()
  manualBookId: string;

  @ApiProperty({ description: "Starting page number" })
  @IsInt()
  @Min(1)
  mvFrom: number;

  @ApiProperty({ description: "Ending page number" })
  @IsInt()
  @Min(1)
  mvTo: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}
