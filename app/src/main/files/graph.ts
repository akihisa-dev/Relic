import { readFile } from "node:fs/promises";
import path from "node:path";

import type { WorkspaceGraph, WorkspaceTreeNode } from "../../shared/ipc";
import { resolveMarkdownLinkPath, resolveWikiLinks } from "../../shared/links";
import { fail, ok, type RelicResult } from "../../shared/result";
import { parseMarkdownTags } from "../../shared/tags";
import { readWorkspaceAliases } from "./aliases";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveWorkspaceRelativePath } from "./paths";

export async function readWorkspaceGraph(workspacePath: string): Promise<RelicResult<WorkspaceGraph>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const markdownPaths = collectMarkdownPaths(fileTree);
    const aliasesResult = await readWorkspaceAliases(workspacePath);
    const aliasesByPath = aliasesResult.ok ? aliasesResult.value : {};
    const edges = new Map<string, { sourcePath: string; targetPath: string }>();
    const nodes = [];

    for (const sourcePath of markdownPaths) {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, sourcePath);
      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");
      const tags = parseMarkdownTags(content).tags;

      nodes.push({
        folder: path.dirname(sourcePath) === "." ? "" : path.dirname(sourcePath).replace(/\\/g, "/"),
        name: path.basename(sourcePath, ".md"),
        path: sourcePath,
        tags
      });

      for (const link of resolveWikiLinks(content, sourcePath, markdownPaths, aliasesByPath)) {
        if (!link.exists) continue;
        if (link.path === sourcePath) continue;
        edges.set(`${sourcePath}\u0000${link.path}`, {
          sourcePath,
          targetPath: link.path
        });
      }

      for (const link of resolveMarkdownLinks(content, sourcePath, markdownPaths)) {
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

function collectMarkdownPaths(nodes: WorkspaceTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node.path] : collectMarkdownPaths(node.children)
  );
}

function resolveMarkdownLinks(content: string, sourcePath: string, markdownPaths: string[]): string[] {
  const existingPaths = new Set(markdownPaths);
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
