export type PassengerDisplayNameInput = {
  passportPassengerName?: string | null;
  passportNumber?: string | null;
  passportIssueAt?: string | null;
  passportIssueDate?: string | null;
  passportExpiryDate?: string | null;
  panHolderName?: string | null;
  panNumber?: string | null;
  panDob?: string | null;
  paidByPanHolderName?: string | null;
  partyProfileName?: string | null;
};

const trimPassengerText = (value?: string | null) => String(value ?? "").trim();

export const hasPassengerPassportDetails = (
  input: PassengerDisplayNameInput,
) =>
  Boolean(
    trimPassengerText(input.passportPassengerName) ||
      trimPassengerText(input.passportNumber) ||
      trimPassengerText(input.passportIssueAt) ||
      trimPassengerText(input.passportIssueDate) ||
      trimPassengerText(input.passportExpiryDate),
  );

export const resolvePassengerDisplayName = (
  input: PassengerDisplayNameInput,
): string => {
  if (
    hasPassengerPassportDetails(input) &&
    trimPassengerText(input.passportPassengerName)
  ) {
    return trimPassengerText(input.passportPassengerName);
  }

  if (trimPassengerText(input.panHolderName)) {
    return trimPassengerText(input.panHolderName);
  }

  if (trimPassengerText(input.paidByPanHolderName)) {
    return trimPassengerText(input.paidByPanHolderName);
  }

  return trimPassengerText(input.partyProfileName);
};

export const resolvePassengerDisplayNameFromSnapshot = (
  snapshot: Record<string, unknown> | null | undefined,
  partyProfileName?: string | null,
) => {
  if (!snapshot) {
    return trimPassengerText(partyProfileName);
  }

  return resolvePassengerDisplayName({
    passportPassengerName:
      typeof snapshot.passportPassengerName === "string"
        ? snapshot.passportPassengerName
        : null,
    passportNumber:
      typeof snapshot.passportNumber === "string"
        ? snapshot.passportNumber
        : null,
    passportIssueAt:
      typeof snapshot.passportIssueAt === "string"
        ? snapshot.passportIssueAt
        : null,
    passportIssueDate:
      typeof snapshot.passportIssueDate === "string"
        ? snapshot.passportIssueDate
        : null,
    passportExpiryDate:
      typeof snapshot.passportExpiryDate === "string"
        ? snapshot.passportExpiryDate
        : null,
    panHolderName:
      typeof snapshot.panHolderName === "string" ? snapshot.panHolderName : null,
    panNumber:
      typeof snapshot.panNumber === "string" ? snapshot.panNumber : null,
    panDob: typeof snapshot.panDob === "string" ? snapshot.panDob : null,
    paidByPanHolderName:
      typeof snapshot.paidByPanHolderName === "string"
        ? snapshot.paidByPanHolderName
        : null,
    partyProfileName,
  });
};
