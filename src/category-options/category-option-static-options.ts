import { CategoryOptionCodeEnum } from "./category-option-code.enum";
import { ClientType } from "../party-profiles/party-profile.entity";
import { TransactionTypeProfileEnum } from "../transactions/transactions.enums";

export interface StaticSelectOption {
  value: string;
  label: string;
}

const toStaticOptions = (values: string[]): StaticSelectOption[] =>
  values.map((value) => ({
    value,
    label: value,
  }));

export const STATIC_SELECT_OPTIONS: Record<string, StaticSelectOption[]> = {
  [CategoryOptionCodeEnum.MasterDocument]: toStaticOptions(
    Object.values(ClientType),
  ),
  [CategoryOptionCodeEnum.TransactionDocument]: toStaticOptions(
    Object.values(TransactionTypeProfileEnum),
  ),
};

export const getStaticSelectOptions = (
  code: string,
): StaticSelectOption[] | null => {
  const normalizedCode = code
    .trim()
    .replace(/[_\s-]/g, "")
    .toUpperCase();
  return STATIC_SELECT_OPTIONS[normalizedCode] ?? null;
};
