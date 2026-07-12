import type { AppLayoutProps } from "./components/AppLayout";
import {
  createEditorWorkspaceProps,
  createFilesSidebarProps,
  createOverlaysProps,
  createRailProps,
  createStatusBarProps,
  createTitleBarProps
} from "./appLayoutPropsSections";
import type { AppLayoutPropsInput } from "./appLayoutPropsTypes";

export type {
  AppLayoutEditorWorkspaceInput,
  AppLayoutFilesSidebarInput,
  AppLayoutOverlaysInput,
  AppLayoutPropsInput,
  AppLayoutRailInput,
  AppLayoutShellInput,
  AppLayoutStatusBarInput
} from "./appLayoutPropsTypes";

export function createAppLayoutProps(input: AppLayoutPropsInput): AppLayoutProps {
  return {
    editorWorkspaceProps: createEditorWorkspaceProps(input.editorWorkspace),
    filesSidebarProps: createFilesSidebarProps(input.filesSidebar),
    font: input.shell.editorSettings.font,
    language: input.shell.editorSettings.language,
    overlaysProps: createOverlaysProps(input.overlays),
    railProps: createRailProps(input.rail),
    statusBarProps: createStatusBarProps(input.statusBar),
    titleBarProps: createTitleBarProps(input)
  };
}
