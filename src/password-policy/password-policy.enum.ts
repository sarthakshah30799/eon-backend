export enum PasswordPolicyCodeEnum {
  Policy = 'PASSWORD_POLICY',
  MinLength = 'PASSWORD_MIN_LENGTH',
  MaxLength = 'PASSWORD_MAX_LENGTH',
  MinSpecialCharCount = 'PASSWORD_MIN_SPECIAL_CHAR_COUNT',
  MinNumericCount = 'PASSWORD_MIN_NUMERIC_CHAR_COUNT',
  MinAlphaCount = 'PASSWORD_MIN_ALPHA_CHAR_COUNT',
  MaxInvalidAttempts = 'PASSWORD_MAX_INVALID_ATTEMPTS',
}

export enum PasswordValidationCodeEnum {
  TooShort = 'PASSWORD_TOO_SHORT',
  TooLong = 'PASSWORD_TOO_LONG',
  MissingSpecialChars = 'PASSWORD_MISSING_SPECIAL_CHARS',
  MissingNumericChars = 'PASSWORD_MISSING_NUMERIC_CHARS',
  MissingAlphaChars = 'PASSWORD_MISSING_ALPHA_CHARS',
  AccountLocked = 'ACCOUNT_LOCKED',
  InvalidPolicyConfig = 'PASSWORD_POLICY_INVALID',
}

