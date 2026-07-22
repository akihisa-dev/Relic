import type { GenerateTableOfContentsInput } from "../../shared/ipc";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, type RelicResult } from "../../shared/result";
import { readWorkspaceFileTree } from "../files/fileTree";
import { getToolWorkspaceContext } from "./toolActionRuntime";
import { formatGeneratedMarkdownHeadingText } from "./toolMarkdownFormat";
import { writeToolMarkdownOutput } from "./toolOutputFiles";
import { resolveToolTargetPaths } from "./toolTargets";
import { collectMarkdownPathsFromTree, createWikiLinkFormatter } from "./toolWikiLinks";

interface TocPathNode {
  files: Array<{ displayName: string; path: string }>;
  folders: Map<string, TocPathNode>;
}

export async function generateTableOfContents(
  input: GenerateTableOfContentsInput
): Promise<RelicResult<string>> {
  const context = await getToolWorkspaceContext();
  if (!context.ok) return context;

  const { workspacePath } = context.value;
  const fileTree = await readWorkspaceFileTree(workspacePath);
  const wikiLinkForPath = createWikiLinkFormatter(collectMarkdownPathsFromTree(fileTree));
  const targetPaths = await resolveToolTargetPaths(workspacePath, fileTree, input.target);
  if (!targetPaths.ok) return targetPaths;
  const baseFolder = input.target.kind === "folder" ? input.target.path : "";
  const lines = tableOfContentsLinesForPaths(targetPaths.value, baseFolder, wikiLinkForPath);
  if (lines.length === 0) return fail("TOOL_TARGET_EMPTY", "対象になるMarkdownファイルがありません。");

  return writeToolMarkdownOutput(
    workspacePath,
    input.outputFolder,
    input.outputName,
    lines.join("\n") + "\n"
  );
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
