export type RelicResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: RelicError;
    };

export interface RelicError {
  code: string;
  message: string;
  details?: string;
}

export function ok<T>(value: T): RelicResult<T> {
  return { ok: true, value };
}

export function fail(code: string, message: string, details?: string): RelicResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      details
    }
  };
}
