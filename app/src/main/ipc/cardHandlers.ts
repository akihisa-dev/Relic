import { registerCardSearchHandlers } from "./cardSearchHandlers";
import { registerCardFolderItemHandlers } from "./cardFolderItemHandlers";
import { registerMarkdownCardHandlers } from "./markdownCardHandlers";

export function registerCardHandlers(): void {
  registerCardSearchHandlers();
  registerMarkdownCardHandlers();
  registerCardFolderItemHandlers();
}
