import { ipcMain, shell } from "electron";

import {
  applyAIWorkspaceOperationsChannel,
  type ApplyAIWorkspaceOperationsInput,
  clearAIWorkspaceDataChannel,
  type ClearAIWorkspaceDataInput,
  discardAIWorkspaceOperationsChannel,
  type DiscardAIWorkspaceOperationsInput,
  getAIWorkspaceStateChannel,
  previewAIWorkspaceMessageChannel,
  type PreviewAIWorkspaceMessageInput,
  rebuildAIWorkspaceIndexChannel,
  type RebuildAIWorkspaceIndexInput,
  sendAIWorkspaceMessageChannel,
  type SendAIWorkspaceMessageInput,
  type AIWorkspaceState,
  workspaceChangedChannel
} from "../../shared/ipc";
import { fail } from "../../shared/result";
import {
  applyAIWorkspaceOperations,
  clearAIWorkspaceState,
  discardAIWorkspaceOperations,
  getAIWorkspaceState,
  previewAIWorkspaceMessage,
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

  ipcMain.handle(sendAIWorkspaceMessageChannel, async (event, input: SendAIWorkspaceMessageInput) => {
    try {
      if (!isSendAIWorkspaceMessageInput(input)) {
        return fail("AI_WORKSPACE_MESSAGE_INVALID", "AIに送る内容を入力してください。");
      }

      const context = await getAIWorkspaceContext();
      if (!context.ok) return context;

      const beforeState = await getAIWorkspaceState(context.value);
      const result = await sendAIWorkspaceMessage(context.value, input, shell.trashItem);
      if (result.ok && beforeState.ok && hasAppliedPendingOperation(beforeState.value, result.value)) {
        event.sender.send(workspaceChangedChannel, {
          changedAt: new Date().toISOString(),
          workspaceId: context.value.workspaceId,
          workspacePath: context.value.workspacePath
        });
      }

      return result;
    } catch (error) {
      return fail("AI_WORKSPACE_MESSAGE_FAILED", "AI Workspaceで処理できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(previewAIWorkspaceMessageChannel, async (_event, input: PreviewAIWorkspaceMessageInput) => {
    try {
      if (!isPreviewAIWorkspaceMessageInput(input)) {
        return fail("AI_WORKSPACE_MESSAGE_INVALID", "AIに送る内容を入力してください。");
      }

      const context = await getAIWorkspaceContext();
      if (!context.ok) return context;

      return previewAIWorkspaceMessage(context.value, input);
    } catch (error) {
      return fail("AI_WORKSPACE_PREVIEW_FAILED", "AIへ送るMarkdown参照を確認できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(applyAIWorkspaceOperationsChannel, async (event, input: ApplyAIWorkspaceOperationsInput) => {
    try {
      const context = await getAIWorkspaceContext();
      if (!context.ok) return context;

      const result = await applyAIWorkspaceOperations(context.value, input ?? {}, shell.trashItem);
      if (result.ok) {
        event.sender.send(workspaceChangedChannel, {
          changedAt: new Date().toISOString(),
          workspaceId: context.value.workspaceId,
          workspacePath: context.value.workspacePath
        });
      }

      return result;
    } catch (error) {
      return fail("AI_WORKSPACE_APPLY_FAILED", "AI変更案を反映できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(discardAIWorkspaceOperationsChannel, async (_event, input: DiscardAIWorkspaceOperationsInput) => {
    try {
      const context = await getAIWorkspaceContext();
      if (!context.ok) return context;

      return discardAIWorkspaceOperations(context.value, input ?? {});
    } catch (error) {
      return fail("AI_WORKSPACE_DISCARD_FAILED", "AI変更案を取りやめできませんでした。", ipcErrorDetails(error));
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

function isPreviewAIWorkspaceMessageInput(value: unknown): value is PreviewAIWorkspaceMessageInput {
  if (!value || typeof value !== "object") return false;
  const record = value as { message?: unknown };

  return typeof record.message === "string" && record.message.trim().length > 0;
}

function hasAppliedPendingOperation(beforeState: AIWorkspaceState, afterState: AIWorkspaceState): boolean {
  const pendingIds = new Set(beforeState.operationHistory
    .filter((operation) => operation.status === "pending")
    .map((operation) => operation.id));

  return afterState.operationHistory.some((operation) => {
    return pendingIds.has(operation.id) && operation.status === "applied";
  });
}
