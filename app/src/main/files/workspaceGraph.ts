import path from "node:path";

import type { WorkspaceGraph, WorkspaceGraphLink, WorkspaceGraphNode, WorkspaceTreeNode } from "../../shared/ipc";
import { isSupportedMarkdownImagePath, markdownImageAltFromPath } from "../../shared/imageFiles";
import {
  createWikiLinkResolver,
  scanWikiLinks,
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
import { readWorkspaceFileTree } from "./fileTree";

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
    const attachmentPaths = collectAttachmentPaths(
      options.fileTree ?? await readWorkspaceFileTree(workspacePath)
    );
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
        if (
          resolvedLink.wikiLink.kind === "embed" &&
          isSupportedMarkdownImagePath(rawWikiTargetBase(resolvedLink.wikiLink.raw))
        ) {
          continue;
        }

        const targetId = resolvedLink.path;
        if (resolvedLink.exists) {
          addFileNode(nodeMap, targetId);
        } else {
          addUnresolvedNode(nodeMap, targetId);
        }
        addLink(linkCounts, sourceId, targetId, "link");
      }

      for (const attachmentPath of scanWikiAttachmentLinks(content, record.path, attachmentPaths)) {
        addAttachmentNode(nodeMap, attachmentPath);
        addLink(linkCounts, sourceId, attachmentPath, "link");
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

      for (const attachmentPath of scanMarkdownAttachmentLinks(content, record.path, attachmentPaths)) {
        addAttachmentNode(nodeMap, attachmentPath);
        addLink(linkCounts, sourceId, attachmentPath, "link");
      }

      for (const tag of collectGraphTags(record, parseCache)) {
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

function addAttachmentNode(nodeMap: Map<string, WorkspaceGraphNode>, attachmentPath: string): void {
  if (nodeMap.has(attachmentPath)) return;

  nodeMap.set(attachmentPath, {
    backlinkCount: 0,
    exists: true,
    id: attachmentPath,
    label: markdownImageAltFromPath(attachmentPath),
    linkCount: 0,
    path: null,
    type: "attachment"
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
  const codeRanges = collectMarkdownCodeRanges(markdown);
  const pattern = /(!)?\[[^\]\n]*\]\(([^)\n]+)\)/g;

  for (const match of markdown.matchAll(pattern)) {
    if (match.index !== undefined && isOffsetInRanges(match.index, codeRanges)) continue;
    if (match[1]) continue;

    const rawTarget = match[2]?.trim();
    if (!rawTarget) continue;

    const target = rawTarget.split(/\s+["'][^"']*["']\s*$/)[0]?.trim();
    if (target) links.push(target);
  }

  return links;
}

function scanMarkdownAttachmentLinks(
  markdown: string,
  sourcePath: string,
  attachmentPaths: Set<string>
): string[] {
  const links: string[] = [];
  const codeRanges = collectMarkdownCodeRanges(markdown);
  const pattern = /!\[[^\]\n]*\]\(([^)\n]+)\)/g;

  for (const match of markdown.matchAll(pattern)) {
    if (match.index !== undefined && isOffsetInRanges(match.index, codeRanges)) continue;

    const rawTarget = match[1]?.trim();
    if (!rawTarget) continue;

    const target = rawTarget.split(/\s+["'][^"']*["']\s*$/)[0]?.trim();
    const resolvedPath = target ? resolveAttachmentTargetPath(target, sourcePath, attachmentPaths) : null;
    if (resolvedPath) links.push(resolvedPath);
  }

  return links;
}

function scanWikiAttachmentLinks(
  markdown: string,
  sourcePath: string,
  attachmentPaths: Set<string>
): string[] {
  return scanWikiLinks(markdown)
    .filter((link) => link.kind === "embed" && isSupportedMarkdownImagePath(link.rawTargetBase))
    .flatMap((link) => {
      const resolvedPath = resolveAttachmentTargetPath(link.rawTargetBase, sourcePath, attachmentPaths);
      return resolvedPath ? [resolvedPath] : [];
    });
}

function resolveAttachmentTargetPath(
  target: string,
  sourcePath: string,
  attachmentPaths: Set<string>
): string | null {
  const normalizedTarget = decodeMarkdownLinkPath(target.trim()).replace(/\\/g, "/");
  if (
    normalizedTarget === "" ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalizedTarget) ||
    normalizedTarget.startsWith("//") ||
    normalizedTarget.startsWith("#") ||
    !isSupportedMarkdownImagePath(normalizedTarget)
  ) {
    return null;
  }

  const sourceDirectory = sourcePath.includes("/")
    ? sourcePath.split("/").slice(0, -1).join("/")
    : "";
  const directPath = normalizedTarget.startsWith("/")
    ? normalizePathSegments(normalizedTarget.slice(1))
    : normalizePathSegments(
      sourceDirectory === "" ? normalizedTarget : `${sourceDirectory}/${normalizedTarget}`
    );

  if (attachmentPaths.has(directPath)) return directPath;
  if (normalizedTarget.includes("/") || normalizedTarget.startsWith(".")) return null;

  return uniqueBasenamePath(normalizedTarget, attachmentPaths);
}

function collectAttachmentPaths(nodes: WorkspaceTreeNode[]): Set<string> {
  const paths = new Set<string>();
  const visit = (items: WorkspaceTreeNode[]) => {
    for (const item of items) {
      if (item.type === "folder") {
        visit(item.children);
        continue;
      }

      if (item.kind === "image") {
        paths.add(item.path);
      }
    }
  };
  visit(nodes);

  return paths;
}

function collectGraphTags(
  record: Parameters<typeof tagsForRecord>[0],
  parseCache: Parameters<typeof tagsForRecord>[1]
): string[] {
  return [...new Set([
    ...tagsForRecord(record, parseCache),
    ...scanInlineTags(markdownContentForRecord(record, parseCache))
  ])].toSorted((a, b) => a.localeCompare(b, "ja"));
}

function scanInlineTags(markdown: string): string[] {
  const tags = new Set<string>();
  const codeRanges = collectMarkdownCodeRanges(markdown);
  const pattern = /(^|[\s([{"'])#([^\s#.,;:!?()[\]{}<>"'`]+(?:\/[^\s#.,;:!?()[\]{}<>"'`]+)*)/g;

  for (const match of markdown.matchAll(pattern)) {
    const tagStart = (match.index ?? 0) + (match[1]?.length ?? 0);
    if (isOffsetInRanges(tagStart, codeRanges)) continue;

    const tag = match[2]?.replace(/\/+$/, "");
    if (!tag || /^\d+$/.test(tag)) continue;
    tags.add(tag);
  }

  return [...tags];
}

function rawWikiTargetBase(raw: string): string {
  const body = /^\!?\[\[([^\]\n]+)\]\]$/.exec(raw)?.[1] ?? "";
  const targetPart = body.split("|", 1)[0] ?? "";
  const targetWithHeading = targetPart.split("^", 1)[0] ?? "";

  return (targetWithHeading.split("#", 1)[0] ?? "").trim();
}

function decodeMarkdownLinkPath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function uniqueBasenamePath(target: string, paths: Set<string>): string | null {
  const targetKey = target.toLocaleLowerCase();
  let match: string | null = null;

  for (const candidate of paths) {
    if ((candidate.split("/").at(-1) ?? candidate).toLocaleLowerCase() !== targetKey) continue;
    if (match) return null;
    match = candidate;
  }

  return match;
}

function normalizePathSegments(value: string): string {
  const segments: string[] = [];
  for (const segment of value.replace(/\\/g, "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.join("/");
}

function collectMarkdownCodeRanges(markdown: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  const lines = markdown.match(/[^\n]*(?:\n|$)/g) ?? [];
  let fence: { marker: "`" | "~"; length: number } | null = null;
  let offset = 0;

  for (const line of lines) {
    const lineEnd = offset + line.length;
    const fenceMatch = /^( {0,3})(`{3,}|~{3,})/.exec(line);

    if (fence) {
      ranges.push({ from: offset, to: lineEnd });
      if (fenceMatch && fenceMatch[2]?.startsWith(fence.marker) && fenceMatch[2].length >= fence.length) {
        fence = null;
      }
    } else if (fenceMatch) {
      fence = { length: fenceMatch[2].length, marker: fenceMatch[2][0] as "`" | "~" };
      ranges.push({ from: offset, to: lineEnd });
    }

    offset = lineEnd;
  }

  const inlinePattern = /`+[^`\n]*`+/g;
  for (const match of markdown.matchAll(inlinePattern)) {
    const from = match.index;
    if (from !== undefined) ranges.push({ from, to: from + (match[0]?.length ?? 0) });
  }

  return ranges;
}

function isOffsetInRanges(offset: number, ranges: Array<{ from: number; to: number }>): boolean {
  return ranges.some((range) => offset >= range.from && offset < range.to);
}
