import { readFile, stat } from "node:fs/promises";

import { app } from "electron";

import { fail, ok, type RelicResult } from "../../shared/result";
import { readAppSettings } from "../settings/appSettings";
import { toWorkspaceState } from "../workspace/workspaceService";
import type { ToolActionFileOperations } from "./toolCandidateCollectors";

interface ToolWorkspaceContext {
  workspacePath: string;
}

const defaultToolActionFileOperations: ToolActionFileOperations = {
  readFile,
  stat
};

export const maxConcurrentToolReads = 8;

export function toolActionFileOperations(
  operations: Partial<ToolActionFileOperations>
): ToolActionFileOperations {
  return { ...defaultToolActionFileOperations, ...operations };
}

export async function getToolWorkspaceContext(): Promise<RelicResult<ToolWorkspaceContext>> {
  const settings = await readAppSettings(app.getPath("userData"));
  const state = toWorkspaceState(settings);
  if (!state.activeWorkspace) return fail("NO_WORKSPACE", "ワークスペースが選択されていません。");

  return ok({ workspacePath: state.activeWorkspace.path });
}
