import { PartialType } from "@nestjs/swagger";
import { CreateSelectOptionDto } from "./create-category-option.dto";

export class UpdateSelectOptionDto extends PartialType(CreateSelectOptionDto) {}
