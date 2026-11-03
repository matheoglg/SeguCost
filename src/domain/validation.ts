// Field validation results shared by store actions and forms (errors appear next to each field).

export type FieldErrors = Record<string, string>;
export type Result<T = undefined> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (errors: FieldErrors): Result<never> => ({ ok: false, errors });

/** Collects errors; returns undefined when there are none. */
export function check(rules: [field: string, failed: boolean, message: string][]): FieldErrors | undefined {
  const errors: FieldErrors = {};
  for (const [field, failed, message] of rules) if (failed && !errors[field]) errors[field] = message;
  return Object.keys(errors).length ? errors : undefined;
}

export const isPositive = (n: number | undefined) => typeof n === 'number' && Number.isFinite(n) && n > 0;
