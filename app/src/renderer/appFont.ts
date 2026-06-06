import type { EditorSettings } from "../shared/ipc";

export const appFontFamilyMap: Record<EditorSettings["font"], string> = {
  gothic: '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif',
  mono: 'Menlo, Consolas, "Courier New", monospace',
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
};

