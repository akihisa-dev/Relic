import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ChronicleEntry, WorkspaceTreeNode } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readWorkspaceFileTree } from "./fileTree";
import { parseFrontmatter } from "./frontmatter";
import { resolveWorkspaceRelativePath } from "./paths";

export async function readWorkspaceChronicle(workspacePath: string): Promise<RelicResult<ChronicleEntry[]>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const entries: ChronicleEntry[] = [];

    for (const relativePath of collectMarkdownPaths(fileTree)) {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");
      const range = extractChronicleRange(content);

      if (!range) continue;

      entries.push({
        endYear: range.endYear,
        fileName: path.basename(relativePath, ".md"),
        path: relativePath,
        startYear: range.startYear
      });
    }

    return ok(entries.sort((a, b) =>
      a.startYear - b.startYear ||
      a.endYear - b.endYear ||
      a.fileName.localeCompare(b.fileName, "ja")
    ));
  } catch (error) {
    return fail(
      "CHRONICLE_READ_FAILED",
      "年表を読み込めませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export function extractChronicleRange(markdown: string): { endYear: number; startYear: number } | null {
  const { data } = parseFrontmatter(markdown);
  const value = data.chronicle;

  if (!Array.isArray(value) || (value.length !== 1 && value.length !== 2)) return null;
  if (!value.every(isValidChronicleYear)) return null;

  const startYear = value[0];
  const endYear = value.length === 1 ? startYear : value[1];

  if (startYear > endYear) return null;

  return { endYear, startYear };
}

function isValidChronicleYear(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value !== 0;
}

function collectMarkdownPaths(nodes: WorkspaceTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node.path] : collectMarkdownPaths(node.children)
  );
}
