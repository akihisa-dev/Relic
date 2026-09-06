import { readFile, realpath, stat } from "node:fs/promises";

import { fail, ok, type RelicResult } from "../../shared/result";
import { getActiveWorkspaceContext } from "./activeWorkspace";
import type { ToolActionFileOperations } from "./toolCandidateCollectors";
import { writeToolMarkdownOutput } from "./toolOutputFiles";
import { workspaceMutationService, type WorkspaceMutationContext } from "../files/workspaceMutationService";

const defaultToolActionFileOperations: ToolActionFileOperations = {
  readFile,
  realpath,
  stat
};

export const maxConcurrentToolReads = 8;

export function toolActionFileOperations(
  operations: Partial<ToolActionFileOperations>
): ToolActionFileOperations {
  return { ...defaultToolActionFileOperations, ...operations };
}

export async function getToolWorkspaceContext(): Promise<RelicResult<WorkspaceMutationContext>> {
  const active = await getActiveWorkspaceContext();
  if (!active.ok) {
    return active.error.code === "WORKSPACE_NOT_SELECTED"
      ? fail("NO_WORKSPACE", "ワークスペースが選択されていません。")
      : active;
  }
  const workspace = active.value.activeWorkspace;

  return ok({ workspaceId: workspace.id, workspacePath: workspace.path });
}

export function writeToolOutput(
  context: WorkspaceMutationContext,
  outputFolder: string,
  outputName: string,
  content: string
): Promise<RelicResult<string>> {
  return workspaceMutationService.run(
    context,
    ({ workspacePath }) => writeToolMarkdownOutput(workspacePath, outputFolder, outputName, content)
  );
}
