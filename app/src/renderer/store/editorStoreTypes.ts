export type PanelTabKind = "tools" | "frontmatter" | "settings";

export interface FileTab {
  content: string;
  externalConflict?: {
    content: string;
  };
  id: string;
  isPinned?: boolean;
  kind: "file";
  name: string;
  path: string;
  savedContent: string;
}

export interface PanelTab {
  id: string;
  isPinned?: boolean;
  kind: "panel";
  name: string;
  panel: PanelTabKind;
}

export interface ChartTab {
  chartId: string;
  id: string;
  isPinned?: boolean;
  kind: "chart";
  name: string;
}

export interface ImageTab {
  id: string;
  isPinned?: boolean;
  kind: "image";
  name: string;
  path: string;
}

export interface PdfTab {
  id: string;
  isPinned?: boolean;
  kind: "pdf";
  name: string;
  path: string;
}

export type Tab = FileTab | ChartTab | ImageTab | PdfTab | PanelTab;
export type PaneId = "left" | "right";

export interface PaneState {
  activeTabId: string | null;
  history: string[];
  tabIds: string[];
}
