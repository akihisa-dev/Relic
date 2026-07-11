import { useMemo, type ComponentProps, type CSSProperties, type ReactElement } from "react";

import type { AppLanguage, EditorSettings } from "../../shared/ipc";
import { appFontFamilyMap } from "../appFont";
import { I18nProvider } from "../i18n";
import { createTranslator } from "../i18nModel";
import { AppEditorWorkspace } from "./AppEditorWorkspace";
import { AppFilesSidebar } from "./AppFilesSidebar";
import { AppOverlays } from "./AppOverlays";
import { AppRail } from "./AppRail";
import { AppMainActions } from "./AppMainActions";
import { AppStatusBar } from "./AppStatusBar";
import { AppTitleBar } from "./AppTitleBar";
import { LayoutResizeBoundary } from "./LayoutResizeBoundary";

export interface AppLayoutProps {
  editorWorkspaceProps: ComponentProps<typeof AppEditorWorkspace>;
  filesSidebarProps: ComponentProps<typeof AppFilesSidebar>;
  font: EditorSettings["font"];
  language: AppLanguage;
  overlaysProps: ComponentProps<typeof AppOverlays>;
  railProps: ComponentProps<typeof AppRail>;
  statusBarProps: ComponentProps<typeof AppStatusBar>;
  titleBarProps: ComponentProps<typeof AppTitleBar>;
}

export function AppLayout({
  editorWorkspaceProps,
  filesSidebarProps,
  font,
  language,
  overlaysProps,
  railProps,
  statusBarProps,
  titleBarProps
}: AppLayoutProps): ReactElement {
  const fontFamily = appFontFamilyMap[font];
  const t = useMemo(() => createTranslator(language), [language]);
  const appFontStyle: CSSProperties & Record<"--font-body" | "--font-display" | "--font-mono", string> = {
    "--font-body": fontFamily,
    "--font-display": fontFamily,
    "--font-mono": fontFamily,
    fontFamily
  };

  return (
    <I18nProvider language={language}>
      <div className="app-shell" style={appFontStyle}>
        <AppTitleBar {...titleBarProps}>
          <AppMainActions
            isRightPanelOpen={editorWorkspaceProps.isRightPanelOpen}
            isSplit={editorWorkspaceProps.isSplit}
            onRightPanelViewButton={editorWorkspaceProps.onRightPanelViewButton}
            onSplitToggle={editorWorkspaceProps.onSplitToggle}
            rightPanelView={editorWorkspaceProps.rightPanelView}
            showSourceControl={false}
            showRightPanelLinksControl={editorWorkspaceProps.showRightPanelLinksControl}
            showRightPanelChronicleControl={editorWorkspaceProps.showRightPanelChronicleControl}
            showRightPanelOutlineControl={editorWorkspaceProps.showRightPanelOutlineControl}
            showRightPanelRecoveryControl={editorWorkspaceProps.showRightPanelRecoveryControl}
          />
        </AppTitleBar>
        <div className="workspace">
          <AppRail {...railProps} />
          <AppFilesSidebar {...filesSidebarProps} />
          {filesSidebarProps.isSidebarOpen ? (
            <LayoutResizeBoundary
              aria-label={t("pane.resizeSidebar")}
              isActive={filesSidebarProps.isSidebarResizing}
              onResizeStart={filesSidebarProps.startSidebarResize}
              side="sidebar"
            />
          ) : null}
          <AppEditorWorkspace {...editorWorkspaceProps} />
        </div>
        <AppStatusBar {...statusBarProps} />
        <AppOverlays {...overlaysProps} />
      </div>
    </I18nProvider>
  );
}
