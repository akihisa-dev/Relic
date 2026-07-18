import type { WorkspaceTreeNode } from "../../shared/ipc";
import { maxToolTargetFiles, maxToolTargetTotalBytes, type ToolTarget } from "../../shared/ipc/tools";
import { stat } from "node:fs/promises";
import { hasMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { resolveExistingWorkspacePath } from "../files/paths";
import { mapWithConcurrency } from "../files/concurrency";

export function defaultToolTarget(): ToolTarget {
  return { kind: "workspace" };
}

export async function resolveToolTargetPaths(
  workspacePath: string,
  nodes: WorkspaceTreeNode[],
  target: ToolTarget
): Promise<RelicResult<Set<string>>> {
  const markdownPaths = collectMarkdownPaths(nodes);
  let selected: string[];

  if (target.kind === "workspace") {
    selected = markdownPaths;
  } else if (target.kind === "folder") {
    const resolvedFolder = await resolveExistingWorkspacePath(workspacePath, target.path);
    if (!resolvedFolder.ok) return resolvedFolder;
    const folder = findFolder(nodes, target.path);
    if (!folder) return fail("TOOL_TARGET_INVALID", "対象フォルダを確認できませんでした。");
    selected = collectMarkdownPaths(folder.children);
  } else {
    const available = new Set(markdownPaths);
    if (target.paths.some((filePath) => !available.has(filePath))) {
      return fail("TOOL_TARGET_INVALID", "対象のMarkdownファイルを確認できませんでした。");
    }
    selected = target.paths;
  }

  if (selected.length === 0) return fail("TOOL_TARGET_EMPTY", "対象になるMarkdownファイルがありません。");
  if (selected.length > maxToolTargetFiles) return fail("TOOL_TARGET_TOO_LARGE", "対象ファイルが多すぎます。");

  const sizes = await mapWithConcurrency(selected, 8, async (filePath) => {
    const resolved = await resolveExistingWorkspacePath(workspacePath, filePath);
    if (!resolved.ok) return resolved;
    try {
      const fileStat = await stat(resolved.value);
      if (!fileStat.isFile()) return fail("TOOL_TARGET_INVALID", "対象のMarkdownファイルを確認できませんでした。");
      return ok(fileStat.size);
    } catch {
      return fail("TOOL_TARGET_INVALID", "対象のMarkdownファイルを確認できませんでした。");
    }
  });
  const failedSize = sizes.find((result) => !result.ok);
  if (failedSize && !failedSize.ok) return failedSize;
  const totalBytes = sizes.reduce((total, result) => total + (result.ok ? result.value : 0), 0);
  if (totalBytes > maxToolTargetTotalBytes) {
    return fail("TOOL_TARGET_TOO_LARGE", "対象ファイルの合計サイズが大きすぎます。");
  }

  return ok(new Set(selected));
}

export function filterTreeToMarkdownPaths(nodes: WorkspaceTreeNode[], paths: Set<string>): WorkspaceTreeNode[] {
  const filtered: WorkspaceTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      if (paths.has(node.path) && hasMarkdownExtension(node.path)) filtered.push(node);
      continue;
    }
    const children = filterTreeToMarkdownPaths(node.children, paths);
    if (children.length > 0) filtered.push({ ...node, children });
  }
  return filtered;
}

function collectMarkdownPaths(nodes: WorkspaceTreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "folder") paths.push(...collectMarkdownPaths(node.children));
    else if (hasMarkdownExtension(node.path)) paths.push(node.path);
  }
  return paths;
}

function findFolder(nodes: WorkspaceTreeNode[], path: string): Extract<WorkspaceTreeNode, { type: "folder" }> | null {
  for (const node of nodes) {
    if (node.type !== "folder") continue;
    if (node.path === path) return node;
    const nested = findFolder(node.children, path);
    if (nested) return nested;
  }
  return null;
}
