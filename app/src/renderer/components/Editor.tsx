import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, MutableRefObject, ReactElement } from "react";
import { createPortal } from "react-dom";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import { fixedStatusValues } from "../../shared/status";
import { buildExtensions, destroyEditorView } from "../editorExtensions";
import { appendFrontmatterArrayValue, appendFrontmatterField, findFrontmatterBlock, frontmatterDialogRequestEvent, frontmatterFieldNamePattern, type FrontmatterDialogRequest } from "../editorFrontmatter";
import { useT } from "../i18n";

export { buildWikiLinkCompletionSource } from "../editorExtensions";
export { buildLivePreviewDecorations, findClickableLinkAtPosition } from "../editorLivePreview";
export { buildTableDecorations } from "../editorTables";
interface EditorProps {
  allFilePaths?: string[];
  content: string;
  frontmatterCandidates?: Record<string, string[]>;
  onChange: (content: string) => void;
  onOpenLink?: (href: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  settings: EditorSettings;
  sourceMode?: boolean;
  typewriterMode?: boolean;
  userDefinedFields?: UserDefinedField[];
  viewRef?: MutableRefObject<EditorView | null>;
}

function editorContextMenuPosition(x: number, y: number): { x: number; y: number } {
  const margin = 8;
  const estimatedWidth = 220;
  const estimatedHeight = 180;
  const maxX = Math.max(margin, window.innerWidth - estimatedWidth - margin);
  const maxY = Math.max(margin, window.innerHeight - estimatedHeight - margin);

  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY)
  };
}

function readClipboardText(): string {
  if (window.relic?.readClipboardText) {
    return window.relic.readClipboardText();
  }

  return "";
}

async function writeClipboardText(text: string): Promise<void> {
  if (window.relic?.writeClipboardText) {
    window.relic.writeClipboardText(text);
    return;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the textarea fallback.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.left = "-9999px";
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function usesElectronNativeEditorMenu(): boolean {
  return Boolean(window.relic?.readClipboardText && window.relic.writeClipboardText);
}

export function Editor({
  allFilePaths = [],
  content,
  frontmatterCandidates = {},
  onChange,
  onOpenLink,
  onOpenWikiLink,
  settings,
  sourceMode = false,
  typewriterMode = false,
  userDefinedFields = [],
  viewRef
}: EditorProps): ReactElement {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const internalViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onOpenLinkRef = useRef(onOpenLink);
  const onOpenWikiLinkRef = useRef(onOpenWikiLink);
  const allFilePathsRef = useRef(allFilePaths);
  const frontmatterCandidatesRef = useRef(frontmatterCandidates);
  const userDefinedFieldsRef = useRef(userDefinedFields);
  const lastSelectionRef = useRef<{ from: number; text: string; to: number } | null>(null);
  const [frontmatterDialog, setFrontmatterDialog] = useState<FrontmatterDialogRequest | null>(null);
  const [frontmatterDialogValue, setFrontmatterDialogValue] = useState("");
  const [frontmatterDialogError, setFrontmatterDialogError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    selectionFrom: number;
    selectionText: string;
    selectionTo: number;
    x: number;
    y: number;
  } | null>(null);

  onChangeRef.current = onChange;
  onOpenLinkRef.current = onOpenLink;
  onOpenWikiLinkRef.current = onOpenWikiLink;
  allFilePathsRef.current = allFilePaths;
  frontmatterCandidatesRef.current = frontmatterCandidates;
  userDefinedFieldsRef.current = userDefinedFields;

  const openContextMenu = (event: MouseEvent, view: EditorView): boolean => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest(".cm-live-table")) return false;
    if (usesElectronNativeEditorMenu()) return false;

    event.preventDefault();
    const position = editorContextMenuPosition(event.clientX, event.clientY);
    const selection = view.state.selection.main;
    let clickedPosition: number | null = null;
    try {
      clickedPosition = view.posAtCoords({ x: event.clientX, y: event.clientY });
    } catch {
      clickedPosition = null;
    }
    let selectionFrom = selection.empty ? clickedPosition ?? selection.from : selection.from;
    let selectionTo = selection.empty ? selectionFrom : selection.to;
    let selectionText = "";

    if (selection.empty) {
      const lastSelection = lastSelectionRef.current;
      if (
        lastSelection &&
        clickedPosition !== null &&
        clickedPosition >= lastSelection.from &&
        clickedPosition <= lastSelection.to
      ) {
        selectionFrom = lastSelection.from;
        selectionTo = lastSelection.to;
        selectionText = lastSelection.text;
      }
    } else {
      selectionText = view.state.sliceDoc(selection.from, selection.to);
      lastSelectionRef.current = {
        from: selection.from,
        text: selectionText,
        to: selection.to
      };
    }

    setContextMenu({
      selectionFrom,
      selectionText,
      selectionTo,
      ...position
    });
    return true;
  };

  const openReactContextMenu = (event: ReactMouseEvent<HTMLDivElement>): void => {
    const view = internalViewRef.current;
    if (!view) return;
    if (openContextMenu(event.nativeEvent, view)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const closeContextMenu = (): void => setContextMenu(null);
  const closeFrontmatterDialog = (): void => {
    setFrontmatterDialog(null);
    setFrontmatterDialogValue("");
    setFrontmatterDialogError(null);
  };

  const submitFrontmatterDialog = (): void => {
    const view = internalViewRef.current;
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
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFrontmatterDialogRequest = (event: Event): void => {
      const detail = (event as CustomEvent<FrontmatterDialogRequest>).detail;
      if (!detail) return;
      setFrontmatterDialog(detail);
      setFrontmatterDialogValue("");
      setFrontmatterDialogError(null);
    };
    const handleContextMenu = (event: MouseEvent): void => {
      const view = internalViewRef.current;
      if (!view) return;
      if (openContextMenu(event, view)) event.stopPropagation();
    };
    const handleRightButtonDown = (event: MouseEvent): void => {
      if (event.button !== 2) return;
      const view = internalViewRef.current;
      if (!view) return;
      if (openContextMenu(event, view)) event.stopPropagation();
    };

    container.addEventListener(frontmatterDialogRequestEvent, handleFrontmatterDialogRequest);
    container.addEventListener("pointerdown", handleRightButtonDown, true);
    container.addEventListener("mousedown", handleRightButtonDown, true);
    container.addEventListener("mouseup", handleRightButtonDown, true);
    container.addEventListener("auxclick", handleRightButtonDown, true);
    container.addEventListener("contextmenu", handleContextMenu, true);

    return () => {
      container.removeEventListener(frontmatterDialogRequestEvent, handleFrontmatterDialogRequest);
      container.removeEventListener("pointerdown", handleRightButtonDown, true);
      container.removeEventListener("mousedown", handleRightButtonDown, true);
      container.removeEventListener("mouseup", handleRightButtonDown, true);
      container.removeEventListener("auxclick", handleRightButtonDown, true);
      container.removeEventListener("contextmenu", handleContextMenu, true);
    };
  });

  const copySelection = (): void => {
    const view = internalViewRef.current;
    const selection = view?.state.selection.main;
    const selectionText = view && selection && !selection.empty
      ? view.state.sliceDoc(selection.from, selection.to)
      : contextMenu?.selectionText ?? "";
    if (!selectionText) return;
    void writeClipboardText(selectionText);
  };

  const cutSelection = (): void => {
    const view = internalViewRef.current;
    if (!view) return;
    const selection = view.state.selection.main;
    const selectionText = !selection.empty
      ? view.state.sliceDoc(selection.from, selection.to)
      : contextMenu?.selectionText ?? "";
    if (!selectionText) return;
    const from = !selection.empty ? selection.from : contextMenu?.selectionFrom ?? selection.from;
    const to = !selection.empty ? selection.to : contextMenu?.selectionTo ?? selection.to;

    void writeClipboardText(selectionText);
    view.dispatch({
      changes: { from, insert: "", to },
      selection: { anchor: from }
    });
    view.focus();
  };

  const pasteClipboard = async (): Promise<void> => {
    const view = internalViewRef.current;
    if (!view) return;
    const from = contextMenu?.selectionFrom ?? view.state.selection.main.from;
    const to = contextMenu?.selectionTo ?? view.state.selection.main.to;
    let text = "";

    if (window.relic?.readClipboardText) {
      text = readClipboardText();
    } else if (navigator.clipboard?.readText) {
      try {
        text = await navigator.clipboard.readText();
      } catch {
        text = "";
      }
    }

    if (text === "") {
      view.dispatch({ selection: { anchor: from, head: to } });
      view.focus();
      document.execCommand("paste");
      return;
    }

    view.dispatch({
      changes: { from, insert: text, to },
      selection: { anchor: from + text.length }
    });
    view.focus();
  };

  const selectAll = (): void => {
    const view = internalViewRef.current;
    if (!view) return;
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    view.focus();
  };
  const frontmatterDialogCandidates = frontmatterDialog?.type === "array-value" && frontmatterDialog.key !== "aliases"
    ? frontmatterDialogCandidatesFor(frontmatterDialog.key, frontmatterCandidates)
    : [];

  useEffect(() => {
    if (!contextMenu) return;
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest(".editor-context-menu")) return;
      closeContextMenu();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeContextMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = buildExtensions(
      settings,
      typewriterMode,
      sourceMode,
      onChangeRef,
      allFilePathsRef.current,
      userDefinedFieldsRef.current,
      frontmatterCandidatesRef.current,
      openContextMenu,
      onOpenLinkRef,
      onOpenWikiLinkRef
    );
    const state = EditorState.create({ doc: content, extensions });
    const view = new EditorView({ state, parent: containerRef.current });

    internalViewRef.current = view;

    if (viewRef) viewRef.current = view;

    return () => {
      destroyEditorView(view, containerRef.current);
      internalViewRef.current = null;
      if (viewRef) viewRef.current = null;
    };
    // content は初期値のみ使用。以降は onChange で管理する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = internalViewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (currentContent === content) return;

    view.dispatch({
      changes: {
        from: 0,
        insert: content,
        to: view.state.doc.length
      }
    });
  }, [content]);

  // 設定・タイプライターモード変更時にエディタを再生成
  useEffect(() => {
    const view = internalViewRef.current;

    if (!view) return;

    const currentContent = view.state.doc.toString();
    const container = containerRef.current;

    destroyEditorView(view, container);
    internalViewRef.current = null;

    if (!container) return;

    const extensions = buildExtensions(
      settings,
      typewriterMode,
      sourceMode,
      onChangeRef,
      allFilePathsRef.current,
      userDefinedFieldsRef.current,
      frontmatterCandidatesRef.current,
      openContextMenu,
      onOpenLinkRef,
      onOpenWikiLinkRef
    );
    const state = EditorState.create({ doc: currentContent, extensions });
    const nextView = new EditorView({ state, parent: container });

    internalViewRef.current = nextView;

    if (viewRef) viewRef.current = nextView;
  }, [frontmatterCandidates, settings, sourceMode, typewriterMode, userDefinedFields, viewRef]);

  return (
    <>
      <div className="cm-editor-container" onContextMenuCapture={openReactContextMenu} ref={containerRef} />
      {frontmatterDialog ? (
        <div className="frontmatter-add-dialog" role="dialog" aria-modal="true">
          <div className="frontmatter-add-dialog-title">
            {frontmatterDialog.type === "property" ? "プロパティを追加" : `${frontmatterDialog.key} に値を追加`}
          </div>
          <input
            autoFocus
            className="frontmatter-add-dialog-input"
            list={frontmatterDialogCandidates.length > 0 ? "frontmatter-add-dialog-candidates" : undefined}
            onChange={(event) => {
              setFrontmatterDialogValue(event.target.value);
              setFrontmatterDialogError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
              if (event.key === "Escape") closeFrontmatterDialog();
            }}
            placeholder={frontmatterDialog.type === "property" ? "プロパティ名" : "値"}
            type="text"
            value={frontmatterDialogValue}
          />
          {frontmatterDialogCandidates.length > 0 ? (
            <datalist id="frontmatter-add-dialog-candidates">
              {frontmatterDialogCandidates.map((candidate) => (
                <option key={candidate} value={candidate} />
              ))}
            </datalist>
          ) : null}
          {frontmatterDialogError ? <div className="frontmatter-add-dialog-error">{frontmatterDialogError}</div> : null}
          <div className="frontmatter-add-dialog-actions">
            <button onClick={closeFrontmatterDialog} type="button">キャンセル</button>
            <button onClick={submitFrontmatterDialog} type="button">追加</button>
          </div>
        </div>
      ) : null}
      {contextMenu ? createPortal(
        <div
          className="tab-context-menu editor-context-menu"
          role="menu"
          style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 1000 }}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => {
              copySelection();
              closeContextMenu();
            }}
            role="menuitem"
            type="button"
          >
            {t("editor.copy")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => {
              cutSelection();
              closeContextMenu();
            }}
            role="menuitem"
            type="button"
          >
            {t("editor.cut")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => {
              void pasteClipboard();
              closeContextMenu();
            }}
            role="menuitem"
            type="button"
          >
            {t("editor.paste")}
          </button>
          <div className="tab-context-menu-separator" />
          <button
            className="tab-context-menu-item"
            onClick={() => {
              selectAll();
              closeContextMenu();
            }}
            role="menuitem"
            type="button"
          >
            {t("editor.selectAll")}
          </button>
        </div>,
        document.body
      ) : null}
    </>
  );
}

function frontmatterDialogCandidatesFor(key: string, candidates: Record<string, string[]>): string[] {
  if (key === "status") return [...fixedStatusValues];
  return candidates[key] ?? [];
}
