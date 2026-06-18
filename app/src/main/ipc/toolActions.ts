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

interface ToolWorkspaceContext {
  workspacePath: string;
}

const defaultToolActionFileOperations: ToolActionFileOperations = {
  readFile,
  readdir: (directoryPath, options) => readdir(directoryPath, options) as Promise<Dirent<string>[]>,
  stat
};

export async function mergeFiles(
  input: MergeFilesInput,
  operations: Partial<ToolActionFileOperations> = {}
): Promise<RelicResult<string>> {
  const fileOperations = { ...defaultToolActionFileOperations, ...operations };
  const context = await getToolWorkspaceContext();
  if (!context.ok) return context;

  const { workspacePath } = context.value;
  const fileTree = await readWorkspaceFileTree(workspacePath);
  const candidates = await collectMergeCandidates(workspacePath, fileTree, fileOperations);
  const filtered = await filterMergeCandidates(workspacePath, candidates, input, fileOperations);

  sortMergeCandidates(filtered, input.sortBy);

  const parts = await Promise.all(filtered.map(async (file) => {
    const content = await fileOperations.readFile(path.join(workspacePath, file.relPath), "utf-8");
    const name = stripMarkdownExtension(file.relPath.split("/").at(-1) ?? file.relPath);
    if (input.insertFilenameHeading) {
      return `# ${formatGeneratedMarkdownHeadingText(name)}\n\n${content.trim()}`;
    }
    return content.trim();
  }));

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
  const collected = await collectTitleListFiles(workspacePath, fileTree, input.filterFolder, fileOperations);

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
  const targetAbsPath = await resolveExistingWorkspacePathOrRoot(workspacePath, input.targetFolder);
  if (!targetAbsPath.ok) return targetAbsPath;
  const fileTree = await readWorkspaceFileTree(workspacePath);
  const wikiLinkForPath = createWikiLinkFormatter(collectMarkdownPathsFromTree(fileTree));
  const lines: string[] = [];

  await collectTableOfContentsLines(
    targetAbsPath.value,
    input.targetFolder,
    0,
    input.includeSubfolders,
    lines,
    wikiLinkForPath,
    fileOperations,
    false
  );

  const content = lines.join("\n") + "\n";
  return writeToolMarkdownOutput(workspacePath, input.outputFolder, input.outputName, content);
}

export async function generateTagIndex(
  input: GenerateTagIndexInput,
  operations: Partial<ToolActionFileOperations> = {}
): Promise<RelicResult<string>> {
  const fileOperations = { ...defaultToolActionFileOperations, ...operations };
  const context = await getToolWorkspaceContext();
  if (!context.ok) return context;

  const { workspacePath } = context.value;
  const targetAbsPath = await resolveExistingWorkspacePathOrRoot(workspacePath, input.targetFolder);
  if (!targetAbsPath.ok) return targetAbsPath;
  const fileTree = await readWorkspaceFileTree(workspacePath);
  const collected = await collectTagIndexFiles(
    workspacePath,
    fileTree,
    input.targetFolder,
    input.includeSubfolders,
    fileOperations
  );
  const wikiLinkForPath = createWikiLinkFormatter(collectMarkdownPathsFromTree(fileTree));
  const grouped = new Map<string, FileCandidate[]>();

  await Promise.all(collected.map(async (file) => {
    try {
      const content = await fileOperations.readFile(path.join(workspacePath, file.relPath), "utf-8");
      const tags = parseMarkdownTags(content).frontmatterTags;
      const targetTags = tags.length > 0 ? tags : input.includeUntagged ? ["タグなし"] : [];

      for (const tag of targetTags) {
        grouped.set(tag, [...(grouped.get(tag) ?? []), file]);
      }
    } catch {
      return;
    }
  }));

  const lines: string[] = ["# タグ別索引", ""];
  const sortedTags = Array.from(grouped.keys()).toSorted((a, b) => a.localeCompare(b, "ja"));
  for (const tag of sortedTags) {
    const files = grouped.get(tag) ?? [];
    if (input.sortBy === "mtime") {
      files.sort((a, b) => b.mtime - a.mtime);
    } else {
      files.sort((a, b) => (a.name ?? a.relPath).localeCompare(b.name ?? b.relPath, "ja"));
    }

    lines.push(`## ${formatGeneratedMarkdownHeadingText(tag)}`);
    for (const file of files) {
      const displayName = file.name ?? file.relPath.replace(/\.md$/i, "");
      lines.push(`- ${wikiLinkForPath(file.relPath, displayName)}`);
    }
    lines.push("");
  }

  return writeToolMarkdownOutput(workspacePath, input.outputFolder, input.outputName, lines.join("\n").trimEnd() + "\n");
}

async function getToolWorkspaceContext(): Promise<RelicResult<ToolWorkspaceContext>> {
  const settings = await readAppSettings(app.getPath("userData"));
  const state = toWorkspaceState(settings);
  if (!state.activeWorkspace) return fail("NO_WORKSPACE", "ワークスペースが選択されていません。");

  return ok({ workspacePath: state.activeWorkspace.path });
}
