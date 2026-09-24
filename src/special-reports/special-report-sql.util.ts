import { BadRequestException } from "@nestjs/common";

const PARAM_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const extractCommentFreeSql = (sql: string) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .trim();

export const assertSelectOnlySql = (sql: string) => {
  const normalized = extractCommentFreeSql(sql);
  if (!normalized) {
    throw new BadRequestException("Report query is empty");
  }

  if (!/^\s*select\b/i.test(normalized)) {
    throw new BadRequestException("Report query must be a SELECT statement");
  }

  if (/;\s*\S/i.test(normalized)) {
    throw new BadRequestException(
      "Report query must be a single SELECT statement",
    );
  }
};

export const extractNamedParameterNames = (sql: string): string[] => {
  const names = new Set<string>();
  const pattern = /(?<![:\w]):(\.\.\.)?([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(sql)) !== null) {
    names.add(match[2]);
  }

  return [...names];
};

export const bindNamedSqlParameters = (
  sql: string,
  params: Record<string, unknown>,
): { text: string; values: unknown[] } => {
  const values: unknown[] = [];

  let text = sql.replace(
    /(?<![:\w]):(\.\.\.)([a-zA-Z_][a-zA-Z0-9_]*)/g,
    (_full, _spread: string, name: string) => {
      if (!PARAM_NAME_PATTERN.test(name)) {
        throw new BadRequestException(`Invalid parameter name: ${name}`);
      }

      const value = params[name];
      if (!Array.isArray(value)) {
        throw new BadRequestException(
          `Parameter "${name}" must be an array`,
        );
      }

      if (value.length === 0) {
        // Keep IN () valid for optional filters: match no rows when expanded empty.
        values.push(null);
        return `$${values.length}`;
      }

      return value
        .map((item) => {
          values.push(item);
          return `$${values.length}`;
        })
        .join(", ");
    },
  );

  text = text.replace(
    /(?<![:\w]):([a-zA-Z_][a-zA-Z0-9_]*)/g,
    (_full, name: string) => {
      if (!(name in params)) {
        throw new BadRequestException(`Missing parameter: ${name}`);
      }

      values.push(params[name]);
      return `$${values.length}`;
    },
  );

  return { text, values };
};
