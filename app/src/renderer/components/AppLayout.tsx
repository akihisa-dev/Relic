import type { ComponentProps, ReactElement } from "react";

import type { AppLanguage } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { AppEditorWorkspace } from "./AppEditorWorkspace";
import { AppFilesSidebar } from "./AppFilesSidebar";
import { AppOverlays } from "./AppOverlays";
import { AppRail } from "./AppRail";
import { AppTitleBar } from "./AppTitleBar";

export interface AppLayoutProps {
  editorWorkspaceProps: ComponentProps<typeof AppEditorWorkspace>;
  filesSidebarProps: ComponentProps<typeof AppFilesSidebar>;
  language: AppLanguage;
  overlaysProps: ComponentProps<typeof AppOverlays>;
  railProps: ComponentProps<typeof AppRail>;
  titleBarProps: ComponentProps<typeof AppTitleBar>;
}

export function AppLayout({
  editorWorkspaceProps,
  filesSidebarProps,
  language,
  overlaysProps,
  railProps,
  titleBarProps
}: AppLayoutProps): ReactElement {
  return (
    <I18nProvider language={language}>
      <div className="app-shell">
        <AppTitleBar {...titleBarProps} />
        <div className="workspace">
          <AppRail {...railProps} />
          <AppFilesSidebar {...filesSidebarProps} />
          <AppEditorWorkspace {...editorWorkspaceProps} />
        </div>
        <AppOverlays {...overlaysProps} />
      </div>
    </I18nProvider>
  );
}
