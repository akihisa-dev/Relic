import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";
import type { MutableRefObject, ReactElement } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import { buildExtensions, destroyEditorView } from "../editorExtensions";
import { frontmatterDialogRequestEvent, type FrontmatterDialogRequest } from "../editorFrontmatter";
import { useEditorContextMenu } from "../hooks/useEditorContextMenu";
import { useEditorFrontmatterDialog } from "../hooks/useEditorFrontmatterDialog";
import { useToolbarActions } from "../hooks/useToolbarActions";
import { useT } from "../i18n";
import { EditorContextMenu } from "./EditorContextMenu";
import { EditorFrontmatterDialog } from "./EditorFrontmatterDialog";

export { buildWikiLinkCompletionSource } from "../editorExtensions";
export { buildLivePreviewDecorations, findClickableLinkAtPosition } from "../editorLivePreview";
export { buildTableDecorations } from "../editorTables";
interface EditorProps {
  allCardPaths?: string[];
  content: string;
  frontmatterCandidates?: Record<string, string[]>;
  onChange: (content: string) => void;
  onEditorAction?: () => void;
  onOpenLink?: (href: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  settings: EditorSettings;
  sourceMode?: boolean;
  typewriterMode?: boolean;
  userDefinedFields?: UserDefinedField[];
  viewRef?: MutableRefObject<EditorView | null>;
}

const defaultAllCardPaths: string[] = [];
const defaultFrontmatterCandidates: Record<string, string[]> = {};
const defaultUserDefinedFields: UserDefinedField[] = [];

export function Editor({
  allCardPaths = defaultAllCardPaths,
  content,
  frontmatterCandidates = defaultFrontmatterCandidates,
  onChange,
  onEditorAction,
  onOpenLink,
  onOpenWikiLink,
  settings,
  sourceMode = false,
  typewriterMode = false,
  userDefinedFields = defaultUserDefinedFields,
  viewRef
}: EditorProps): ReactElement {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const internalViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onOpenLinkRef = useRef(onOpenLink);
  const onOpenWikiLinkRef = useRef(onOpenWikiLink);
  const allCardPathsRef = useRef(allCardPaths);
  const frontmatterCandidatesRef = useRef(frontmatterCandidates);
  const userDefinedFieldsRef = useRef(userDefinedFields);
  const {
    closeContextMenu,
    contextMenu,
    copySelection,
    cutSelection,
    openContextMenu,
    openReactContextMenu,
    pasteClipboard,
    prepareContextSelection,
    rememberSelection,
    selectAll
  } = useEditorContextMenu({ viewRef: internalViewRef });
  const markdownActions = useToolbarActions({
    onEditorAction,
    placeholderLinkText: t("toolbar.placeholderLinkText"),
    placeholderText: t("toolbar.placeholderText"),
    tableColumnLabel: (index) => t("toolbar.tableColumn", { index }),
    viewRef: internalViewRef
  });
  const {
    closeFrontmatterDialog,
    frontmatterDialog,
    frontmatterDialogCandidates,
    frontmatterDialogError,
    frontmatterDialogValue,
    openFrontmatterDialog,
    submitFrontmatterDialog,
    updateFrontmatterDialogValue
  } = useEditorFrontmatterDialog({
    frontmatterCandidates,
    t,
    viewRef: internalViewRef
  });

  onChangeRef.current = onChange;
  onOpenLinkRef.current = onOpenLink;
  onOpenWikiLinkRef.current = onOpenWikiLink;
  allCardPathsRef.current = allCardPaths;
  frontmatterCandidatesRef.current = frontmatterCandidates;
  userDefinedFieldsRef.current = userDefinedFields;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFrontmatterDialogRequest = (event: Event): void => {
      const detail = (event as CustomEvent<FrontmatterDialogRequest>).detail;
      if (!detail) return;
      openFrontmatterDialog(detail);
    };
    const handleContextMenu = (event: MouseEvent): void => {
      const view = internalViewRef.current;
      if (!view) return;
      if (openContextMenu(event, view)) {
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };
    const handleRightButtonDown = (event: MouseEvent): void => {
      if (event.button !== 2) return;
      const view = internalViewRef.current;
      if (!view) return;
      if (openContextMenu(event, view)) {
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
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
  }, [openContextMenu, openFrontmatterDialog]);

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = buildExtensions(
      settings,
      typewriterMode,
      sourceMode,
      onChangeRef,
      allCardPathsRef.current,
      userDefinedFieldsRef.current,
      frontmatterCandidatesRef.current,
      t,
      openContextMenu,
      rememberSelection,
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
      allCardPathsRef.current,
      userDefinedFieldsRef.current,
      frontmatterCandidatesRef.current,
      t,
      openContextMenu,
      rememberSelection,
      onOpenLinkRef,
      onOpenWikiLinkRef
    );
    const state = EditorState.create({ doc: currentContent, extensions });
    const nextView = new EditorView({ state, parent: container });

    internalViewRef.current = nextView;

    if (viewRef) viewRef.current = nextView;
  }, [frontmatterCandidates, rememberSelection, settings, sourceMode, t, typewriterMode, userDefinedFields, viewRef]);

  return (
    <>
      <div className="cm-editor-container" onContextMenuCapture={openReactContextMenu} ref={containerRef} />
      <EditorFrontmatterDialog
        candidates={frontmatterDialogCandidates}
        dialog={frontmatterDialog}
        error={frontmatterDialogError}
        onCancel={closeFrontmatterDialog}
        onSubmit={submitFrontmatterDialog}
        onValueChange={updateFrontmatterDialogValue}
        t={t}
        value={frontmatterDialogValue}
      />
      <EditorContextMenu
        contextMenu={contextMenu}
        markdownActions={markdownActions}
        onAfterMarkdownAction={onEditorAction}
        onBeforeMarkdownAction={prepareContextSelection}
        onClose={closeContextMenu}
        onCopy={copySelection}
        onCut={cutSelection}
        onPaste={pasteClipboard}
        onSelectAll={selectAll}
      />
    </>
  );
}
