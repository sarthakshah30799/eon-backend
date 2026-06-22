import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsNotEmpty, IsString, ValidateIf } from "class-validator";
import { WorkflowStatus } from "../../common/enums/workflow-status.enum";

export class ReviewPartyProfileDto {
  @ApiProperty({ enum: [WorkflowStatus.APPROVE, WorkflowStatus.REJECT] })
  @IsIn([WorkflowStatus.APPROVE, WorkflowStatus.REJECT])
  status: WorkflowStatus.APPROVE | WorkflowStatus.REJECT;

  @ApiProperty({ description: "Active flag to store with the review" })
  @IsBoolean()
  active: boolean;

  @ApiPropertyOptional({ description: "Reject reason when status is reject" })
  @ValidateIf(dto => dto.status === WorkflowStatus.REJECT)
  @IsString()
  @IsNotEmpty()
  rejectReason?: string;
}
