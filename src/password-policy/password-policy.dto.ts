import { ApiProperty } from '@nestjs/swagger';
import { PasswordPolicyCodeEnum } from './password-policy.enum';

export interface PasswordPolicyConfig {
  minLength: number;
  maxLength: number;
  minSpecialCharCount: number;
  minNumericCount: number;
  minAlphaCount: number;
  maxInvalidAttempts: number;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicyConfig = {
  minLength: 6,
  maxLength: 128,
  minSpecialCharCount: 0,
  minNumericCount: 0,
  minAlphaCount: 0,
  maxInvalidAttempts: 0,
};

export const PASSWORD_POLICY_CHILDREN = [
  {
    code: PasswordPolicyCodeEnum.MinLength,
    label: 'Minimum Length',
    defaultValue: DEFAULT_PASSWORD_POLICY.minLength,
  },
  {
    code: PasswordPolicyCodeEnum.MaxLength,
    label: 'Maximum Length',
    defaultValue: DEFAULT_PASSWORD_POLICY.maxLength,
  },
  {
    code: PasswordPolicyCodeEnum.MinSpecialCharCount,
    label: 'Minimum Special Characters',
    defaultValue: DEFAULT_PASSWORD_POLICY.minSpecialCharCount,
  },
  {
    code: PasswordPolicyCodeEnum.MinNumericCount,
    label: 'Minimum Numeric Characters',
    defaultValue: DEFAULT_PASSWORD_POLICY.minNumericCount,
  },
  {
    code: PasswordPolicyCodeEnum.MinAlphaCount,
    label: 'Minimum Alpha Characters',
    defaultValue: DEFAULT_PASSWORD_POLICY.minAlphaCount,
  },
  {
    code: PasswordPolicyCodeEnum.MaxInvalidAttempts,
    label: 'Maximum Invalid Attempts',
    defaultValue: DEFAULT_PASSWORD_POLICY.maxInvalidAttempts,
  },
] as const;

export class PasswordPolicyResponseDto {
  @ApiProperty({ example: 6 })
  minLength: number;

  @ApiProperty({ example: 128 })
  maxLength: number;

  @ApiProperty({ example: 0 })
  minSpecialCharCount: number;

  @ApiProperty({ example: 0 })
  minNumericCount: number;

  @ApiProperty({ example: 0 })
  minAlphaCount: number;

  @ApiProperty({ example: 0 })
  maxInvalidAttempts: number;

  static fromConfig(config: PasswordPolicyConfig): PasswordPolicyResponseDto {
    const dto = new PasswordPolicyResponseDto();
    dto.minLength = config.minLength;
    dto.maxLength = config.maxLength;
    dto.minSpecialCharCount = config.minSpecialCharCount;
    dto.minNumericCount = config.minNumericCount;
    dto.minAlphaCount = config.minAlphaCount;
    dto.maxInvalidAttempts = config.maxInvalidAttempts;
    return dto;
  }
}

