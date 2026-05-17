import type { EditorView } from "@codemirror/view";
import type { ReactElement, RefObject } from "react";

import { useToolbarActions } from "../hooks/useToolbarActions";
import { useT } from "../i18n";
import {
  ToolbarBlockFormattingGroup,
  ToolbarInlineFormattingGroup,
  ToolbarInsertGroup,
  ToolbarListGroup
} from "./ToolbarButtonGroups";

export { insertBlockIds } from "../toolbarCommands";

interface ToolbarProps {
  fallbackViewRef?: RefObject<EditorView | null>;
  onEditorAction?: () => void;
  viewRef: RefObject<EditorView | null>;
}

export function Toolbar({ fallbackViewRef, onEditorAction, viewRef }: ToolbarProps): ReactElement {
  const t = useT();
  const toolbar = useToolbarActions({
    fallbackViewRef,
    onEditorAction,
    placeholderLinkText: t("toolbar.placeholderLinkText"),
    placeholderText: t("toolbar.placeholderText"),
    tableColumnLabel: (index) => t("toolbar.tableColumn", { index }),
    viewRef
  });

  return (
    <div className="toolbar" onMouseDownCapture={toolbar.handleToolbarMouseDownCapture}>
      <ToolbarInlineFormattingGroup
        onBold={toolbar.handleBold}
        onHighlight={toolbar.handleHighlight}
        onInlineCode={toolbar.handleInlineCode}
        onItalic={toolbar.handleItalic}
        onStrikethrough={toolbar.handleStrikethrough}
        onUnderline={toolbar.handleUnderline}
        t={t}
      />

      <div className="toolbar-separator" />

      <ToolbarBlockFormattingGroup
        closingPanel={toolbar.closingPanel}
        onBlockquote={toolbar.handleBlockquote}
        onCodeBlock={toolbar.handleCodeBlock}
        onHeading={toolbar.handleHeading}
        onHorizontalRule={toolbar.handleHorizontalRule}
        onToggleHeadingMenu={toolbar.toggleHeadingMenu}
        showHeadingMenu={toolbar.showHeadingMenu}
        t={t}
      />

      <div className="toolbar-separator" />

      <ToolbarListGroup
        onBulletList={toolbar.handleBulletList}
        onCheckbox={toolbar.handleCheckbox}
        onOrderedList={toolbar.handleOrderedList}
        t={t}
      />

      <div className="toolbar-separator" />

      <ToolbarInsertGroup
        closingPanel={toolbar.closingPanel}
        linkUrl={toolbar.linkUrl}
        onCloseLinkDialog={toolbar.closeLinkDialog}
        onInternalLink={toolbar.handleInternalLink}
        onLink={toolbar.handleLink}
        onLinkSubmit={toolbar.handleLinkSubmit}
        onSetLinkUrl={toolbar.setLinkUrl}
        onSetTableCols={toolbar.setTableCols}
        onSetTableRows={toolbar.setTableRows}
        onTableSubmit={toolbar.handleTableSubmit}
        onToggleTableDialog={toolbar.toggleTableDialog}
        showLinkDialog={toolbar.showLinkDialog}
        showTableDialog={toolbar.showTableDialog}
        t={t}
        tableCols={toolbar.tableCols}
        tableRows={toolbar.tableRows}
      />
    </div>
  );
}
