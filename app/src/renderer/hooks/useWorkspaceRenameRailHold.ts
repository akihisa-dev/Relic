import { useCallback, useEffect, useRef, useState } from "react";

export function useWorkspaceRenameRailHold(): {
  holdWorkspaceRailAfterRename: () => void;
  isWorkspaceRenameActive: boolean;
  isWorkspaceRenameHoldingRail: boolean;
  setIsWorkspaceRenameActive: (isActive: boolean) => void;
} {
  const [isWorkspaceRenameActive, setIsWorkspaceRenameActive] = useState(false);
  const [isWorkspaceRenameHoldingRail, setIsWorkspaceRenameHoldingRail] = useState(false);
  const workspaceRenameHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holdWorkspaceRailAfterRename = useCallback((): void => {
    if (workspaceRenameHoldTimerRef.current) clearTimeout(workspaceRenameHoldTimerRef.current);
    setIsWorkspaceRenameHoldingRail(true);
    workspaceRenameHoldTimerRef.current = setTimeout(() => {
      setIsWorkspaceRenameHoldingRail(false);
      workspaceRenameHoldTimerRef.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    return () => {
      if (workspaceRenameHoldTimerRef.current) clearTimeout(workspaceRenameHoldTimerRef.current);
    };
  }, []);

  return {
    holdWorkspaceRailAfterRename,
    isWorkspaceRenameActive,
    isWorkspaceRenameHoldingRail,
    setIsWorkspaceRenameActive
  };
}
