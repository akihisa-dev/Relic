import { useCallback } from "react";

import type { RightPanelView } from "../store/uiStore";

interface UseAppRightPanelOptions {
  isLinksAvailable: boolean;
  isOutlineAvailable: boolean;
  isRecoveryAvailable: boolean;
  isRightPanelOpen: boolean;
  rightPanelView: RightPanelView;
  setRightPanelView: (view: RightPanelView) => void;
  toggleRightPanel: () => void;
}

function resolveEnabledRightPanelView(
  currentView: RightPanelView,
  isOutlineAvailable: boolean,
  isLinksAvailable: boolean,
  isRecoveryAvailable: boolean
): RightPanelView {
  if (currentView === "outline" && isOutlineAvailable) return "outline";
  if (currentView === "links" && isLinksAvailable) return "links";
  if (currentView === "recovery" && isRecoveryAvailable) return "recovery";
  if (isOutlineAvailable) return "outline";
  if (isLinksAvailable) return "links";
  if (isRecoveryAvailable) return "recovery";
  return "links";
}

export function useAppRightPanel({
  isLinksAvailable,
  isOutlineAvailable,
  isRecoveryAvailable,
  isRightPanelOpen,
  rightPanelView,
  setRightPanelView,
  toggleRightPanel
}: UseAppRightPanelOptions) {
  const isRightPanelAvailable = isOutlineAvailable || isLinksAvailable || isRecoveryAvailable;
  const effectiveRightPanelView = resolveEnabledRightPanelView(
    rightPanelView,
    isOutlineAvailable,
    isLinksAvailable,
    isRecoveryAvailable
  );
  const isEffectiveRightPanelOpen = isRightPanelAvailable && isRightPanelOpen;
  const isLinksPanelActive = isEffectiveRightPanelOpen &&
    isLinksAvailable &&
    effectiveRightPanelView === "links";

  const toggleRightPanelIfAvailable = useCallback((): void => {
    if (!isRightPanelAvailable) return;
    if (!isRightPanelOpen && rightPanelView !== effectiveRightPanelView) {
      setRightPanelView(effectiveRightPanelView);
      return;
    }
    toggleRightPanel();
  }, [effectiveRightPanelView, isRightPanelAvailable, isRightPanelOpen, rightPanelView, setRightPanelView, toggleRightPanel]);

  const handleRightPanelViewButton = useCallback((view: RightPanelView): void => {
    if (view === "outline" && !isOutlineAvailable) return;
    if (view === "links" && !isLinksAvailable) return;
    if (view === "recovery" && !isRecoveryAvailable) return;

    if (isEffectiveRightPanelOpen && effectiveRightPanelView === view) {
      toggleRightPanel();
      return;
    }

    setRightPanelView(view);
  }, [
    effectiveRightPanelView,
    isEffectiveRightPanelOpen,
    isLinksAvailable,
    isOutlineAvailable,
    isRecoveryAvailable,
    setRightPanelView,
    toggleRightPanel
  ]);

  return {
    effectiveRightPanelView,
    handleRightPanelViewButton,
    isEffectiveRightPanelOpen,
    isLinksPanelActive,
    toggleRightPanelIfAvailable
  };
}
