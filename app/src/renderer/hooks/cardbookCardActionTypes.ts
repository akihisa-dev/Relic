import type { MarkdownCardContent, CardbookState } from "../../shared/ipc";
import type { AliasIndex } from "../../shared/links";
import type { CardTab, PaneId, PaneState, Tab } from "../store/editorStore";

export interface CardbookCardActionsContext {
  aliasesByPath: AliasIndex;
  closeAllTabs: () => void;
  closeTab: (pane: PaneId, tabId: string) => void;
  existingMarkdownPaths: string[];
  focusedPane: PaneId;
  leftPane: PaneState;
  openCardInPane: (pane: PaneId, card: MarkdownCardContent) => void;
  rightPane: PaneState;
  setLeftPaneScrollHeading: (heading: string | undefined) => void;
  setRightPaneScrollHeading: (heading: string | undefined) => void;
  setCardbookError: (message: string | null) => void;
  setCardbookState: (state: CardbookState) => void;
  tabs: Record<string, Tab>;
  updateTabMeta: (tabId: string, meta: Pick<CardTab, "name" | "path">) => void;
  cardbookState: CardbookState | null;
}
