import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsUUID } from "class-validator";

export class UpdatePartyProfileBranchesDto {
  @ApiProperty({
    description: "Assigned branch IDs (UUID)",
    type: [String],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  branchIds: string[];
}
