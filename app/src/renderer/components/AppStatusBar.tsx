import type { ReactElement } from "react";

import { useT } from "../i18n";
import { textCount } from "../paneViewModel";
import type { CardTab } from "../store/editorStore";

interface AppStatusBarProps {
  activeCardTab: CardTab | null;
}

export function AppStatusBar({ activeCardTab }: AppStatusBarProps): ReactElement {
  const t = useT();
  const count = textCount(activeCardTab?.content ?? "");

  return (
    <footer className="status-bar">
      <span>Relic</span>
      <span>{t("app.wordCount", { chars: count.chars, words: count.words })}</span>
    </footer>
  );
}
