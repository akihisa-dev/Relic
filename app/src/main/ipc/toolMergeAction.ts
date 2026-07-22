import path from "node:path";

import type { MergeFilesInput } from "../../shared/ipc";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, type RelicResult } from "../../shared/result";
import { mapWithConcurrency } from "../files/concurrency";
import { readWorkspaceFileTree } from "../files/fileTree";
import {
  collectMergeCandidates,
  filterMergeCandidates,
  sortMergeCandidates,
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

export async function mergeFiles(
  input: MergeFilesInput,
  operations: Partial<ToolActionFileOperations> = {}
): Promise<RelicResult<string>> {
  const fileOperations = toolActionFileOperations(operations);
  const context = await getToolWorkspaceContext();
  if (!context.ok) return context;

  const { workspacePath } = context.value;
  const fileTree = await readWorkspaceFileTree(workspacePath);
  const targetPaths = await resolveToolTargetPaths(workspacePath, fileTree, input.target);
  if (!targetPaths.ok) return targetPaths;
  const candidates = await collectMergeCandidates(workspacePath, fileTree, fileOperations);
  const targeted = candidates.filter((candidate) => targetPaths.value.has(candidate.relPath));
  const filtered = await filterMergeCandidates(workspacePath, targeted, input, fileOperations);

  if (filtered.length === 0) return fail("TOOL_TARGET_EMPTY", "対象になるMarkdownファイルがありません。");

  sortMergeCandidates(filtered, input.sortBy);
  const parts = await mapWithConcurrency(filtered, maxConcurrentToolReads, async (file) => {
    const content = await fileOperations.readFile(path.join(workspacePath, file.relPath), "utf-8");
    const name = stripMarkdownExtension(file.relPath.split("/").at(-1) ?? file.relPath);
    return input.insertFilenameHeading
      ? `# ${formatGeneratedMarkdownHeadingText(name)}\n\n${content.trim()}`
      : content.trim();
  });

  return writeToolMarkdownOutput(
    workspacePath,
    input.outputFolder,
    input.outputName || "merged",
    parts.join("\n\n---\n\n") + "\n"
  );
}
