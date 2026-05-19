import { readFile } from "node:fs/promises";
import path from "node:path";

import type { WorkspaceGraph } from "../../shared/ipc";
import { createWikiLinkResolver, resolveMarkdownLinkPath } from "../../shared/links";
import { fail, ok, type RelicResult } from "../../shared/result";
import { parseMarkdownTags } from "../../shared/tags";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { readWorkspaceAliases } from "./aliases";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveWorkspaceRelativePath } from "./paths";

interface GraphFileEntry {
  content: string;
  sourcePath: string;
}

const graphReadConcurrency = 48;

export async function readWorkspaceGraph(workspacePath: string): Promise<RelicResult<WorkspaceGraph>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const markdownPaths = collectMarkdownPaths(fileTree);
    const aliasesResult = await readWorkspaceAliases(workspacePath);
    const aliasesByPath = aliasesResult.ok ? aliasesResult.value : {};
    const existingMarkdownPaths = new Set(markdownPaths);
    const resolveWikiLinks = createWikiLinkResolver(markdownPaths, aliasesByPath);
    const edges = new Map<string, { sourcePath: string; targetPath: string }>();
    const entries = await readMarkdownEntries(workspacePath, markdownPaths);

    const nodes = [];

    for (const entry of entries) {
      if (!entry) continue;
      const { content, sourcePath } = entry;
      const tags = parseMarkdownTags(content).tags;

      nodes.push({
        folder: path.dirname(sourcePath) === "." ? "" : path.dirname(sourcePath).replace(/\\/g, "/"),
        name: path.basename(sourcePath, ".md"),
        path: sourcePath,
        tags
      });

      for (const link of resolveWikiLinks(content, sourcePath)) {
        if (!link.exists) continue;
        if (link.path === sourcePath) continue;
        edges.set(`${sourcePath}\u0000${link.path}`, {
          sourcePath,
          targetPath: link.path
        });
      }

      for (const link of resolveMarkdownLinks(content, sourcePath, existingMarkdownPaths)) {
        if (link === sourcePath) continue;
        edges.set(`${sourcePath}\u0000${link}`, {
          sourcePath,
          targetPath: link
        });
      }
    }

    return ok({
      edges: [...edges.values()].sort((a, b) =>
        `${a.sourcePath}/${a.targetPath}`.localeCompare(`${b.sourcePath}/${b.targetPath}`, "ja")
      ),
      nodes: nodes.sort((a, b) => a.path.localeCompare(b.path, "ja"))
    });
  } catch (error) {
    return fail(
      "WORKSPACE_GRAPH_FAILED",
      "グラフを読み込めませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function readMarkdownEntries(workspacePath: string, markdownPaths: string[]): Promise<Array<GraphFileEntry | null>> {
  const entries: Array<GraphFileEntry | null> = Array.from({ length: markdownPaths.length }, () => null);
  let nextIndex = 0;

  async function readNext(): Promise<void> {
    while (nextIndex < markdownPaths.length) {
      const index = nextIndex;
      nextIndex += 1;
      const sourcePath = markdownPaths[index];
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, sourcePath);
      if (!absolutePath.ok) continue;

      entries[index] = {
        content: await readFile(absolutePath.value, "utf8"),
        sourcePath
      };
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(graphReadConcurrency, Math.max(1, markdownPaths.length)) }, () => readNext())
  );
  return entries;
}

function resolveMarkdownLinks(content: string, sourcePath: string, existingPaths: Set<string>): string[] {
  const links = new Set<string>();
  const source = maskMarkdownCode(content);
  const pattern = /(?<!!)\[[^\]\n]+\]\(([^)\n]+)\)/g;

  for (const match of source.matchAll(pattern)) {
    const resolved = resolveMarkdownLinkPath(match[1], sourcePath);
    if (resolved && existingPaths.has(resolved.path)) {
      links.add(resolved.path);
    }
  }

  return [...links];
}

function maskMarkdownCode(markdown: string): string {
  return markdown
    .replace(/^```[\s\S]*?^```/gm, (block) => " ".repeat(block.length))
    .replace(/`[^`\n]+`/g, (block) => " ".repeat(block.length));
}
