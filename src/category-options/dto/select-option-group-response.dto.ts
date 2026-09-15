import { ApiProperty } from "@nestjs/swagger";
import { SelectOption } from "../category-option.entity";
import { SelectOptionResponseDto } from "./category-option-response.dto";

export class SelectOptionGroupResponseDto {
  @ApiProperty({ description: "Category code" })
  code: string;

  @ApiProperty({ type: [SelectOptionResponseDto] })
  options: SelectOptionResponseDto[];

  static fromCodeAndOptions(
    code: string,
    options: SelectOption[],
  ): SelectOptionGroupResponseDto {
    const dto = new SelectOptionGroupResponseDto();
    dto.code = String(code ?? "")
      .replace(/[_\s-]/g, "")
      .toUpperCase();
    dto.options = options.map(SelectOptionResponseDto.fromEntity);
    return dto;
  }
}
