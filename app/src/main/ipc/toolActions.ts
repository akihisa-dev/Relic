import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { app } from "electron";

import {
  type GenerateTableOfContentsInput,
  type GenerateTitleListInput,
  type MergeCardsInput,
  type SplitCardByHeadingInput,
  type CardbookTreeNode
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { parseMarkdownTags } from "../../shared/tags";
import { readCardbookCardTree } from "../cards/cardTree";
import { parseFrontmatter } from "../cards/frontmatter";
import { resolveCardbookRelativePath, resolveCardbookRelativePathOrRoot } from "../cards/paths";
import { readAppSettings } from "../settings/appSettings";
import { toCardbookState } from "../cardbook/cardbookService";

interface ToolCardbookContext {
  cardbookPath: string;
}

interface CardCandidate {
  ctime: number;
  mtime: number;
  relPath: string;
}

export async function mergeCards(input: MergeCardsInput): Promise<RelicResult<string>> {
  const context = await getToolCardbookContext();
  if (!context.ok) return context;

  const { cardbookPath } = context.value;
  const cardTree = await readCardbookCardTree(cardbookPath);
  const candidates = await collectMergeCandidates(cardbookPath, cardTree);
  const filtered = await filterMergeCandidates(cardbookPath, candidates, input);

  sortMergeCandidates(filtered, input.sortBy);

  const parts: string[] = [];
  for (const card of filtered) {
    const content = await readFile(path.join(cardbookPath, card.relPath), "utf-8");
    const name = card.relPath.split("/").at(-1)?.replace(/\.md$/, "") ?? card.relPath;
    if (input.insertCardNameHeading) {
      parts.push(`# ${name}\n\n${content.trim()}`);
    } else {
      parts.push(content.trim());
    }
  }

  const merged = parts.join("\n\n---\n\n") + "\n";
  const outputDir = resolveCardbookRelativePathOrRoot(cardbookPath, input.outputCardFolder);
  if (!outputDir.ok) return outputDir;
  const outputName = safeOutputName(input.outputName || "merged");
  if (!outputName.ok) return outputName;

  await mkdir(outputDir.value, { recursive: true });
  const outputPath = await uniqueCardPath(outputDir.value, outputName.value);
  await writeFile(outputPath, merged, "utf-8");

  return ok(path.relative(cardbookPath, outputPath));
}

export async function splitCardByHeading(input: SplitCardByHeadingInput): Promise<RelicResult<string[]>> {
  const context = await getToolCardbookContext();
  if (!context.ok) return context;

  const { cardbookPath } = context.value;
  const absSource = resolveCardbookRelativePath(cardbookPath, input.sourcePath);
  if (!absSource.ok) return absSource;
  const content = await readFile(absSource.value, "utf-8");
  const sections = splitMarkdownSections(content, input.headingLevel);

  if (sections.length === 0) {
    return fail("SPLIT_NO_HEADINGS", `H${input.headingLevel} の見出しが見つかりませんでした。`);
  }

  const outputDir = resolveCardbookRelativePathOrRoot(cardbookPath, input.outputCardFolder);
  if (!outputDir.ok) return outputDir;

  await mkdir(outputDir.value, { recursive: true });

  const created: string[] = [];
  for (const section of sections) {
    const safeName = section.title
      .replace(/[/\\:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "untitled";
    const outPath = await uniqueCardPath(outputDir.value, safeName);
    const sectionContent = section.lines.join("\n").trimEnd() + "\n";
    await writeFile(outPath, sectionContent, "utf-8");
    created.push(path.relative(cardbookPath, outPath));
  }

  return ok(created);
}

export async function generateTitleList(input: GenerateTitleListInput): Promise<RelicResult<string>> {
  const context = await getToolCardbookContext();
  if (!context.ok) return context;

  const { cardbookPath } = context.value;
  const cardTree = await readCardbookCardTree(cardbookPath);
  const collected = await collectTitleListCards(cardbookPath, cardTree, input.filterCardFolder);

  if (input.sortBy === "mtime") {
    collected.sort((a, b) => b.mtime - a.mtime);
  } else {
    collected.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }

  const lines = collected.map((card) => `- [[${card.name}]]`);
  const content = lines.join("\n") + "\n";

  const outputDir = resolveCardbookRelativePathOrRoot(cardbookPath, input.outputCardFolder);
  if (!outputDir.ok) return outputDir;
  const outputName = safeOutputName(input.outputName);
  if (!outputName.ok) return outputName;

  await mkdir(outputDir.value, { recursive: true });
  const outputPath = await uniqueCardPath(outputDir.value, outputName.value);
  await writeFile(outputPath, content, "utf-8");

  return ok(path.relative(cardbookPath, outputPath));
}

export async function generateTableOfContents(
  input: GenerateTableOfContentsInput
): Promise<RelicResult<string>> {
  const context = await getToolCardbookContext();
  if (!context.ok) return context;

  const { cardbookPath } = context.value;
  const targetAbsPath = resolveCardbookRelativePathOrRoot(cardbookPath, input.targetCardFolder);
  if (!targetAbsPath.ok) return targetAbsPath;
  const lines: string[] = [];

  await collectTableOfContentsLines(targetAbsPath.value, input.targetCardFolder, 0, input.includeSubcardFolders, lines);

  const content = lines.join("\n") + "\n";
  const outputDir = resolveCardbookRelativePathOrRoot(cardbookPath, input.outputCardFolder);
  if (!outputDir.ok) return outputDir;
  const outputName = safeOutputName(input.outputName);
  if (!outputName.ok) return outputName;

  await mkdir(outputDir.value, { recursive: true });
  const outputPath = await uniqueCardPath(outputDir.value, outputName.value);
  await writeFile(outputPath, content, "utf-8");

  return ok(path.relative(cardbookPath, outputPath));
}

async function getToolCardbookContext(): Promise<RelicResult<ToolCardbookContext>> {
  const settings = await readAppSettings(app.getPath("userData"));
  const state = toCardbookState(settings);
  if (!state.activeCardbook) return fail("NO_CARDBOOK", "カードブックが選択されていません。");

  return ok({ cardbookPath: state.activeCardbook.path });
}

async function collectMergeCandidates(
  cardbookPath: string,
  nodes: CardbookTreeNode[]
): Promise<CardCandidate[]> {
  const candidates: CardCandidate[] = [];

  async function collect(items: CardbookTreeNode[]): Promise<void> {
    for (const node of items) {
      if (node.type === "cardFolder") {
        await collect(node.children);
      } else {
        const absPath = path.join(cardbookPath, node.path);
        const s = await stat(absPath);
        candidates.push({ relPath: node.path, mtime: s.mtimeMs, ctime: s.birthtimeMs });
      }
    }
  }

  await collect(nodes);
  return candidates;
}

async function filterMergeCandidates(
  cardbookPath: string,
  candidates: CardCandidate[],
  input: MergeCardsInput
): Promise<CardCandidate[]> {
  if (input.filterType === "cardFolder" && input.filterValue) {
    return candidates.filter((card) =>
      card.relPath.startsWith(input.filterValue + "/") || card.relPath.startsWith(input.filterValue)
    );
  }

  if (input.filterType === "tag" && input.filterValue) {
    const tagFiltered: CardCandidate[] = [];
    const tag = input.filterValue.trim().replace(/^#/, "");
    for (const candidate of candidates) {
      const content = await readFile(path.join(cardbookPath, candidate.relPath), "utf-8");
      if (parseMarkdownTags(content).tags.includes(tag)) {
        tagFiltered.push(candidate);
      }
    }
    return tagFiltered;
  }

  if (input.filterType === "frontmatter") {
    const frontmatterFiltered: CardCandidate[] = [];
    const field = input.frontmatterField?.trim() ?? "";
    const value = input.filterValue.trim();

    if (field && value) {
      for (const candidate of candidates) {
        const content = await readFile(path.join(cardbookPath, candidate.relPath), "utf-8");
        const { data } = parseFrontmatter(content);

        if (matchesFrontmatterField(data[field], value)) {
          frontmatterFiltered.push(candidate);
        }
      }
    }

    return frontmatterFiltered;
  }

  return candidates;
}

function sortMergeCandidates(candidates: CardCandidate[], sortBy: MergeCardsInput["sortBy"]): void {
  if (sortBy === "mtime") candidates.sort((a, b) => b.mtime - a.mtime);
  else if (sortBy === "ctime") candidates.sort((a, b) => b.ctime - a.ctime);
  else candidates.sort((a, b) => a.relPath.localeCompare(b.relPath, "ja"));
}

function splitMarkdownSections(content: string, headingLevel: number): { title: string; lines: string[] }[] {
  const lines = content.split("\n");
  const headingPrefix = "#".repeat(headingLevel) + " ";
  const sections: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (line.startsWith(headingPrefix) && !line.startsWith(headingPrefix + "#")) {
      if (current) sections.push(current);
      current = { title: line.slice(headingPrefix.length).trim(), lines: [line] };
    } else {
      if (current) current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  return sections;
}

async function collectTitleListCards(
  cardbookPath: string,
  nodes: CardbookTreeNode[],
  filterCardFolder: string | undefined
): Promise<{ name: string; path: string; mtime: number }[]> {
  const collected: { name: string; path: string; mtime: number }[] = [];

  async function collectCards(items: CardbookTreeNode[], cardFolderRelPath: string): Promise<void> {
    for (const node of items) {
      if (node.type === "cardFolder") {
        if (!filterCardFolder || cardFolderRelPath === filterCardFolder || node.path === filterCardFolder) {
          await collectCards(node.children, node.path);
        } else if (!filterCardFolder) {
          await collectCards(node.children, node.path);
        }
      } else {
        if (filterCardFolder && !node.path.startsWith(filterCardFolder + "/") && node.path !== filterCardFolder) continue;
        const absPath = path.join(cardbookPath, node.path);
        const s = await stat(absPath);
        collected.push({ name: node.name.replace(/\.md$/, ""), path: node.path, mtime: s.mtimeMs });
      }
    }
  }

  await collectCards(nodes, "");
  return collected;
}

async function collectTableOfContentsLines(
  dirPath: string,
  relBase: string,
  indent: number,
  includeSubcardFolders: boolean,
  lines: string[]
): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name, "ja");
  });
  for (const entry of entries) {
    const prefix = "  ".repeat(indent) + "- ";
    if (entry.isDirectory()) {
      if (includeSubcardFolders) {
        lines.push(`${prefix}**${entry.name}/**`);
        await collectTableOfContentsLines(
          path.join(dirPath, entry.name),
          path.join(relBase, entry.name),
          indent + 1,
          includeSubcardFolders,
          lines
        );
      }
    } else if (entry.name.endsWith(".md")) {
      const displayName = entry.name.replace(/\.md$/, "");
      lines.push(`${prefix}[[${displayName}]]`);
    }
  }
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
    normalized.includes("/") ||
    normalized === "." ||
    normalized === ".." ||
    path.posix.isAbsolute(normalized) ||
    path.win32.isAbsolute(trimmed)
  ) {
    return fail("TOOL_OUTPUT_NAME_INVALID", "出力カード名が無効です。");
  }

  return ok(trimmed);
}

async function uniqueCardPath(dir: string, name: string): Promise<string> {
  const ext = name.endsWith(".md") ? "" : ".md";
  const base = name.replace(/\.md$/, "");
  let candidate = path.join(dir, `${base}${ext}`);
  let counter = 1;
  while (true) {
    try {
      await stat(candidate);
      candidate = path.join(dir, `${base}-${counter}${ext}`);
      counter++;
    } catch {
      return candidate;
    }
  }
}
