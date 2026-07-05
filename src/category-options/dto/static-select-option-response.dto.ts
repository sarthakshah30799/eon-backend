import { ApiProperty } from '@nestjs/swagger';
import { StaticSelectOption } from '../category-option-static-options';

export class StaticSelectOptionResponseDto {
  @ApiProperty({ description: 'Option value' })
  value: string;

  @ApiProperty({ description: 'Option label' })
  label: string;

  static fromValue(option: StaticSelectOption): StaticSelectOptionResponseDto {
    return {
      value: option.value,
      label: option.label,
    };
  }
}

