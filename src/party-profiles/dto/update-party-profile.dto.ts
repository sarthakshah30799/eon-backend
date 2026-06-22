import { PartialType } from "@nestjs/swagger";
import { CreatePartyProfileDto } from "./create-party-profile.dto";

export class UpdatePartyProfileDto extends PartialType(CreatePartyProfileDto) {}
