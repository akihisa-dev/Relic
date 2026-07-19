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
  data: Record<string, unknown>,
  flavorText: string | null = null
): WorkspaceCard | null {
  if (!Object.prototype.hasOwnProperty.call(data, "card")) return null;

  const imagePath = typeof data.card === "string" && data.card.trim() !== ""
    ? data.card.trim()
    : null;

  return { ...file, flavorText, imagePath };
}

export function flavorTextFromMarkdownBody(body: string): string | null {
  const lines = body.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const opening = /^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/.exec(lines[index] ?? "");
    if (!opening) continue;

    const markerRun = opening[2] ?? "";
    const marker = markerRun[0];
    const language = (opening[3] ?? "").trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
    const content: string[] = [];
    let closed = false;

    for (index += 1; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const closing = /^( {0,3})(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (closing && closing[2]?.[0] === marker && closing[2].length >= markerRun.length) {
        closed = true;
        break;
      }
      content.push(line);
    }

    if (!closed || language !== "flavortext") continue;
    while (content[0]?.trim() === "") content.shift();
    while (content.at(-1)?.trim() === "") content.pop();
    return content.join("\n");
  }

  return null;
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
      const frontmatter = frontmatterForRecord(record, parseCache);
      const card = cardForFrontmatterData(
        { name: record.name, path: record.path },
        frontmatter.data,
        flavorTextFromMarkdownBody(frontmatter.body)
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
