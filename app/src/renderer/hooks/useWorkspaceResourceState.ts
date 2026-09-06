import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RelicResult } from "../../shared/result";
import type { WorkspaceResourceRequest } from "../workspaceResourceLoader";

export type WorkspaceResourceState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; value: T };

interface UseWorkspaceResourceStateInput<T> extends WorkspaceResourceRequest {
  available?: boolean;
  loadFailedMessage: string;
  loadResource: (request: WorkspaceResourceRequest) => Promise<RelicResult<T>>;
}

interface WorkspaceResourceControllerInput<T> extends UseWorkspaceResourceStateInput<T> {
  enabled?: boolean;
  refreshToken?: unknown;
  retainWhileRefreshing?: boolean;
  onError?: (message: string) => void;
}

export function useWorkspaceResourceState<T>(input: UseWorkspaceResourceStateInput<T>): WorkspaceResourceState<T> {
  return useWorkspaceResourceController(input).state;
}

/** Owns request replacement and presentation; caching remains the loader's responsibility. */
export function useWorkspaceResourceController<T>({
  available = true,
  enabled = true,
  loadFailedMessage,
  loadResource,
  onError,
  refreshToken,
  retainWhileRefreshing = false,
  revision,
  workspaceId
}: WorkspaceResourceControllerInput<T>): {
  state: WorkspaceResourceState<T>;
  reload: () => Promise<boolean>;
} {
  const workspaceScope = useMemo(() => ({ workspaceId }), [workspaceId]);
  const requestScope = useMemo(() => ({ workspaceScope, revision, refreshToken }), [workspaceScope, revision, refreshToken]);
  const currentScope = useRef(requestScope);
  currentScope.current = requestScope;
  const generation = useRef(0);
  const [snapshot, setSnapshot] = useState<{
    scope: typeof requestScope;
    state: WorkspaceResourceState<T>;
  } | null>(null);

  const reload = useCallback(async (): Promise<boolean> => {
    if (currentScope.current !== requestScope) return false;
    if (!available) return true;
    const requestGeneration = ++generation.current;
    const isCurrent = (): boolean => currentScope.current === requestScope && generation.current === requestGeneration;
    let result: RelicResult<T>;
    try {
      result = await loadResource({ revision, workspaceId });
    } catch {
      result = { ok: false, error: { code: "RESOURCE_LOAD_FAILED", message: loadFailedMessage } };
    }
    if (!isCurrent()) return false;
    setSnapshot({
      scope: requestScope,
      state: result.ok
        ? { status: "ready", value: result.value }
        : { status: "error", message: result.error.message }
    });
    if (!result.ok) onError?.(result.error.message);
    return result.ok;
  }, [available, loadFailedMessage, loadResource, onError, requestScope, revision, workspaceId]);

  useEffect(() => {
    if (enabled) void reload();
    return () => { generation.current += 1; };
  }, [enabled, reload]);

  const canPresentSnapshot = snapshot && (
    snapshot.scope === requestScope ||
    (retainWhileRefreshing && snapshot.scope.workspaceScope === workspaceScope)
  );
  const state: WorkspaceResourceState<T> = canPresentSnapshot
    ? snapshot.state
    : available ? { status: "loading" } : { status: "error", message: loadFailedMessage };
  return { state, reload };
}
