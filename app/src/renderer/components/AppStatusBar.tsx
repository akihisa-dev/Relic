import type { ReactElement } from "react";

import { useT } from "../i18n";
import { textCount } from "../paneViewModel";
import type { FileTab } from "../store/editorStore";

interface AppStatusBarProps {
  activeFileTab: FileTab | null;
}

export function AppStatusBar({ activeFileTab }: AppStatusBarProps): ReactElement {
  const t = useT();
  const count = textCount(activeFileTab?.content ?? "");

  return (
    <footer className="status-bar">
      <span>Relic</span>
      <span>{t("app.wordCount", { chars: count.chars, words: count.words })}</span>
    </footer>
  );
}
