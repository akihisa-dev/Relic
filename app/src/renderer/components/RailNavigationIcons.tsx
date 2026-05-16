import type { ReactElement } from "react";

import type { TranslationKey } from "../i18n";
import type { PanelTabKind } from "../store/editorStore";
import type { SidebarView } from "../store/uiStore";

export const IconFiles = ({ sidebarOpen = false }: { sidebarOpen?: boolean } = {}): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <path d="M3 5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" />
    {sidebarOpen ? (
      <polyline points="12.75,8.75 10.25,11 12.75,13.25" />
    ) : (
      <polyline points="10.75,8.75 13.25,11 10.75,13.25" />
    )}
  </svg>
);

const IconTools = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <path d="M15 3a3.5 3.5 0 0 0-3.2 4.9L4.1 15.5a1.5 1.5 0 0 0 2.1 2.1l7.6-7.7A3.5 3.5 0 0 0 18.5 6.5L16 9l-2-2 2.5-2.5A3.5 3.5 0 0 0 15 3z" />
  </svg>
);

const IconFrontmatter = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <rect height="14" rx="2" width="12" x="4" y="3" />
    <line x1="7" x2="13" y1="7" y2="7" />
    <line x1="7" x2="11" y1="10" y2="10" />
    <line x1="7" x2="12" y1="13" y2="13" />
  </svg>
);

const IconChronicle = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <line x1="3" x2="17" y1="10" y2="10" />
    <circle cx="6" cy="10" r="2" />
    <rect height="4" rx="1.5" width="7" x="10" y="8" />
    <line x1="6" x2="6" y1="5" y2="15" />
    <line x1="13.5" x2="13.5" y1="5" y2="15" />
  </svg>
);

const IconGraph = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <circle cx="5" cy="6" r="2" />
    <circle cx="14" cy="4" r="2" />
    <circle cx="15" cy="14" r="2" />
    <circle cx="6" cy="15" r="2" />
    <line x1="6.7" x2="12.2" y1="5.6" y2="4.4" />
    <line x1="14.3" x2="14.8" y1="6" y2="12" />
    <line x1="13.2" x2="7.8" y1="14.3" y2="14.8" />
    <line x1="6.2" x2="13.8" y1="7.5" y2="12.5" />
  </svg>
);

const IconDashboard = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <rect height="5" rx="1.4" width="5" x="3" y="3" />
    <rect height="5" rx="1.4" width="5" x="12" y="3" />
    <rect height="5" rx="1.4" width="5" x="3" y="12" />
    <path d="M12 16l1.5-3 1.7 2 1.8-4" />
  </svg>
);

const IconSettings = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <line x1="3" x2="17" y1="5" y2="5" />
    <line x1="3" x2="17" y1="10" y2="10" />
    <line x1="3" x2="17" y1="15" y2="15" />
    <circle cx="7" cy="5" fill="currentColor" r="2" stroke="none" />
    <circle cx="13" cy="10" fill="currentColor" r="2" stroke="none" />
    <circle cx="7" cy="15" fill="currentColor" r="2" stroke="none" />
  </svg>
);

type RailViewId = SidebarView | PanelTabKind;

export const sidebarViewDefs: Array<{ id: RailViewId; labelKey: TranslationKey; icon: ReactElement }> = [
  { id: "files", labelKey: "nav.files", icon: <IconFiles /> },
  { id: "dashboard", labelKey: "nav.dashboard", icon: <IconDashboard /> },
  { id: "graph", labelKey: "nav.graph", icon: <IconGraph /> },
  { id: "tools", labelKey: "nav.tools", icon: <IconTools /> },
  { id: "frontmatter", labelKey: "nav.frontmatter", icon: <IconFrontmatter /> },
  { id: "chronicle", labelKey: "nav.chronicle", icon: <IconChronicle /> },
  { id: "settings", labelKey: "nav.settings", icon: <IconSettings /> }
];
