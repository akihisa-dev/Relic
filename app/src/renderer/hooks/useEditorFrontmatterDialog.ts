import { EditorView } from "@codemirror/view";
import { useCallback, useState } from "react";
import type { MutableRefObject } from "react";

import { frontmatterDialogCandidatesFor } from "../editorContextMenuModel";
import {
  appendFrontmatterArrayValue,
  appendFrontmatterField,
  findFrontmatterBlock,
  frontmatterFieldNamePattern,
  type FrontmatterDialogRequest
} from "../editorFrontmatter";

interface UseEditorFrontmatterDialogInput {
  frontmatterCandidates: Record<string, string[]>;
  viewRef: MutableRefObject<EditorView | null>;
}

export function useEditorFrontmatterDialog({
  frontmatterCandidates,
  viewRef
}: UseEditorFrontmatterDialogInput) {
  const [frontmatterDialog, setFrontmatterDialog] = useState<FrontmatterDialogRequest | null>(null);
  const [frontmatterDialogValue, setFrontmatterDialogValue] = useState("");
  const [frontmatterDialogError, setFrontmatterDialogError] = useState<string | null>(null);

  const closeFrontmatterDialog = useCallback((): void => {
    setFrontmatterDialog(null);
    setFrontmatterDialogValue("");
    setFrontmatterDialogError(null);
  }, []);

  const openFrontmatterDialog = useCallback((detail: FrontmatterDialogRequest): void => {
    setFrontmatterDialog(detail);
    setFrontmatterDialogValue("");
    setFrontmatterDialogError(null);
  }, []);

  const updateFrontmatterDialogValue = useCallback((value: string): void => {
    setFrontmatterDialogValue(value);
    setFrontmatterDialogError(null);
  }, []);

  const submitFrontmatterDialog = useCallback((): void => {
    const view = viewRef.current;
    const value = frontmatterDialogValue.trim();
    if (!view || !frontmatterDialog) return;

    if (!value) {
      setFrontmatterDialogError("入力してください");
      return;
    }

    if (frontmatterDialog.type === "property") {
      const block = findFrontmatterBlock(view.state);
      if (!frontmatterFieldNamePattern.test(value)) {
        setFrontmatterDialogError("プロパティ名に使えない文字があります");
        return;
      }
      if (block && Object.prototype.hasOwnProperty.call(block.data, value)) {
        setFrontmatterDialogError("同じプロパティが既にあります");
        return;
      }
      appendFrontmatterField(view, value);
    } else {
      appendFrontmatterArrayValue(view, frontmatterDialog.key, value);
    }

    closeFrontmatterDialog();
  }, [closeFrontmatterDialog, frontmatterDialog, frontmatterDialogValue, viewRef]);

  const frontmatterDialogCandidates = frontmatterDialog?.type === "array-value" && frontmatterDialog.key !== "aliases"
    ? frontmatterDialogCandidatesFor(frontmatterDialog.key, frontmatterCandidates)
    : [];

  return {
    closeFrontmatterDialog,
    frontmatterDialog,
    frontmatterDialogCandidates,
    frontmatterDialogError,
    frontmatterDialogValue,
    openFrontmatterDialog,
    submitFrontmatterDialog,
    updateFrontmatterDialogValue
  };
}
