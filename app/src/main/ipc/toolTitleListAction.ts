import type { GenerateTitleListInput } from "../../shared/ipc";
import { fail, type RelicResult } from "../../shared/result";
import { readWorkspaceFileTree } from "../files/fileTree";
import { collectTitleListFiles, type ToolActionFileOperations } from "./toolCandidateCollectors";
import { getToolWorkspaceContext, toolActionFileOperations } from "./toolActionRuntime";
import { writeToolMarkdownOutput } from "./toolOutputFiles";
import { resolveToolTargetPaths } from "./toolTargets";
import { collectMarkdownPathsFromTree, createWikiLinkFormatter } from "./toolWikiLinks";

export async function generateTitleList(
  input: GenerateTitleListInput,
  operations: Partial<ToolActionFileOperations> = {}
): Promise<RelicResult<string>> {
  const fileOperations = toolActionFileOperations(operations);
  const context = await getToolWorkspaceContext();
  if (!context.ok) return context;

  const { workspacePath } = context.value;
  const fileTree = await readWorkspaceFileTree(workspacePath);
  const targetPaths = await resolveToolTargetPaths(workspacePath, fileTree, input.target);
  if (!targetPaths.ok) return targetPaths;
  const collected = (await collectTitleListFiles(workspacePath, fileTree, undefined, fileOperations))
    .filter((file) => targetPaths.value.has(file.path));

  if (collected.length === 0) return fail("TOOL_TARGET_EMPTY", "対象になるMarkdownファイルがありません。");

  collected.sort(input.sortBy === "mtime"
    ? (left, right) => right.mtime - left.mtime
    : (left, right) => left.name.localeCompare(right.name, "ja"));

  const wikiLinkForPath = createWikiLinkFormatter(collectMarkdownPathsFromTree(fileTree));
  const content = collected.map((file) => `- ${wikiLinkForPath(file.path, file.name)}`).join("\n") + "\n";
  return writeToolMarkdownOutput(workspacePath, input.outputFolder, input.outputName, content);
}
