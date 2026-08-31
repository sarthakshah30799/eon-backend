import { PartialType } from "@nestjs/swagger";
import { CreatePurposeGroupDto } from "./create-purpose-group.dto";

export class UpdatePurposeGroupDto extends PartialType(CreatePurposeGroupDto) {}
