import { useCallback, useEffect, useRef } from "react";

import type { IsCurrentRequest } from "./useAsyncRequestGuard";

export interface WorkspaceRequestGuard {
  beginWorkspaceRequest: () => IsCurrentRequest;
  beginWorkspaceRequestFor: (workspaceId: string | null) => IsCurrentRequest;
  invalidateWorkspaceRequests: (nextWorkspaceId?: string | null) => void;
}

export function useWorkspaceRequestGuard(
  activeWorkspaceId: string | null
): WorkspaceRequestGuard {
  const generationRef = useRef(0);
  const renderedWorkspaceIdRef = useRef(activeWorkspaceId);
  const workspaceIdRef = useRef(activeWorkspaceId);

  if (renderedWorkspaceIdRef.current !== activeWorkspaceId) {
    renderedWorkspaceIdRef.current = activeWorkspaceId;
    if (workspaceIdRef.current !== activeWorkspaceId) {
      workspaceIdRef.current = activeWorkspaceId;
      generationRef.current += 1;
    }
  }

  useEffect(() => {
    return () => {
      generationRef.current += 1;
    };
  }, []);

  const beginWorkspaceRequestFor = useCallback((workspaceId: string | null): IsCurrentRequest => {
    const generation = generationRef.current;
    return () => (
      generationRef.current === generation &&
      workspaceIdRef.current === workspaceId
    );
  }, []);
  const beginWorkspaceRequest = useCallback(
    (): IsCurrentRequest => beginWorkspaceRequestFor(activeWorkspaceId),
    [activeWorkspaceId, beginWorkspaceRequestFor]
  );
  const invalidateWorkspaceRequests = useCallback((nextWorkspaceId?: string | null): void => {
    generationRef.current += 1;
    if (nextWorkspaceId !== undefined) {
      workspaceIdRef.current = nextWorkspaceId;
    }
  }, []);

  return { beginWorkspaceRequest, beginWorkspaceRequestFor, invalidateWorkspaceRequests };
}
