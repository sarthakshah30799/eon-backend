import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateStateDto {
  @ApiProperty({ description: "Country ID (UUID)" })
  @IsUUID()
  @IsNotEmpty()
  countryId: string;

  @ApiProperty({ description: "State code", example: "MH", maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({ description: "State name", example: "Maharashtra", maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  name: string;

  @ApiProperty({ description: "GST state code", required: false, maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  gstStateCode?: string;

  @ApiProperty({ description: "CTR state code", required: false, maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  ctrStateCode?: string;
}
