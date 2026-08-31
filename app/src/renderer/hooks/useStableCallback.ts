import { useCallback } from "react";

import { useLatest } from "./useLatest";

/**
 * Keeps a callback identity stable while dispatching to the latest render's
 * implementation.  This is intended for memoized component boundaries whose
 * actions need fresh state without turning state-only changes into prop
 * changes.
 */
export function useStableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result
): (...args: Args) => Result {
  const callbackRef = useLatest(callback);
  return useCallback((...args: Args): Result => callbackRef.current(...args), [callbackRef]);
}

/**
 * Optional counterpart for boundaries where the presence of an action is
 * itself meaningful.  The wrapper stays stable while the action is present,
 * but preserves `undefined` when the capability is unavailable.
 */
export function useStableOptionalCallback<Args extends unknown[], Result>(
  callback: ((...args: Args) => Result) | undefined
): ((...args: Args) => Result) | undefined {
  const callbackRef = useLatest(callback);
  const stableCallback = useCallback((...args: Args): Result => {
    const currentCallback = callbackRef.current;
    return currentCallback
      ? currentCallback(...args)
      : undefined as Result;
  }, [callbackRef]);

  return callback === undefined ? undefined : stableCallback;
}
