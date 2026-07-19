import type { EditorView } from "@codemirror/view";
import { useRef, useState } from "react";

import type { HeadingScrollTarget } from "../editorDerivedState";

export function useAppPanePresentationState() {
  const [leftPaneScrollHeading, setLeftPaneScrollHeading] = useState<HeadingScrollTarget | undefined>();
  const [rightPaneScrollHeading, setRightPaneScrollHeading] = useState<HeadingScrollTarget | undefined>();
  const [editorActionPulse, setEditorActionPulse] = useState(0);
  const [isLeftSourceMode, setIsLeftSourceMode] = useState(false);
  const [isRightSourceMode, setIsRightSourceMode] = useState(false);
  const leftEditorViewRef = useRef<EditorView | null>(null);
  const rightEditorViewRef = useRef<EditorView | null>(null);

  return {
    editorActionPulse,
    isLeftSourceMode,
    isRightSourceMode,
    leftEditorViewRef,
    leftPaneScrollHeading,
    rightEditorViewRef,
    rightPaneScrollHeading,
    setEditorActionPulse,
    setIsLeftSourceMode,
    setIsRightSourceMode,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading
  };
}
