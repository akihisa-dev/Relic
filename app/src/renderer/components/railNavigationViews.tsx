import type { ReactElement } from "react";

import type { TranslationKey } from "../i18nModel";
import type { PanelTabKind } from "../store/editorStore";
import type { SidebarView } from "../store/uiStore";
import {
  IconCalendar,
  IconBridge,
  IconChronicle,
  IconChronicleSettings,
  IconFiles,
  IconFrontmatter,
  IconSettings,
  IconSparkles,
  IconTools
} from "./RailNavigationIcons";

type RailViewId = SidebarView | PanelTabKind;

export const sidebarViewDefs: Array<{ id: RailViewId; labelKey: TranslationKey; icon: ReactElement }> = [
  { id: "files", labelKey: "nav.files", icon: <IconFiles /> },
  { id: "ai", labelKey: "nav.ai", icon: <IconSparkles /> },
  { id: "hakobiBridge", labelKey: "nav.hakobiBridge", icon: <IconBridge /> },
  { id: "tools", labelKey: "nav.tools", icon: <IconTools /> },
  { id: "frontmatter", labelKey: "nav.frontmatter", icon: <IconFrontmatter /> },
  { id: "chronicle", labelKey: "nav.chronicle", icon: <IconChronicle /> },
  { id: "calendar", labelKey: "nav.calendar", icon: <IconCalendar /> },
  { id: "chronicleSettings", labelKey: "nav.chronicleSettings", icon: <IconChronicleSettings /> },
  { id: "settings", labelKey: "nav.settings", icon: <IconSettings /> }
];
