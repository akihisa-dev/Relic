import { useMemo } from "react";
import type { ReactElement } from "react";

import { useT } from "../i18n";
import type { EditorSaveStatus } from "../hooks/useEditorAutoSave";
import { textCount } from "../paneViewModel";
import type { FileTab } from "../store/editorStore";

interface AppStatusBarProps {
  activeFileTab: FileTab | null;
  saveStatus?: EditorSaveStatus;
}

export function AppStatusBar({ activeFileTab, saveStatus }: AppStatusBarProps): ReactElement {
  const t = useT();
  const count = useMemo(
    () => textCount(activeFileTab?.content ?? ""),
    [activeFileTab?.content]
  );
  const saveStatusLabel = saveStatus ? {
    dirty: t("app.saveStatus.dirty"),
    error: t("app.saveStatus.error"),
    externalConflict: t("app.saveStatus.externalConflict"),
    saved: t("app.saveStatus.saved"),
    saving: t("app.saveStatus.saving")
  }[saveStatus] : null;

  return (
    <footer className="status-bar">
      <span>Relic</span>
      {activeFileTab && saveStatusLabel ? <span>{saveStatusLabel}</span> : null}
      <span>{t("app.wordCount", { chars: count.chars, words: count.words })}</span>
    </footer>
  );
}
