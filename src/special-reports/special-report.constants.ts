export const SPECIAL_REPORT_ACCOUNT_POSTING = "ACCOUNT_POSTING";

/** Result column names (case-insensitive) that must never be returned to clients. */
export const SPECIAL_REPORT_SENSITIVE_COLUMN_PATTERN =
  /(^|_)(password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|credential|credentials|authorization|access[_-]?token|refresh[_-]?token)(_|$)/i;

export const SPECIAL_REPORT_SENSITIVE_COLUMN_NAMES = new Set([
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "api_key",
  "apikey",
  "private_key",
  "privatekey",
  "authorization",
  "credential",
  "credentials",
  "password_hash",
  "passwordhash",
]);
