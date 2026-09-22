import { OmitType, PartialType } from "@nestjs/swagger";
import { CreatePartyProfileDto } from "./create-party-profile.dto";

export class UpdatePartyProfileDto extends PartialType(
  OmitType(CreatePartyProfileDto, ["branchIds"] as const),
) {}
