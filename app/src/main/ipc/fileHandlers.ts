import { registerFileSearchHandlers } from "./fileSearchHandlers";
import { registerFolderItemHandlers } from "./folderItemHandlers";
import { registerMarkdownFileHandlers } from "./markdownFileHandlers";

export function registerFileHandlers(): void {
  registerFileSearchHandlers();
  registerMarkdownFileHandlers();
  registerFolderItemHandlers();
}
