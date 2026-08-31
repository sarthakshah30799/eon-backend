export const DEFAULT_CARD_NUMBER_LENGTH = 16;
export const MIN_CARD_NUMBER_LENGTH = 8;
export const MAX_CARD_NUMBER_LENGTH = 19;

export type CardNumberRule = {
  length?: number | null;
  allowMasking?: boolean | null;
};

export const resolveCardNumberLength = (length?: number | null) => {
  const parsed = Number(length);
  if (
    Number.isInteger(parsed) &&
    parsed >= MIN_CARD_NUMBER_LENGTH &&
    parsed <= MAX_CARD_NUMBER_LENGTH
  ) {
    return parsed;
  }
  return DEFAULT_CARD_NUMBER_LENGTH;
};

export const normalizeCardNumber = (value?: string | null) =>
  (value ?? "").replace(/\s/g, "").toUpperCase();

const maskPattern = (length: number) => {
  if (length <= 8) {
    return new RegExp(`^\\d{4}X{${Math.max(length - 4, 0)}}$`);
  }
  return new RegExp(`^\\d{4}X{${length - 8}}\\d{4}$`);
};

export const validateCardNumber = (
  value: string,
  rule: CardNumberRule = {},
  requireMask = false,
) => {
  const cardNumber = normalizeCardNumber(value);
  const length = resolveCardNumberLength(rule.length);
  const allowMasking = Boolean(rule.allowMasking);
  const isDigits = new RegExp(`^\\d{${length}}$`).test(cardNumber);
  const isMasked = maskPattern(length).test(cardNumber);

  if (requireMask && allowMasking) {
    return isMasked
      ? { valid: true as const, cardNumber }
      : {
          valid: false as const,
          cardNumber,
          message: `Card number must be a ${length}-character mask`,
        };
  }
  if (isDigits) {
    return { valid: true as const, cardNumber };
  }
  if (allowMasking && isMasked) {
    return { valid: true as const, cardNumber };
  }
  if (allowMasking) {
    return {
      valid: false as const,
      cardNumber,
      message: `Card number must be ${length} digits or a ${length}-character mask`,
    };
  }
  return {
    valid: false as const,
    cardNumber,
    message: `Card number must be ${length} digits`,
  };
};
