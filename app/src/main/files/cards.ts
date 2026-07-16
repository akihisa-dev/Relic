import type { WorkspaceCard } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails } from "./fileSystem";
import {
  createWorkspaceDerivedDataCache,
  frontmatterForRecord,
  normalizeWorkspaceDerivedDataOptions,
  readableWorkspaceMarkdownRecords,
  readWorkspaceDerivedFileIndex,
  type WorkspaceDerivedDataOptions,
  type WorkspaceMarkdownReadOperations
} from "./workspaceDerivedData";

export function cardForFrontmatterData(
  file: Pick<WorkspaceCard, "name" | "path">,
  data: Record<string, unknown>
): WorkspaceCard | null {
  if (typeof data.card !== "string") return null;

  const imagePath = data.card.trim();
  if (imagePath === "") return null;

  return { ...file, imagePath };
}

export async function readWorkspaceCards(
  workspacePath: string,
  optionsOrOperations: WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations = {}
): Promise<RelicResult<WorkspaceCard[]>> {
  try {
    const options = normalizeWorkspaceDerivedDataOptions(optionsOrOperations);
    const parseCache = options.parseCache ?? createWorkspaceDerivedDataCache();
    const fileIndex = await readWorkspaceDerivedFileIndex(workspacePath, options);
    const cards = readableWorkspaceMarkdownRecords(fileIndex).flatMap((record) => {
      const card = cardForFrontmatterData(
        { name: record.name, path: record.path },
        frontmatterForRecord(record, parseCache).data
      );
      return card ? [card] : [];
    });

    return ok(cards);
  } catch (error) {
    return fail(
      "WORKSPACE_CARDS_FAILED",
      "カードを読み込めませんでした。",
      errorDetails(error)
    );
  }
}
