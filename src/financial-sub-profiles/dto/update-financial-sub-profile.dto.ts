import { PartialType } from "@nestjs/swagger";
import { CreateFinancialSubProfileDto } from "./create-financial-sub-profile.dto";

export class UpdateFinancialSubProfileDto extends PartialType(CreateFinancialSubProfileDto) {}
