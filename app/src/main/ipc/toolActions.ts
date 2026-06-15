import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import type { Dirent, Stats } from "node:fs";
import path from "node:path";

import { app } from "electron";

import {
  type GenerateTagIndexInput,
  type GenerateTableOfContentsInput,
  type GenerateTitleListInput,
  type MergeFilesInput,
  type WorkspaceTreeNode
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { parseMarkdownTags } from "../../shared/tags";
import { atomicWriteTextFile } from "../files/atomicWrite";
import { readWorkspaceFileTree } from "../files/fileTree";
import { pathExists } from "../files/fileSystem";
import { parseFrontmatter } from "../files/frontmatter";
import {
  resolveExistingWorkspacePathOrRoot,
  resolveNewWorkspacePath
} from "../files/paths";
import { readAppSettings } from "../settings/appSettings";
import { toWorkspaceState } from "../workspace/workspaceService";

interface ToolWorkspaceContext {
  workspacePath: string;
}

interface FileCandidate {
  ctime: number;
  name?: string;
  mtime: number;
  relPath: string;
}

interface ToolActionFileOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  readdir(directoryPath: string, options: { withFileTypes: true }): Promise<Dirent<string>[]>;
  stat(filePath: string): Promise<Stats>;
}

const defaultToolActionFileOperations: ToolActionFileOperations = {
  readFile,
  readdir: (directoryPath, options) => readdir(directoryPath, options) as Promise<Dirent<string>[]>,
  stat
};

const DEFAULT_MAX_TOOL_OUTPUT_CANDIDATES = 1000;

function isFileCandidate(candidate: FileCandidate | null): candidate is FileCandidate {
  return candidate !== null;
}

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
    const name = file.relPath.split("/").at(-1)?.replace(/\.md$/, "") ?? file.relPath;
    if (input.insertFilenameHeading) {
      return `# ${name}\n\n${content.trim()}`;
    }
    return content.trim();
  }));

  const merged = parts.join("\n\n---\n\n") + "\n";
  const outputName = safeOutputName(input.outputName || "merged");
  if (!outputName.ok) return outputName;
  const outputDir = await resolveToolOutputDirectory(workspacePath, input.outputFolder, outputName.value);
  if (!outputDir.ok) return outputDir;

  await mkdir(outputDir.value, { recursive: true });
  const outputPath = await uniqueFilePath(outputDir.value, outputName.value);
  if (!outputPath.ok) return outputPath;
  await atomicWriteTextFile(outputPath.value, merged);

  return ok(path.relative(workspacePath, outputPath.value));
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

  const outputName = safeOutputName(input.outputName);
  if (!outputName.ok) return outputName;
  const outputDir = await resolveToolOutputDirectory(workspacePath, input.outputFolder, outputName.value);
  if (!outputDir.ok) return outputDir;

  await mkdir(outputDir.value, { recursive: true });
  const outputPath = await uniqueFilePath(outputDir.value, outputName.value);
  if (!outputPath.ok) return outputPath;
  await atomicWriteTextFile(outputPath.value, content);

  return ok(path.relative(workspacePath, outputPath.value));
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
  const outputName = safeOutputName(input.outputName);
  if (!outputName.ok) return outputName;
  const outputDir = await resolveToolOutputDirectory(workspacePath, input.outputFolder, outputName.value);
  if (!outputDir.ok) return outputDir;

  await mkdir(outputDir.value, { recursive: true });
  const outputPath = await uniqueFilePath(outputDir.value, outputName.value);
  if (!outputPath.ok) return outputPath;
  await atomicWriteTextFile(outputPath.value, content);

  return ok(path.relative(workspacePath, outputPath.value));
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

    lines.push(`## ${tag}`);
    for (const file of files) {
      const displayName = file.name ?? file.relPath.replace(/\.md$/i, "");
      lines.push(`- ${wikiLinkForPath(file.relPath, displayName)}`);
    }
    lines.push("");
  }

  const outputName = safeOutputName(input.outputName);
  if (!outputName.ok) return outputName;
  const outputDir = await resolveToolOutputDirectory(workspacePath, input.outputFolder, outputName.value);
  if (!outputDir.ok) return outputDir;

  await mkdir(outputDir.value, { recursive: true });
  const outputPath = await uniqueFilePath(outputDir.value, outputName.value);
  if (!outputPath.ok) return outputPath;
  await atomicWriteTextFile(outputPath.value, lines.join("\n").trimEnd() + "\n");

  return ok(path.relative(workspacePath, outputPath.value));
}

async function getToolWorkspaceContext(): Promise<RelicResult<ToolWorkspaceContext>> {
  const settings = await readAppSettings(app.getPath("userData"));
  const state = toWorkspaceState(settings);
  if (!state.activeWorkspace) return fail("NO_WORKSPACE", "ワークスペースが選択されていません。");

  return ok({ workspacePath: state.activeWorkspace.path });
}

async function collectMergeCandidates(
  workspacePath: string,
  nodes: WorkspaceTreeNode[],
  operations: ToolActionFileOperations
): Promise<FileCandidate[]> {
  const candidates: FileCandidate[] = [];

  async function collect(items: WorkspaceTreeNode[]): Promise<void> {
    await Promise.all(items.map(async (node) => {
      if (node.type === "folder") {
        await collect(node.children);
      } else {
        const absPath = path.join(workspacePath, node.path);
        try {
          const s = await operations.stat(absPath);
          candidates.push({ relPath: node.path, mtime: s.mtimeMs, ctime: s.birthtimeMs });
        } catch {
          return;
        }
      }
    }));
  }

  await collect(nodes);
  return candidates;
}

async function filterMergeCandidates(
  workspacePath: string,
  candidates: FileCandidate[],
  input: MergeFilesInput,
  operations: ToolActionFileOperations
): Promise<FileCandidate[]> {
  if (input.filterType === "folder" && input.filterValue) {
    const folder = input.filterValue.replace(/\\/g, "/").replace(/\/+$/, "");
    if (!folder) return candidates;

    return candidates.filter((file) => file.relPath === folder || file.relPath.startsWith(`${folder}/`));
  }

  if (input.filterType === "tag" && input.filterValue) {
    const tag = input.filterValue.trim().replace(/^#/, "");
    const taggedCandidates = await Promise.all(candidates.map(async (candidate) => {
      try {
        const content = await operations.readFile(path.join(workspacePath, candidate.relPath), "utf-8");
        return new Set(parseMarkdownTags(content).tags).has(tag) ? candidate : null;
      } catch {
        return null;
      }
    }));
    return taggedCandidates.filter(isFileCandidate);
  }

  if (input.filterType === "frontmatter") {
    const field = input.frontmatterField?.trim() ?? "";
    const value = input.filterValue.trim();

    if (field && value) {
      const frontmatterFiltered = await Promise.all(candidates.map(async (candidate) => {
        try {
          const content = await operations.readFile(path.join(workspacePath, candidate.relPath), "utf-8");
          const { data } = parseFrontmatter(content);

          return matchesFrontmatterField(data[field], value) ? candidate : null;
        } catch {
          return null;
        }
      }));
      return frontmatterFiltered.filter(isFileCandidate);
    }

    return [];
  }

  return candidates;
}

function sortMergeCandidates(candidates: FileCandidate[], sortBy: MergeFilesInput["sortBy"]): void {
  if (sortBy === "mtime") candidates.sort((a, b) => b.mtime - a.mtime);
  else if (sortBy === "ctime") candidates.sort((a, b) => b.ctime - a.ctime);
  else candidates.sort((a, b) => a.relPath.localeCompare(b.relPath, "ja"));
}

async function collectTitleListFiles(
  workspacePath: string,
  nodes: WorkspaceTreeNode[],
  filterFolder: string | undefined,
  operations: ToolActionFileOperations
): Promise<{ name: string; path: string; mtime: number }[]> {
  const collected: { name: string; path: string; mtime: number }[] = [];

  async function collectFiles(items: WorkspaceTreeNode[], folderRelPath: string): Promise<void> {
    await Promise.all(items.map(async (node) => {
      if (node.type === "folder") {
        if (!filterFolder || folderRelPath === filterFolder || node.path === filterFolder) {
          await collectFiles(node.children, node.path);
        } else if (!filterFolder) {
          await collectFiles(node.children, node.path);
        }
      } else {
        if (filterFolder && !node.path.startsWith(filterFolder + "/") && node.path !== filterFolder) return;
        const absPath = path.join(workspacePath, node.path);
        try {
          const s = await operations.stat(absPath);
          collected.push({ name: node.name.replace(/\.md$/, ""), path: node.path, mtime: s.mtimeMs });
        } catch {
          return;
        }
      }
    }));
  }

  await collectFiles(nodes, "");
  return collected;
}

async function collectTagIndexFiles(
  workspacePath: string,
  nodes: WorkspaceTreeNode[],
  targetFolder: string,
  includeSubfolders: boolean,
  operations: ToolActionFileOperations
): Promise<FileCandidate[]> {
  const normalizedTarget = targetFolder.replace(/\\/g, "/").replace(/\/+$/, "");
  const collected: FileCandidate[] = [];

  function isTargetPath(filePath: string): boolean {
    const folder = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : "";

    if (!normalizedTarget) {
      return includeSubfolders || folder === "";
    }

    if (includeSubfolders) {
      return filePath.startsWith(`${normalizedTarget}/`);
    }

    return folder === normalizedTarget;
  }

  async function collect(items: WorkspaceTreeNode[]): Promise<void> {
    await Promise.all(items.map(async (node) => {
      if (node.type === "folder") {
        await collect(node.children);
        return;
      }

      if (!node.path.toLowerCase().endsWith(".md") || !isTargetPath(node.path)) return;

      try {
        const s = await operations.stat(path.join(workspacePath, node.path));
        collected.push({
          ctime: s.birthtimeMs,
          mtime: s.mtimeMs,
          name: node.name.replace(/\.md$/i, ""),
          relPath: node.path
        });
      } catch {
        return;
      }
    }));
  }

  await collect(nodes);
  return collected;
}

async function collectTableOfContentsLines(
  dirPath: string,
  relBase: string,
  indent: number,
  includeSubfolders: boolean,
  lines: string[],
  wikiLinkForPath: (relativePath: string, displayName: string) => string,
  operations: ToolActionFileOperations,
  skipOnReadError: boolean
): Promise<boolean> {
  let entries: Dirent<string>[];

  try {
    entries = await operations.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (skipOnReadError) return false;
    throw error;
  }

  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name, "ja");
  });
  for (const entry of entries) {
    const prefix = "  ".repeat(indent) + "- ";
    if (entry.isDirectory()) {
      if (includeSubfolders) {
        const childLines: string[] = [];
        const childRead = await collectTableOfContentsLines(
          path.join(dirPath, entry.name),
          path.posix.join(relBase, entry.name),
          indent + 1,
          includeSubfolders,
          childLines,
          wikiLinkForPath,
          operations,
          true
        );

        if (childRead) {
          lines.push(`${prefix}**${entry.name}/**`);
          lines.push(...childLines);
        }
      }
    } else if (entry.name.endsWith(".md")) {
      const displayName = entry.name.replace(/\.md$/, "");
      const fileRelativePath = path.posix.join(relBase, entry.name);
      lines.push(`${prefix}${wikiLinkForPath(fileRelativePath, displayName)}`);
    }
  }

  return true;
}

function collectMarkdownPathsFromTree(nodes: WorkspaceTreeNode[]): string[] {
  const paths: string[] = [];

  function collect(items: WorkspaceTreeNode[]): void {
    for (const node of items) {
      if (node.type === "folder") {
        collect(node.children);
      } else if (node.path.toLowerCase().endsWith(".md")) {
        paths.push(node.path);
      }
    }
  }

  collect(nodes);
  return paths;
}

function createWikiLinkFormatter(markdownPaths: string[]): (relativePath: string, displayName: string) => string {
  const basenameCounts = new Map<string, number>();

  for (const markdownPath of markdownPaths) {
    const basename = markdownPath.replace(/\\/g, "/").split("/").at(-1)?.replace(/\.md$/i, "") ?? markdownPath;
    basenameCounts.set(basename, (basenameCounts.get(basename) ?? 0) + 1);
  }

  return (relativePath, displayName) => {
    const normalizedPath = relativePath.replace(/\\/g, "/").replace(/\.md$/i, "");
    const basename = normalizedPath.split("/").at(-1) ?? normalizedPath;

    if ((basenameCounts.get(basename) ?? 0) === 1) {
      return displayName === basename ? `[[${basename}]]` : `[[${basename}|${displayName}]]`;
    }

    return `[[./${normalizedPath}|${displayName}]]`;
  };
}

function matchesFrontmatterField(value: unknown, query: string): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => String(item).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  }

  if (typeof value === "boolean") {
    const normalizedQuery = query.toLocaleLowerCase();

    if (["true", "1", "yes", "on"].includes(normalizedQuery)) {
      return value === true;
    }

    if (["false", "0", "no", "off"].includes(normalizedQuery)) {
      return value === false;
    }

    return String(value).toLocaleLowerCase() === normalizedQuery;
  }

  return String(value).toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function safeOutputName(name: string): RelicResult<string> {
  const trimmed = name.trim();
  const normalized = trimmed.replace(/\\/g, "/");

  if (
    !trimmed ||
    /[<>:"|?*\u0000-\u001f]/.test(trimmed) ||
    normalized.includes("/") ||
    normalized === "." ||
    normalized === ".." ||
    path.posix.isAbsolute(normalized) ||
    path.win32.isAbsolute(trimmed)
  ) {
    return fail("TOOL_OUTPUT_NAME_INVALID", "出力ファイル名が無効です。");
  }

  return ok(trimmed);
}

async function resolveToolOutputDirectory(
  workspacePath: string,
  outputFolder: string,
  outputName: string
): Promise<RelicResult<string>> {
  const outputRelativePath = path.posix.join(
    normalizeWorkspaceRelativeFolder(outputFolder),
    outputName.endsWith(".md") ? outputName : `${outputName}.md`
  );
  const outputPath = await resolveNewWorkspacePath(workspacePath, outputRelativePath);

  if (!outputPath.ok) return outputPath;

  return ok(path.dirname(outputPath.value));
}

function normalizeWorkspaceRelativeFolder(folder: string): string {
  const normalized = folder.replace(/\\/g, "/").trim();
  return normalized === "" ? "." : normalized;
}

export async function uniqueFilePath(
  dir: string,
  name: string,
  maxCandidates = DEFAULT_MAX_TOOL_OUTPUT_CANDIDATES
): Promise<RelicResult<string>> {
  const base = name.endsWith(".md") ? name.slice(0, -".md".length) : name;

  for (let counter = 0; counter < maxCandidates; counter += 1) {
    const suffix = counter === 0 ? "" : `-${counter}`;
    const candidate = path.join(dir, `${base}${suffix}.md`);

    if (!(await pathExists(candidate))) {
      return ok(candidate);
    }
  }

  return fail("TOOL_OUTPUT_NAME_EXHAUSTED", "出力ファイル名の候補が多すぎます。");
}
