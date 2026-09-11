import { Transform } from "class-transformer";
import type { TransformFnParams } from "class-transformer";

/**
 * Parse boolean query params safely under ValidationPipe
 * `enableImplicitConversion: true`, which otherwise turns the string
 * `"false"` into boolean `true` via `Boolean("false")`.
 *
 * Prefer the raw plain-object value (`obj[key]`) when present.
 */
export const parseBooleanQuery = ({
  value,
  obj,
  key,
}: TransformFnParams): boolean | undefined => {
  const raw =
    obj != null && key != null && Object.prototype.hasOwnProperty.call(obj, key)
      ? (obj as Record<string, unknown>)[String(key)]
      : value;

  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  if (typeof raw === "boolean") {
    // Ambiguous once implicit conversion has already run; keep as-is.
    return raw;
  }
  if (typeof raw === "number") {
    return raw !== 0;
  }

  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  return undefined;
};

export const BooleanQuery = () => Transform(parseBooleanQuery);
