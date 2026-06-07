import { PartialType } from "@nestjs/swagger";
import { CreateCountryGroupDto } from "./create-country-group.dto";

export class UpdateCountryGroupDto extends PartialType(CreateCountryGroupDto) {}
