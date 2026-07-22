import path from "node:path";

import type { GenerateTagIndexInput } from "../../shared/ipc";
import { createTranslator, type Translator } from "../../shared/i18n";
import { fail, type RelicResult } from "../../shared/result";
import { parseMarkdownTags } from "../../shared/tags";
import { mapWithConcurrency } from "../files/concurrency";
import { readWorkspaceFileTree } from "../files/fileTree";
import {
  collectTagIndexFiles,
  type FileCandidate,
  type ToolActionFileOperations
} from "./toolCandidateCollectors";
import {
  getToolWorkspaceContext,
  maxConcurrentToolReads,
  toolActionFileOperations
} from "./toolActionRuntime";
import { formatGeneratedMarkdownHeadingText } from "./toolMarkdownFormat";
import { writeToolMarkdownOutput } from "./toolOutputFiles";
import { resolveToolTargetPaths } from "./toolTargets";
import { collectMarkdownPathsFromTree, createWikiLinkFormatter } from "./toolWikiLinks";

export async function generateTagIndex(
  input: GenerateTagIndexInput,
  operations: Partial<ToolActionFileOperations> = {},
  t: Translator = createTranslator("ja")
): Promise<RelicResult<string>> {
  const fileOperations = toolActionFileOperations(operations);
  const context = await getToolWorkspaceContext();
  if (!context.ok) return context;

  const { workspacePath } = context.value;
  const fileTree = await readWorkspaceFileTree(workspacePath);
  const targetPaths = await resolveToolTargetPaths(workspacePath, fileTree, input.target);
  if (!targetPaths.ok) return targetPaths;
  const collected: FileCandidate[] = (await collectTagIndexFiles(workspacePath, fileTree, fileOperations))
    .filter((file) => targetPaths.value.has(file.relPath));
  if (collected.length === 0) return fail("TOOL_TARGET_EMPTY", "対象になるMarkdownファイルがありません。");

  const wikiLinkForPath = createWikiLinkFormatter(collectMarkdownPathsFromTree(fileTree));
  const grouped = new Map<string, FileCandidate[]>();
  await mapWithConcurrency(collected, maxConcurrentToolReads, async (file) => {
    try {
      const content = await fileOperations.readFile(path.join(workspacePath, file.relPath), "utf-8");
      const tags = parseMarkdownTags(content).frontmatterTags;
      const targetTags = tags.length > 0 ? tags : input.includeUntagged ? [t("tools.untagged")] : [];
      for (const tag of targetTags) grouped.set(tag, [...(grouped.get(tag) ?? []), file]);
    } catch {
      return;
    }
  });

  if (grouped.size === 0) return fail("TOOL_TARGET_EMPTY", "索引に含めるタグがありません。");

  const lines: string[] = [`# ${t("tools.tagIndexDocumentTitle")}`, ""];
  for (const tag of Array.from(grouped.keys()).toSorted((a, b) => a.localeCompare(b, "ja"))) {
    const files = grouped.get(tag) ?? [];
    files.sort(input.sortBy === "mtime"
      ? (left, right) => right.mtime - left.mtime
      : (left, right) => (left.name ?? left.relPath).localeCompare(right.name ?? right.relPath, "ja"));
    lines.push(`## ${formatGeneratedMarkdownHeadingText(tag, t("common.untitled"))}`);
    for (const file of files) {
      const displayName = file.name ?? file.relPath.replace(/\.md$/i, "");
      lines.push(`- ${wikiLinkForPath(file.relPath, displayName)}`);
    }
    lines.push("");
  }

  return writeToolMarkdownOutput(
    workspacePath,
    input.outputFolder,
    input.outputName,
    lines.join("\n").trimEnd() + "\n"
  );
}
