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
  recovery?: RelicErrorRecovery;
}

/** Structured, user-actionable state left behind by a failed mutation. */
export interface RelicErrorRecovery {
  currentPath?: string | null;
  oldPath?: string;
  reason?: string;
  status?: string;
  settingsMigration?: Record<string, unknown>;
  [key: string]: unknown;
}

export type WorkspaceRecoveryStatus = "recovery-required" | "rolled-back";

export interface WorkspaceMutationRecovery extends RelicErrorRecovery {
  currentPath: string | null;
  oldPath: string;
  reason: string;
  status: WorkspaceRecoveryStatus;
  settingsMigration?: Record<string, unknown>;
}

export function ok<T>(value: T): RelicResult<T> {
  return { ok: true, value };
}

export function fail(
  code: string,
  message: string,
  details?: string,
  recovery?: RelicErrorRecovery
): RelicResult<never> {
  const error: RelicError = {
    code,
    message,
    details
  };
  if (recovery) error.recovery = recovery;

  return {
    ok: false,
    error
  };
}
