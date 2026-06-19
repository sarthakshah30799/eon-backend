import { ApiProperty } from '@nestjs/swagger';
import { PasswordPolicyCodeEnum } from './password-policy.enum';

export interface PasswordPolicyConfig {
  minLength?: number;
  maxLength?: number;
  minSpecialCharCount?: number;
  minNumericCount?: number;
  minAlphaCount?: number;
  maxInvalidAttempts?: number;
}

export const PASSWORD_POLICY_CHILDREN = [
  {
    code: PasswordPolicyCodeEnum.MinLength,
    label: 'Minimum Length',
  },
  {
    code: PasswordPolicyCodeEnum.MaxLength,
    label: 'Maximum Length',
  },
  {
    code: PasswordPolicyCodeEnum.MinSpecialCharCount,
    label: 'Minimum Special Characters',
  },
  {
    code: PasswordPolicyCodeEnum.MinNumericCount,
    label: 'Minimum Numeric Characters',
  },
  {
    code: PasswordPolicyCodeEnum.MinAlphaCount,
    label: 'Minimum Alpha Characters',
  },
  {
    code: PasswordPolicyCodeEnum.MaxInvalidAttempts,
    label: 'Maximum Invalid Attempts',
  },
] as const;

export class PasswordPolicyResponseDto {
  @ApiProperty({ example: 6, required: false })
  minLength?: number;

  @ApiProperty({ example: 128, required: false })
  maxLength?: number;

  @ApiProperty({ example: 0, required: false })
  minSpecialCharCount?: number;

  @ApiProperty({ example: 0, required: false })
  minNumericCount?: number;

  @ApiProperty({ example: 0, required: false })
  minAlphaCount?: number;

  @ApiProperty({ example: 0, required: false })
  maxInvalidAttempts?: number;

  static fromConfig(config: PasswordPolicyConfig): PasswordPolicyResponseDto {
    const dto = new PasswordPolicyResponseDto();
    if (config.minLength !== undefined) {
      dto.minLength = config.minLength;
    }
    if (config.maxLength !== undefined) {
      dto.maxLength = config.maxLength;
    }
    if (config.minSpecialCharCount !== undefined) {
      dto.minSpecialCharCount = config.minSpecialCharCount;
    }
    if (config.minNumericCount !== undefined) {
      dto.minNumericCount = config.minNumericCount;
    }
    if (config.minAlphaCount !== undefined) {
      dto.minAlphaCount = config.minAlphaCount;
    }
    if (config.maxInvalidAttempts !== undefined) {
      dto.maxInvalidAttempts = config.maxInvalidAttempts;
    }
    return dto;
  }
}
