import type { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent, RefObject } from "react";

import {
  buildToolbarTableMarkdown,
  normalizeToolbarTableSize,
  type ToolbarPanel
} from "../toolbarModel";
import {
  findToolbarTargetView,
  insertAtLineStart,
  insertBlock,
  insertBlockIds,
  insertInternalLink,
  insertListAtSelectedLines,
  insertMarkdownLink,
  type HeadingLevel,
  wrapSelection
} from "../toolbarCommands";

export interface UseToolbarActionsInput {
  fallbackViewRef?: RefObject<EditorView | null>;
  onEditorAction?: () => void;
  placeholderLinkText: string;
  placeholderText: string;
  tableColumnLabel: (index: number) => string;
  viewRef: RefObject<EditorView | null>;
}

export interface UseToolbarActionsResult {
  closeHeadingMenu: () => void;
  closeLinkDialog: (afterClose?: () => void) => void;
  closeTableDialog: () => void;
  closingPanel: ToolbarPanel | null;
  handleBlockId: () => void;
  handleBlockquote: () => void;
  handleBold: () => void;
  handleBulletList: () => void;
  handleCheckbox: () => void;
  handleCodeBlock: () => void;
  handleHeading: (level: HeadingLevel) => void;
  handleHighlight: () => void;
  handleHorizontalRule: () => void;
  handleInlineCode: () => void;
  handleInternalLink: () => void;
  handleItalic: () => void;
  handleLink: () => void;
  handleLinkSubmit: () => void;
  handleOrderedList: () => void;
  handleStrikethrough: () => void;
  handleTableSubmit: () => void;
  handleToolbarMouseDownCapture: (event: MouseEvent<HTMLDivElement>) => void;
  handleUnderline: () => void;
  linkUrl: string;
  setLinkUrl: (value: string) => void;
  setTargetView: (view: EditorView | null) => void;
  setTableCols: (value: string) => void;
  setTableRows: (value: string) => void;
  showHeadingMenu: boolean;
  showLinkDialog: boolean;
  showTableDialog: boolean;
  tableCols: string;
  tableRows: string;
  toggleHeadingMenu: () => void;
  toggleTableDialog: () => void;
}

export function useToolbarActions({
  fallbackViewRef,
  onEditorAction,
  placeholderLinkText,
  placeholderText,
  tableColumnLabel,
  viewRef
}: UseToolbarActionsInput): UseToolbarActionsResult {
  const lastTargetViewRef = useRef<EditorView | null>(null);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [closingPanel, setClosingPanel] = useState<ToolbarPanel | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [tableRows, setTableRows] = useState("3");
  const [tableCols, setTableCols] = useState("3");
  const closePanelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getCandidateViews = (): EditorView[] => {
    const primaryView = viewRef.current;
    const fallbackView = fallbackViewRef?.current ?? null;

    return [primaryView, fallbackView].filter(
      (view, index, views): view is EditorView => view !== null && views.indexOf(view) === index
    );
  };

  const getView = (): EditorView | null => {
    return findToolbarTargetView(getCandidateViews(), lastTargetViewRef.current);
  };

  const rememberTargetView = (): void => {
    lastTargetViewRef.current = getView();
  };

  const setTargetView = (view: EditorView | null): void => {
    lastTargetViewRef.current = view;
  };

  const closePanel = (panel: ToolbarPanel, close: () => void, afterClose?: () => void): void => {
    if (closePanelTimerRef.current) clearTimeout(closePanelTimerRef.current);
    setClosingPanel(panel);
    closePanelTimerRef.current = setTimeout(() => {
      close();
      afterClose?.();
      setClosingPanel(null);
      closePanelTimerRef.current = null;
    }, 130);
  };

  const closeHeadingMenu = (): void => closePanel("heading", () => setShowHeadingMenu(false));
  const closeLinkDialog = (afterClose?: () => void): void => closePanel("link", () => setShowLinkDialog(false), afterClose);
  const closeTableDialog = (): void => closePanel("table", () => setShowTableDialog(false));

  useEffect(() => {
    return () => {
      if (closePanelTimerRef.current) clearTimeout(closePanelTimerRef.current);
    };
  }, []);

  const toggleHeadingMenu = (): void => {
    if (showHeadingMenu) {
      closeHeadingMenu();
      return;
    }

    setClosingPanel(null);
    setShowHeadingMenu(true);
  };

  const toggleTableDialog = (): void => {
    if (showTableDialog) {
      closeTableDialog();
      return;
    }

    setClosingPanel(null);
    setShowTableDialog(true);
  };

  const handleToolbarMouseDownCapture = (event: MouseEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    if (target.closest("input, select, textarea")) return;
    rememberTargetView();
    event.preventDefault();
  };

  const applyToView = (action: (view: EditorView) => void): void => {
    const view = getView();
    if (!view) return;
    action(view);
    onEditorAction?.();
  };

  const handleBold = (): void => applyToView((view) => wrapSelection(view, "**", "**", placeholderText));
  const handleItalic = (): void => applyToView((view) => wrapSelection(view, "*", "*", placeholderText));
  const handleStrikethrough = (): void => applyToView((view) => wrapSelection(view, "~~", "~~", placeholderText));
  const handleHighlight = (): void => applyToView((view) => wrapSelection(view, "==", "==", placeholderText));
  const handleUnderline = (): void => applyToView((view) => wrapSelection(view, "<u>", "</u>", placeholderText));
  const handleInlineCode = (): void => applyToView((view) => wrapSelection(view, "`", "`", placeholderText));

  const handleHeading = (level: HeadingLevel): void => {
    const view = getView();
    if (!view) return;
    insertAtLineStart(view, "#".repeat(level) + " ", placeholderText);
    onEditorAction?.();
    closeHeadingMenu();
  };

  const handleBlockquote = (): void => applyToView((view) => insertAtLineStart(view, "> ", placeholderText));
  const handleCodeBlock = (): void => applyToView((view) => insertBlock(view, "```\n\n```"));
  const handleHorizontalRule = (): void => applyToView((view) => insertBlock(view, "---"));
  const handleBulletList = (): void => applyToView((view) => insertListAtSelectedLines(view, "bullet", placeholderText));
  const handleOrderedList = (): void => applyToView((view) => insertListAtSelectedLines(view, "ordered", placeholderText));
  const handleCheckbox = (): void => applyToView((view) => insertListAtSelectedLines(view, "checkbox", placeholderText));
  const handleInternalLink = (): void => applyToView(insertInternalLink);
  const handleBlockId = (): void => applyToView(insertBlockIds);

  const handleLink = (): void => {
    const view = getView();
    if (!view) return;

    if (linkUrl) {
      insertMarkdownLink(view, linkUrl, placeholderLinkText);
      onEditorAction?.();
      closeLinkDialog(() => setLinkUrl(""));
      return;
    }

    setClosingPanel(null);
    setShowLinkDialog(true);
  };

  const handleLinkSubmit = (): void => {
    const view = getView();
    if (!view) return;

    insertMarkdownLink(view, linkUrl || "URL", placeholderLinkText);
    onEditorAction?.();
    closeLinkDialog(() => setLinkUrl(""));
  };

  const handleTableSubmit = (): void => {
    const view = getView();
    if (!view) return;
    const { cols, rows } = normalizeToolbarTableSize(tableRows, tableCols);
    const tableText = buildToolbarTableMarkdown(rows, cols, tableColumnLabel);

    insertBlock(view, tableText);
    onEditorAction?.();
    closeTableDialog();
    view.focus();
  };

  return {
    closeHeadingMenu,
    closeLinkDialog,
    closeTableDialog,
    closingPanel,
    handleBlockId,
    handleBlockquote,
    handleBold,
    handleBulletList,
    handleCheckbox,
    handleCodeBlock,
    handleHeading,
    handleHighlight,
    handleHorizontalRule,
    handleInlineCode,
    handleInternalLink,
    handleItalic,
    handleLink,
    handleLinkSubmit,
    handleOrderedList,
    handleStrikethrough,
    handleTableSubmit,
    handleToolbarMouseDownCapture,
    handleUnderline,
    linkUrl,
    setLinkUrl,
    setTargetView,
    setTableCols,
    setTableRows,
    showHeadingMenu,
    showLinkDialog,
    showTableDialog,
    tableCols,
    tableRows,
    toggleHeadingMenu,
    toggleTableDialog
  };
}
