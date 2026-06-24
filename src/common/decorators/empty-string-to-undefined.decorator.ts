import { Transform } from 'class-transformer';

export const EmptyStringToUndefined = () =>
  Transform(({ value }) => (value === '' ? undefined : value));
