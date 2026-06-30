import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";
import type { MutableRefObject, ReactElement } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import { buildEditorReconfigureEffects, buildExtensions, destroyEditorView } from "../editorExtensions";
import { setEditorEditable } from "../editorEditable";
import { droppedImageSourcePaths, importDroppedImagesAsMarkdown } from "../editorImageDrop";
import {
  frontmatterDialogRequestEvent,
  type FrontmatterDialogRequest
} from "../editorFrontmatter";
import { useEditorContextMenu } from "../hooks/useEditorContextMenu";
import { useEditorFrontmatterDialog } from "../hooks/useEditorFrontmatterDialog";
import { useToolbarActions } from "../hooks/useToolbarActions";
import { useT } from "../i18n";
import { outputFileNameFromPath } from "../outputHtml";
import { EditorContextMenu } from "./EditorContextMenu";
import { EditorFrontmatterDialog } from "./EditorFrontmatterDialog";
import { EditorFrontmatterPropertyMenu } from "./EditorFrontmatterPropertyMenu";

interface EditorProps {
  allFilePaths?: string[];
  content: string;
  filePath?: string;
  frontmatterCandidates?: Record<string, string[]>;
  onChange: (content: string) => void;
  onEditorAction?: () => void;
  onOpenLink?: (href: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  settings: EditorSettings;
  sourceMode?: boolean;
  frontmatterAddButtonHost?: HTMLElement | null;
  typewriterMode?: boolean;
  userDefinedFields?: UserDefinedField[];
  viewRef?: MutableRefObject<EditorView | null>;
  workspacePath?: string | null;
}

const defaultAllFilePaths: string[] = [];
const defaultFrontmatterCandidates: Record<string, string[]> = {};
const defaultUserDefinedFields: UserDefinedField[] = [];

export function Editor({
  allFilePaths = defaultAllFilePaths,
  content,
  filePath,
  frontmatterCandidates = defaultFrontmatterCandidates,
  onChange,
  onEditorAction,
  onOpenLink,
  onOpenWikiLink,
  settings,
  sourceMode = false,
  frontmatterAddButtonHost = null,
  typewriterMode = false,
  userDefinedFields = defaultUserDefinedFields,
  viewRef,
  workspacePath
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
  allFilePathsRef.current = allFilePaths;
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
    const restoreEditableForEditorClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".cm-frontmatter-properties")) return;

      const view = internalViewRef.current;
      if (!view || view.state.facet(EditorView.editable)) return;

      setEditorEditable(view, true);
    };
    const handleDragOver = (event: DragEvent): void => {
      if (!filePath || !window.relic) return;
      const sourcePaths = droppedImageSourcePaths(event, window.relic.getDroppedFilePath);
      if (sourcePaths.length === 0) return;

      event.preventDefault();
      event.dataTransfer!.dropEffect = "copy";
    };
    const handleDrop = (event: DragEvent): void => {
      const view = internalViewRef.current;
      if (!view || !filePath || !window.relic) return;

      const sourcePaths = droppedImageSourcePaths(event, window.relic.getDroppedFilePath);
      if (sourcePaths.length === 0) return;

      event.preventDefault();
      event.stopPropagation();
      void importDroppedImagesAsMarkdown(view, event, filePath, sourcePaths);
    };

    container.addEventListener(frontmatterDialogRequestEvent, handleFrontmatterDialogRequest);
    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("drop", handleDrop);
    container.addEventListener("pointerdown", restoreEditableForEditorClick, true);
    container.addEventListener("mousedown", restoreEditableForEditorClick, true);
    container.addEventListener("pointerdown", handleRightButtonDown, true);
    container.addEventListener("mousedown", handleRightButtonDown, true);
    container.addEventListener("mouseup", handleRightButtonDown, true);
    container.addEventListener("auxclick", handleRightButtonDown, true);
    container.addEventListener("contextmenu", handleContextMenu, true);

    return () => {
      container.removeEventListener(frontmatterDialogRequestEvent, handleFrontmatterDialogRequest);
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("drop", handleDrop);
      container.removeEventListener("pointerdown", restoreEditableForEditorClick, true);
      container.removeEventListener("mousedown", restoreEditableForEditorClick, true);
      container.removeEventListener("pointerdown", handleRightButtonDown, true);
      container.removeEventListener("mousedown", handleRightButtonDown, true);
      container.removeEventListener("mouseup", handleRightButtonDown, true);
      container.removeEventListener("auxclick", handleRightButtonDown, true);
      container.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [filePath, openContextMenu, openFrontmatterDialog]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const extensions = buildExtensions(
      settings,
      typewriterMode,
      sourceMode,
      onChangeRef,
      allFilePathsRef.current,
      userDefinedFieldsRef.current,
      frontmatterCandidatesRef.current,
      t,
      openContextMenu,
      rememberSelection,
      onOpenLinkRef,
      onOpenWikiLinkRef,
      workspacePath
    );
    const state = EditorState.create({ doc: content, extensions });
    const view = new EditorView({ state, parent: container });

    internalViewRef.current = view;

    if (viewRef) viewRef.current = view;

    return () => {
      destroyEditorView(view, container);
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

  // 設定・タイプライターモード変更時はEditorViewを保ったまま拡張だけ差し替える
  useEffect(() => {
    const view = internalViewRef.current;

    if (!view) return;

    const currentScrollLeft = view.scrollDOM.scrollLeft;
    const currentScrollTop = view.scrollDOM.scrollTop;
    const hadFocus = view.hasFocus;

    view.dispatch({
      effects: buildEditorReconfigureEffects({
        allFilePaths: allFilePathsRef.current,
        frontmatterCandidates: frontmatterCandidatesRef.current,
        onChangeRef,
        onContextMenu: openContextMenu,
        onOpenLinkRef,
        onOpenWikiLinkRef,
        onSelectionChange: rememberSelection,
        settings,
        sourceMode,
        t,
        typewriterMode,
        userDefinedFields: userDefinedFieldsRef.current,
        workspacePath
      })
    });
    view.scrollDOM.scrollLeft = currentScrollLeft;
    view.scrollDOM.scrollTop = currentScrollTop;
    if (hadFocus) view.focus();
    if (viewRef) viewRef.current = view;
  }, [allFilePaths, frontmatterCandidates, rememberSelection, settings, sourceMode, t, typewriterMode, userDefinedFields, viewRef, openContextMenu, workspacePath]);

  return (
    <>
      <div className="cm-editor-shell" data-output-file-name={outputFileNameFromPath(filePath) ?? undefined}>
        <div className="cm-editor-container" onContextMenuCapture={openReactContextMenu} ref={containerRef} />
        <EditorFrontmatterPropertyMenu host={frontmatterAddButtonHost} t={t} viewRef={internalViewRef} />
      </div>
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
