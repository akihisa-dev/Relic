import { ipcMain, shell } from "electron";

import {
  applyAIWorkspaceOperationsChannel,
  type ApplyAIWorkspaceOperationsInput,
  clearAIWorkspaceDataChannel,
  type ClearAIWorkspaceDataInput,
  getAIWorkspaceStateChannel,
  rebuildAIWorkspaceIndexChannel,
  type RebuildAIWorkspaceIndexInput,
  sendAIWorkspaceMessageChannel,
  type SendAIWorkspaceMessageInput
} from "../../shared/ipc";
import { fail } from "../../shared/result";
import {
  applyAIWorkspaceOperations,
  clearAIWorkspaceState,
  getAIWorkspaceState,
  rebuildAIWorkspaceIndex,
  sendAIWorkspaceMessage
} from "../ai/aiWorkspaceService";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";

export function registerAIWorkspaceHandlers(): void {
  ipcMain.handle(getAIWorkspaceStateChannel, async () => {
    try {
      const context = await getAIWorkspaceContext();
      if (!context.ok) return context;

      return getAIWorkspaceState(context.value);
    } catch (error) {
      return fail("AI_WORKSPACE_READ_FAILED", "AI Workspaceを読み込めませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(rebuildAIWorkspaceIndexChannel, async (_event, _input: RebuildAIWorkspaceIndexInput) => {
    try {
      const context = await getAIWorkspaceContext();
      if (!context.ok) return context;

      return rebuildAIWorkspaceIndex(context.value);
    } catch (error) {
      return fail("AI_WORKSPACE_INDEX_FAILED", "AI Workspaceのインデックスを作成できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(sendAIWorkspaceMessageChannel, async (_event, input: SendAIWorkspaceMessageInput) => {
    try {
      if (!isSendAIWorkspaceMessageInput(input)) {
        return fail("AI_WORKSPACE_MESSAGE_INVALID", "AIに送る内容を入力してください。");
      }

      const context = await getAIWorkspaceContext();
      if (!context.ok) return context;

      return sendAIWorkspaceMessage(context.value, input, shell.trashItem);
    } catch (error) {
      return fail("AI_WORKSPACE_MESSAGE_FAILED", "AI Workspaceで処理できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(applyAIWorkspaceOperationsChannel, async (_event, input: ApplyAIWorkspaceOperationsInput) => {
    try {
      const context = await getAIWorkspaceContext();
      if (!context.ok) return context;

      return applyAIWorkspaceOperations(context.value, input ?? {}, shell.trashItem);
    } catch (error) {
      return fail("AI_WORKSPACE_APPLY_FAILED", "AI変更案を反映できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(clearAIWorkspaceDataChannel, async (_event, input: ClearAIWorkspaceDataInput) => {
    try {
      const context = await getAIWorkspaceContext();
      if (!context.ok) return context;

      return clearAIWorkspaceState(context.value, input ?? {});
    } catch (error) {
      return fail("AI_WORKSPACE_CLEAR_FAILED", "AI Workspaceデータを削除できませんでした。", ipcErrorDetails(error));
    }
  });
}

async function getAIWorkspaceContext() {
  const context = await getActiveWorkspaceContext();
  if (!context.ok) return context;

  return {
    ok: true as const,
    value: {
      userDataPath: context.value.userDataPath,
      workspaceId: context.value.activeWorkspace.id,
      workspacePath: context.value.activeWorkspace.path
    }
  };
}

function isSendAIWorkspaceMessageInput(value: unknown): value is SendAIWorkspaceMessageInput {
  if (!value || typeof value !== "object") return false;
  const record = value as { message?: unknown };

  return typeof record.message === "string" && record.message.trim().length > 0;
}
