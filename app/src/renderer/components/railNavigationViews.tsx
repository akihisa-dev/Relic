import type { ReactElement } from "react";

import type { TranslationKey } from "../i18nModel";
import type { PanelTabKind } from "../store/editorStore";
import type { SidebarView } from "../store/uiStore";
import {
  IconChronicle,
  IconCards,
  IconFiles,
  IconBubble,
  IconSphere,
  IconSettings,
  IconTable
} from "./RailNavigationIcons";

type RailViewId = SidebarView | PanelTabKind | "cards" | "graph" | "sphere" | "table" | "chronicle";

export const sidebarViewDefs: Array<{ id: RailViewId; labelKey: TranslationKey; icon: ReactElement }> = [
  { id: "files", labelKey: "nav.files", icon: <IconFiles /> },
  { id: "cards", labelKey: "nav.cards", icon: <IconCards /> },
  { id: "table", labelKey: "nav.table", icon: <IconTable /> },
  { id: "graph", labelKey: "nav.bubble", icon: <IconBubble /> },
  { id: "sphere", labelKey: "nav.sphere", icon: <IconSphere /> },
  { id: "chronicle", labelKey: "nav.chronicle", icon: <IconChronicle /> },
  { id: "settings", labelKey: "nav.settings", icon: <IconSettings /> }
];
