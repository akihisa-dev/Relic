import path from "node:path";

import type { WorkspaceGraph, WorkspaceGraphLink, WorkspaceGraphNode } from "../../shared/ipc";
import {
  createWikiLinkResolver,
  resolveMarkdownLinkPath
} from "../../shared/links";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readWorkspaceAliases } from "./aliases";
import { errorDetails } from "./fileSystem";
import {
  createWorkspaceDerivedDataCache,
  markdownContentForRecord,
  normalizeWorkspaceDerivedDataOptions,
  readableWorkspaceMarkdownRecords,
  readWorkspaceDerivedFileIndex,
  tagsForRecord,
  type WorkspaceDerivedDataOptions,
  type WorkspaceMarkdownReadOperations
} from "./workspaceDerivedData";

type LinkKind = WorkspaceGraphLink["type"];

export async function readWorkspaceGraph(
  workspacePath: string,
  optionsOrOperations: WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations = {}
): Promise<RelicResult<WorkspaceGraph>> {
  try {
    const options = normalizeWorkspaceDerivedDataOptions(optionsOrOperations);
    const parseCache = options.parseCache ?? createWorkspaceDerivedDataCache();
    const fileIndex = await readWorkspaceDerivedFileIndex(workspacePath, options);
    const markdownPaths = fileIndex.entries.map((entry) => entry.path);
    const existingPaths = new Set(markdownPaths);
    const aliasesResult = await readWorkspaceAliases(workspacePath, {
      ...options,
      fileIndex,
      parseCache
    });
    const aliasesByPath = aliasesResult.ok ? aliasesResult.value : {};
    const resolveWikiLinks = createWikiLinkResolver(markdownPaths, aliasesByPath);
    const nodeMap = new Map<string, WorkspaceGraphNode>();
    const linkCounts = new Map<string, WorkspaceGraphLink>();

    for (const entry of fileIndex.entries) {
      addFileNode(nodeMap, entry.path);
    }

    for (const record of readableWorkspaceMarkdownRecords(fileIndex)) {
      const sourceId = record.path;
      const content = markdownContentForRecord(record, parseCache);

      for (const resolvedLink of resolveWikiLinks(content, record.path)) {
        const targetId = resolvedLink.path;
        if (resolvedLink.exists) {
          addFileNode(nodeMap, targetId);
        } else {
          addUnresolvedNode(nodeMap, targetId);
        }
        addLink(linkCounts, sourceId, targetId, "link");
      }

      for (const markdownLink of scanMarkdownLinks(content)) {
        const resolvedMarkdownLink = resolveMarkdownLinkPath(markdownLink, record.path);
        if (!resolvedMarkdownLink) continue;

        const targetId = resolvedMarkdownLink.path;
        if (existingPaths.has(targetId)) {
          addFileNode(nodeMap, targetId);
        } else {
          addUnresolvedNode(nodeMap, targetId);
        }
        addLink(linkCounts, sourceId, targetId, "link");
      }

      for (const tag of tagsForRecord(record, parseCache)) {
        const tagId = `#${tag}`;
        addTagNode(nodeMap, tagId, tag);
        addLink(linkCounts, sourceId, tagId, "tag");
      }
    }

    const links = [...linkCounts.values()].sort((a, b) =>
      a.source.localeCompare(b.source, "ja") || a.target.localeCompare(b.target, "ja")
    );
    const linkCountBySource = new Map<string, number>();
    const linkCountByTarget = new Map<string, number>();

    for (const link of links) {
      linkCountBySource.set(link.source, (linkCountBySource.get(link.source) ?? 0) + link.count);
      linkCountByTarget.set(link.target, (linkCountByTarget.get(link.target) ?? 0) + link.count);
    }

    return ok({
      links,
      nodes: [...nodeMap.values()]
        .map((node) => ({
          ...node,
          backlinkCount: linkCountByTarget.get(node.id) ?? 0,
          linkCount: linkCountBySource.get(node.id) ?? 0
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "ja"))
    });
  } catch (error) {
    return fail(
      "WORKSPACE_GRAPH_FAILED",
      "グラフを読み込めませんでした。",
      errorDetails(error)
    );
  }
}

function addFileNode(nodeMap: Map<string, WorkspaceGraphNode>, filePath: string): void {
  if (nodeMap.has(filePath)) return;

  nodeMap.set(filePath, {
    backlinkCount: 0,
    exists: true,
    id: filePath,
    label: stripMarkdownExtension(path.posix.basename(filePath)),
    linkCount: 0,
    path: filePath,
    type: "file"
  });
}

function addUnresolvedNode(nodeMap: Map<string, WorkspaceGraphNode>, targetPath: string): void {
  if (nodeMap.has(targetPath)) return;

  nodeMap.set(targetPath, {
    backlinkCount: 0,
    exists: false,
    id: targetPath,
    label: stripMarkdownExtension(path.posix.basename(targetPath)),
    linkCount: 0,
    path: null,
    type: "unresolved"
  });
}

function addTagNode(nodeMap: Map<string, WorkspaceGraphNode>, id: string, tag: string): void {
  if (nodeMap.has(id)) return;

  nodeMap.set(id, {
    backlinkCount: 0,
    exists: true,
    id,
    label: `#${tag}`,
    linkCount: 0,
    path: null,
    type: "tag"
  });
}

function addLink(
  linkCounts: Map<string, WorkspaceGraphLink>,
  source: string,
  target: string,
  type: LinkKind
): void {
  if (source === target) return;

  const key = `${type}\0${source}\0${target}`;
  const current = linkCounts.get(key);
  if (current) {
    current.count += 1;
    return;
  }

  linkCounts.set(key, { count: 1, source, target, type });
}

function scanMarkdownLinks(markdown: string): string[] {
  const links: string[] = [];
  const pattern = /(!)?\[[^\]\n]*\]\(([^)\n]+)\)/g;

  for (const match of markdown.matchAll(pattern)) {
    if (match[1]) continue;

    const rawTarget = match[2]?.trim();
    if (!rawTarget) continue;

    const target = rawTarget.split(/\s+["'][^"']*["']\s*$/)[0]?.trim();
    if (target) links.push(target);
  }

  return links;
}
