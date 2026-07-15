import type { ReactElement } from "react";

import type { TranslationKey } from "../i18nModel";
import type { PanelTabKind } from "../store/editorStore";
import type { SidebarView } from "../store/uiStore";
import {
  IconChronicle,
  IconFiles,
  IconFrontmatter,
  IconGraph,
  IconSphere,
  IconSettings,
  IconTools
} from "./RailNavigationIcons";

type RailViewId = SidebarView | PanelTabKind | "graph" | "sphere";

export const sidebarViewDefs: Array<{ id: RailViewId; labelKey: TranslationKey; icon: ReactElement }> = [
  { id: "files", labelKey: "nav.files", icon: <IconFiles /> },
  { id: "tools", labelKey: "nav.tools", icon: <IconTools /> },
  { id: "frontmatter", labelKey: "nav.frontmatter", icon: <IconFrontmatter /> },
  { id: "graph", labelKey: "nav.graph", icon: <IconGraph /> },
  { id: "sphere", labelKey: "nav.sphere", icon: <IconSphere /> },
  { id: "chronicle", labelKey: "nav.chronicle", icon: <IconChronicle /> },
  { id: "settings", labelKey: "nav.settings", icon: <IconSettings /> }
];
