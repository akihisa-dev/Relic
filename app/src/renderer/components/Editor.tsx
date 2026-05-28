import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import type { MutableRefObject, ReactElement } from "react";

import { chronicleCalendarIds, type EditorSettings, type UserDefinedField } from "../../shared/ipc";
import { buildExtensions, destroyEditorView } from "../editorExtensions";
import {
  appendOrCreateFrontmatterField,
  canAppendOrCreateFrontmatterField,
  findFrontmatterBlock,
  fixedFrontmatterFieldNames,
  frontmatterDialogRequestEvent,
  type FrontmatterDialogRequest
} from "../editorFrontmatter";
import { useEditorContextMenu } from "../hooks/useEditorContextMenu";
import { useEditorFrontmatterDialog } from "../hooks/useEditorFrontmatterDialog";
import { useToolbarActions } from "../hooks/useToolbarActions";
import { useT, type Translator } from "../i18n";
import { outputFileNameFromPath } from "../outputHtml";
import { EditorContextMenu } from "./EditorContextMenu";
import { EditorFrontmatterDialog } from "./EditorFrontmatterDialog";

export { buildWikiLinkCompletionSource } from "../editorExtensions";
export { buildLivePreviewDecorations, findClickableLinkAtPosition } from "../editorLivePreview";
export { buildTableDecorations } from "../editorTables";
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
  typewriterMode?: boolean;
  userDefinedFields?: UserDefinedField[];
  viewRef?: MutableRefObject<EditorView | null>;
}

const defaultAllFilePaths: string[] = [];
const defaultFrontmatterCandidates: Record<string, string[]> = {};
const defaultUserDefinedFields: UserDefinedField[] = [];
const basicFixedFieldNames = ["aliases", "tags", "status"] as const;
const dateFixedFieldNames = ["plannedDate", "actualDate"] as const;

interface FrontmatterPropertyMenuGroup {
  id: string;
  label: string;
  options: FrontmatterPropertyMenuOption[];
}

interface FrontmatterPropertyMenuOption {
  key: string;
  label: string;
}

interface FrontmatterPropertyMenuState {
  groups: FrontmatterPropertyMenuGroup[];
  unavailable: boolean;
}

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
  typewriterMode = false,
  userDefinedFields = defaultUserDefinedFields,
  viewRef
}: EditorProps): ReactElement {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const frontmatterButtonRef = useRef<HTMLButtonElement>(null);
  const frontmatterMenuRef = useRef<HTMLDivElement>(null);
  const internalViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onOpenLinkRef = useRef(onOpenLink);
  const onOpenWikiLinkRef = useRef(onOpenWikiLink);
  const allFilePathsRef = useRef(allFilePaths);
  const frontmatterCandidatesRef = useRef(frontmatterCandidates);
  const userDefinedFieldsRef = useRef(userDefinedFields);
  const [frontmatterPropertyMenu, setFrontmatterPropertyMenu] = useState<FrontmatterPropertyMenuState | null>(null);
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

  const toggleFrontmatterPropertyMenu = (): void => {
    const view = internalViewRef.current;
    if (!view) return;

    if (frontmatterPropertyMenu) {
      setFrontmatterPropertyMenu(null);
      return;
    }

    setFrontmatterPropertyMenu(buildFrontmatterPropertyMenuState(view, t));
  };

  const addFrontmatterProperty = (key: string): void => {
    const view = internalViewRef.current;
    if (!view) return;

    appendOrCreateFrontmatterField(view, key);
    setFrontmatterPropertyMenu(null);
  };

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
    if (!frontmatterPropertyMenu) return;

    const closeOnPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (frontmatterButtonRef.current?.contains(target)) return;
      if (frontmatterMenuRef.current?.contains(target)) return;
      setFrontmatterPropertyMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setFrontmatterPropertyMenu(null);
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [frontmatterPropertyMenu]);

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
      allFilePathsRef.current,
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
      <div className="cm-editor-shell" data-output-file-name={outputFileNameFromPath(filePath) ?? undefined}>
        <div className="cm-editor-container" onContextMenuCapture={openReactContextMenu} ref={containerRef} />
        <button
          aria-expanded={frontmatterPropertyMenu ? "true" : "false"}
          aria-haspopup="menu"
          aria-label={t("frontmatter.addProperty")}
          className="editor-frontmatter-add-button"
          onClick={toggleFrontmatterPropertyMenu}
          ref={frontmatterButtonRef}
          title={t("frontmatter.addProperty")}
          type="button"
        >
          +
        </button>
        {frontmatterPropertyMenu ? (
          <div className="editor-frontmatter-add-menu" ref={frontmatterMenuRef} role="menu">
            <div className="editor-frontmatter-add-menu-title">{t("frontmatter.addProperty")}</div>
            {frontmatterPropertyMenu.unavailable ? (
              <div className="editor-frontmatter-add-menu-empty">{t("frontmatter.fixYamlBeforeAdding")}</div>
            ) : frontmatterPropertyMenu.groups.length === 0 ? (
              <div className="editor-frontmatter-add-menu-empty">{t("frontmatter.noAvailableProperties")}</div>
            ) : (
              frontmatterPropertyMenu.groups.map((group) => (
                <div className="editor-frontmatter-add-menu-group" key={group.id}>
                  <div className="editor-frontmatter-add-menu-group-label">{group.label}</div>
                  {group.options.map((option) => (
                    <button
                      className="editor-frontmatter-add-menu-item"
                      key={option.key}
                      onClick={() => addFrontmatterProperty(option.key)}
                      role="menuitem"
                      type="button"
                    >
                      <span>{option.label}</span>
                      <code>{option.key}</code>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : null}
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

function buildFrontmatterPropertyMenuState(view: EditorView, t: Translator): FrontmatterPropertyMenuState {
  if (!canAppendOrCreateFrontmatterField(view)) {
    return { groups: [], unavailable: true };
  }

  const usedKeys = new Set(Object.keys(findFrontmatterBlock(view.state)?.data ?? {}));
  const availableKeys = new Set(fixedFrontmatterFieldNames.filter((key) => !usedKeys.has(key)));
  const groups = [
    frontmatterPropertyGroup(
      "date",
      t("frontmatter.propertyGroupDate"),
      dateFixedFieldNames.filter((key) => availableKeys.has(key)),
      t
    ),
    frontmatterPropertyGroup(
      "basic",
      t("frontmatter.propertyGroupBasic"),
      basicFixedFieldNames.filter((key) => availableKeys.has(key)),
      t
    ),
    frontmatterPropertyGroup(
      "chronicle",
      t("frontmatter.propertyGroupChronicle"),
      chronicleCalendarIds.filter((key) => availableKeys.has(key)),
      t
    )
  ].filter((group) => group.options.length > 0);

  return { groups, unavailable: false };
}

function frontmatterPropertyGroup(
  id: string,
  label: string,
  keys: readonly string[],
  t: Translator
): FrontmatterPropertyMenuGroup {
  return {
    id,
    label,
    options: keys.map((key) => ({ key, label: frontmatterPropertyLabel(key, t) }))
  };
}

function frontmatterPropertyLabel(key: string, t: Translator): string {
  if (key === "aliases") return t("frontmatter.propertyAliases");
  if (key === "tags") return t("frontmatter.propertyTags");
  if (key === "status") return t("frontmatter.propertyStatus");
  if (key === "plannedDate") return t("frontmatter.propertyPlannedDate");
  if (key === "actualDate") return t("frontmatter.propertyActualDate");
  return key;
}
