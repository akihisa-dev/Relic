import { readFile, readdir, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

import { app } from "electron";

import {
  type GenerateTagIndexInput,
  type GenerateTableOfContentsInput,
  type GenerateTitleListInput,
  type MergeFilesInput
} from "../../shared/ipc";
import { createTranslator, type Translator } from "../../shared/i18n";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { parseMarkdownTags } from "../../shared/tags";
import { readWorkspaceFileTree } from "../files/fileTree";
import { resolveExistingWorkspacePathOrRoot } from "../files/paths";
import { readAppSettings } from "../settings/appSettings";
import { toWorkspaceState } from "../workspace/workspaceService";
import {
  collectMergeCandidates,
  collectTableOfContentsLines,
  collectTagIndexFiles,
  collectTitleListFiles,
  filterMergeCandidates,
  sortMergeCandidates,
  type FileCandidate,
  type ToolActionFileOperations
} from "./toolCandidateCollectors";
import { formatGeneratedMarkdownHeadingText } from "./toolMarkdownFormat";
import { writeToolMarkdownOutput } from "./toolOutputFiles";
import { collectMarkdownPathsFromTree, createWikiLinkFormatter } from "./toolWikiLinks";
import { mapWithConcurrency } from "../files/concurrency";
import { defaultToolTarget, resolveToolTargetPaths } from "./toolTargets";

interface ToolWorkspaceContext {
  workspacePath: string;
}

const defaultToolActionFileOperations: ToolActionFileOperations = {
  readFile,
  readdir: (directoryPath, options) => readdir(directoryPath, options) as Promise<Dirent<string>[]>,
  stat
};
const maxConcurrentToolReads = 8;

export async function mergeFiles(
  input: MergeFilesInput,
  operations: Partial<ToolActionFileOperations> = {}
): Promise<RelicResult<string>> {
  const fileOperations = { ...defaultToolActionFileOperations, ...operations };
  const context = await getToolWorkspaceContext();
  if (!context.ok) return context;

  const { workspacePath } = context.value;
  const fileTree = await readWorkspaceFileTree(workspacePath);
  const target = input.target ?? (input.filterType === "folder" && input.filterValue
    ? { kind: "folder" as const, path: input.filterValue }
    : defaultToolTarget());
  const targetPaths = await resolveToolTargetPaths(workspacePath, fileTree, target);
  if (!targetPaths.ok) return targetPaths;
  const candidates = await collectMergeCandidates(workspacePath, fileTree, fileOperations);
  const targeted = candidates.filter((candidate) => targetPaths.value.has(candidate.relPath));
  const filtered = await filterMergeCandidates(workspacePath, targeted, input, fileOperations);

  if (filtered.length === 0) return fail("TOOL_TARGET_EMPTY", "対象になるMarkdownファイルがありません。");

  sortMergeCandidates(filtered, input.sortBy);

  const parts = await mapWithConcurrency(filtered, maxConcurrentToolReads, async (file) => {
    const content = await fileOperations.readFile(path.join(workspacePath, file.relPath), "utf-8");
    const name = stripMarkdownExtension(file.relPath.split("/").at(-1) ?? file.relPath);
    if (input.insertFilenameHeading) {
      return `# ${formatGeneratedMarkdownHeadingText(name)}\n\n${content.trim()}`;
    }
    return content.trim();
  });

  const merged = parts.join("\n\n---\n\n") + "\n";
  return writeToolMarkdownOutput(workspacePath, input.outputFolder, input.outputName || "merged", merged);
}

export async function generateTitleList(
  input: GenerateTitleListInput,
  operations: Partial<ToolActionFileOperations> = {}
): Promise<RelicResult<string>> {
  const fileOperations = { ...defaultToolActionFileOperations, ...operations };
  const context = await getToolWorkspaceContext();
  if (!context.ok) return context;

  const { workspacePath } = context.value;
  const fileTree = await readWorkspaceFileTree(workspacePath);
  const target = input.target ?? (input.filterFolder
    ? { kind: "folder" as const, path: input.filterFolder }
    : defaultToolTarget());
  const targetPaths = await resolveToolTargetPaths(workspacePath, fileTree, target);
  if (!targetPaths.ok) return targetPaths;
  const collected = (await collectTitleListFiles(workspacePath, fileTree, undefined, fileOperations))
    .filter((file) => targetPaths.value.has(file.path));

  if (collected.length === 0) return fail("TOOL_TARGET_EMPTY", "対象になるMarkdownファイルがありません。");

  if (input.sortBy === "mtime") {
    collected.sort((a, b) => b.mtime - a.mtime);
  } else {
    collected.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }

  const wikiLinkForPath = createWikiLinkFormatter(collectMarkdownPathsFromTree(fileTree));
  const lines = collected.map((file) => `- ${wikiLinkForPath(file.path, file.name)}`);
  const content = lines.join("\n") + "\n";

  return writeToolMarkdownOutput(workspacePath, input.outputFolder, input.outputName, content);
}

export async function generateTableOfContents(
  input: GenerateTableOfContentsInput,
  operations: Partial<ToolActionFileOperations> = {}
): Promise<RelicResult<string>> {
  const fileOperations = { ...defaultToolActionFileOperations, ...operations };
  const context = await getToolWorkspaceContext();
  if (!context.ok) return context;

  const { workspacePath } = context.value;
  const fileTree = await readWorkspaceFileTree(workspacePath);
  const wikiLinkForPath = createWikiLinkFormatter(collectMarkdownPathsFromTree(fileTree));
  let lines: string[];
  if (input.target) {
    const targetPaths = await resolveToolTargetPaths(workspacePath, fileTree, input.target);
    if (!targetPaths.ok) return targetPaths;
    const baseFolder = input.target.kind === "folder" ? input.target.path : "";
    lines = tableOfContentsLinesForPaths(targetPaths.value, baseFolder, wikiLinkForPath);
  } else {
    const legacyTargetFolder = input.targetFolder === "." ? "" : input.targetFolder;
    const targetAbsPath = await resolveExistingWorkspacePathOrRoot(workspacePath, legacyTargetFolder);
    if (!targetAbsPath.ok) return targetAbsPath;
    lines = [];
    await collectTableOfContentsLines(
      targetAbsPath.value,
      legacyTargetFolder,
      0,
      input.includeSubfolders,
      lines,
      wikiLinkForPath,
      fileOperations,
      false
    );
    if (lines.length === 0) return fail("TOOL_TARGET_EMPTY", "対象になるMarkdownファイルがありません。");
  }

  const content = lines.join("\n") + "\n";
  return writeToolMarkdownOutput(workspacePath, input.outputFolder, input.outputName, content);
}

export async function generateTagIndex(
  input: GenerateTagIndexInput,
  operations: Partial<ToolActionFileOperations> = {},
  t: Translator = createTranslator("ja")
): Promise<RelicResult<string>> {
  const fileOperations = { ...defaultToolActionFileOperations, ...operations };
  const context = await getToolWorkspaceContext();
  if (!context.ok) return context;

  const { workspacePath } = context.value;
  const fileTree = await readWorkspaceFileTree(workspacePath);
  let collected: FileCandidate[];
  if (input.target) {
    const targetPaths = await resolveToolTargetPaths(workspacePath, fileTree, input.target);
    if (!targetPaths.ok) return targetPaths;
    collected = (await collectTagIndexFiles(workspacePath, fileTree, "", true, fileOperations))
      .filter((file) => targetPaths.value.has(file.relPath));
  } else {
    const legacyTargetFolder = input.targetFolder === "." ? "" : input.targetFolder;
    const targetAbsPath = await resolveExistingWorkspacePathOrRoot(workspacePath, legacyTargetFolder);
    if (!targetAbsPath.ok) return targetAbsPath;
    collected = await collectTagIndexFiles(
      workspacePath,
      fileTree,
      legacyTargetFolder,
      input.includeSubfolders,
      fileOperations
    );
  }
  if (collected.length === 0) return fail("TOOL_TARGET_EMPTY", "対象になるMarkdownファイルがありません。");
  const wikiLinkForPath = createWikiLinkFormatter(collectMarkdownPathsFromTree(fileTree));
  const grouped = new Map<string, FileCandidate[]>();

  await mapWithConcurrency(collected, maxConcurrentToolReads, async (file) => {
    try {
      const content = await fileOperations.readFile(path.join(workspacePath, file.relPath), "utf-8");
      const tags = parseMarkdownTags(content).frontmatterTags;
      const targetTags = tags.length > 0 ? tags : input.includeUntagged ? [t("tools.untagged")] : [];

      for (const tag of targetTags) {
        grouped.set(tag, [...(grouped.get(tag) ?? []), file]);
      }
    } catch {
      return;
    }
  });

  const lines: string[] = [`# ${t("tools.tagIndexDocumentTitle")}`, ""];
  const sortedTags = Array.from(grouped.keys()).toSorted((a, b) => a.localeCompare(b, "ja"));
  for (const tag of sortedTags) {
    const files = grouped.get(tag) ?? [];
    if (input.sortBy === "mtime") {
      files.sort((a, b) => b.mtime - a.mtime);
    } else {
      files.sort((a, b) => (a.name ?? a.relPath).localeCompare(b.name ?? b.relPath, "ja"));
    }

    lines.push(`## ${formatGeneratedMarkdownHeadingText(tag, t("common.untitled"))}`);
    for (const file of files) {
      const displayName = file.name ?? file.relPath.replace(/\.md$/i, "");
      lines.push(`- ${wikiLinkForPath(file.relPath, displayName)}`);
    }
    lines.push("");
  }

  if (grouped.size === 0) return fail("TOOL_TARGET_EMPTY", "索引に含めるタグがありません。");

  return writeToolMarkdownOutput(workspacePath, input.outputFolder, input.outputName, lines.join("\n").trimEnd() + "\n");
}

interface TocPathNode {
  files: Array<{ displayName: string; path: string }>;
  folders: Map<string, TocPathNode>;
}

function tableOfContentsLinesForPaths(
  paths: Set<string>,
  baseFolder: string,
  wikiLinkForPath: (relativePath: string, displayName: string) => string
): string[] {
  const root: TocPathNode = { files: [], folders: new Map() };
  const prefix = baseFolder ? `${baseFolder}/` : "";

  for (const filePath of paths) {
    const displayPath = prefix && filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;
    const segments = displayPath.split("/");
    const fileName = segments.pop() ?? displayPath;
    let node = root;
    for (const segment of segments) {
      let child = node.folders.get(segment);
      if (!child) {
        child = { files: [], folders: new Map() };
        node.folders.set(segment, child);
      }
      node = child;
    }
    node.files.push({ displayName: stripMarkdownExtension(fileName), path: filePath });
  }

  const lines: string[] = [];
  const append = (node: TocPathNode, indent: number): void => {
    for (const [name, child] of [...node.folders].sort(([a], [b]) => a.localeCompare(b, "ja"))) {
      lines.push(`${"  ".repeat(indent)}- **${formatGeneratedMarkdownHeadingText(name)}/**`);
      append(child, indent + 1);
    }
    for (const file of node.files.sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"))) {
      lines.push(`${"  ".repeat(indent)}- ${wikiLinkForPath(file.path, file.displayName)}`);
    }
  };
  append(root, 0);
  return lines;
}

async function getToolWorkspaceContext(): Promise<RelicResult<ToolWorkspaceContext>> {
  const settings = await readAppSettings(app.getPath("userData"));
  const state = toWorkspaceState(settings);
  if (!state.activeWorkspace) return fail("NO_WORKSPACE", "ワークスペースが選択されていません。");

  return ok({ workspacePath: state.activeWorkspace.path });
}
