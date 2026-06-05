import { useCallback } from "react";

import type { HeadingScrollTarget, OutlineHeading } from "../editorDerivedState";
import type { PaneId } from "../store/editorStore";

interface UseAppInlineHandlersInput {
  focusedPane: PaneId;
  openSecondarySidebar: (view: "ai-chat") => void;
  setEditorActionPulse: (updater: (value: number) => number) => void;
  setLeftPaneScrollHeading: (heading: HeadingScrollTarget | undefined) => void;
  setRightPaneScrollHeading: (heading: HeadingScrollTarget | undefined) => void;
}

export function useAppInlineHandlers({
  focusedPane,
  openSecondarySidebar,
  setEditorActionPulse,
  setLeftPaneScrollHeading,
  setRightPaneScrollHeading
}: UseAppInlineHandlersInput): {
  onEditorAction: () => void;
  onFileOpenMotion: () => void;
  onOutlineHeadingClick: (heading: OutlineHeading) => void;
  onScrollTargetHandled: (pane: PaneId) => void;
  openAIChatSidebar: () => void;
} {
  const pulseEditorAction = useCallback(() => {
    setEditorActionPulse((value) => value + 1);
  }, [setEditorActionPulse]);
  const onOutlineHeadingClick = useCallback((heading: OutlineHeading) => {
    const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;
    setScrollHeading(heading);
  }, [focusedPane, setLeftPaneScrollHeading, setRightPaneScrollHeading]);
  const onScrollTargetHandled = useCallback((pane: PaneId) => {
    if (pane === "left") {
      setLeftPaneScrollHeading(undefined);
      return;
    }

    setRightPaneScrollHeading(undefined);
  }, [setLeftPaneScrollHeading, setRightPaneScrollHeading]);
  const openAIChatSidebar = useCallback(() => {
    openSecondarySidebar("ai-chat");
  }, [openSecondarySidebar]);

  return {
    onEditorAction: pulseEditorAction,
    onFileOpenMotion: pulseEditorAction,
    onOutlineHeadingClick,
    onScrollTargetHandled,
    openAIChatSidebar
  };
}
