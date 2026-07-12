import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { RefObject } from "react";

import type { EditorSettings, UserDefinedField } from "../shared/ipc";
import type { Translator } from "./i18nModel";

export interface EditorExtensionConfig {
  allFilePaths: string[];
  frontmatterCandidates: Record<string, string[]>;
  onChangeRef: RefObject<(content: string) => void>;
  onContextMenu: (event: MouseEvent, view: EditorView) => boolean;
  onOpenLinkRef: RefObject<((href: string) => void) | undefined>;
  onOpenWikiLinkRef: RefObject<((target: string, heading?: string) => void) | undefined>;
  onSelectionChange: (state: EditorState) => void;
  settings: EditorSettings;
  sourcePath?: string;
  sourceMode: boolean;
  t: Translator;
  typewriterMode: boolean;
  userDefinedFields: UserDefinedField[];
  workspacePath?: string | null;
}
