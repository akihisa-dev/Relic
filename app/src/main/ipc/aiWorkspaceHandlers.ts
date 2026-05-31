import { app, ipcMain, shell } from "electron";

import {
  applyAIWorkspaceOperationsChannel,
  type ApplyAIWorkspaceOperationsInput,
  clearAIWorkspaceDataChannel,
  createAIWorkspaceChatChannel,
  type CreateAIWorkspaceChatInput,
  type ClearAIWorkspaceDataInput,
  deleteOpenAIAPIKeyChannel,
  discardAIWorkspaceOperationsChannel,
  type DiscardAIWorkspaceOperationsInput,
  getAISettingsChannel,
  getAIWorkspaceStateChannel,
  saveAIProviderChannel,
  type SaveAIProviderInput,
  saveAIModelChannel,
  type SaveAIModelInput,
  saveOpenAIAPIKeyChannel,
  type SaveOpenAIAPIKeyInput,
  selectAIWorkspaceChatChannel,
  type SelectAIWorkspaceChatInput,
  previewAIWorkspaceMessageChannel,
  type PreviewAIWorkspaceMessageInput,
  rebuildAIWorkspaceIndexChannel,
  type RebuildAIWorkspaceIndexInput,
  sendAIWorkspaceMessageChannel,
  type SendAIWorkspaceMessageInput,
  testOpenAIAPIKeyChannel,
  type AISettingsState,
  type AIWorkspaceState,
  type TestOpenAIAPIKeyResult,
  workspaceChangedChannel
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import {
  deleteOpenAIAPIKey,
  hasOpenAIAPIKey,
  isOpenAIKeyStorageAvailable,
  readOpenAIAPIKey,
  saveOpenAIAPIKey
} from "../ai/openAIKeyStore";
import { testOpenAIAPIKey } from "../ai/openAIResponsesClient";
import { readAppSettings, writeAppSettings } from "../settings/appSettings";
import {
  applyAIWorkspaceOperations,
  clearAIWorkspaceState,
  createAIWorkspaceChat,
  discardAIWorkspaceOperations,
  getAIWorkspaceState,
  previewAIWorkspaceMessage,
  rebuildAIWorkspaceIndex,
  selectAIWorkspaceChat,
  sendAIWorkspaceMessage
} from "../ai/aiWorkspaceService";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";

export function registerAIWorkspaceHandlers(): void {
  ipcMain.handle(getAISettingsChannel, async (): Promise<RelicResult<AISettingsState>> => {
    try {
      return ok(await getAISettingsState());
    } catch (error) {
      return fail("AI_SETTINGS_READ_FAILED", "AI設定を読み込めませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(saveOpenAIAPIKeyChannel, async (_event, input: SaveOpenAIAPIKeyInput): Promise<RelicResult<AISettingsState>> => {
    try {
      if (!input || typeof input.apiKey !== "string") {
        return fail("AI_SETTINGS_OPENAI_KEY_INVALID", "OpenAI APIキーを入力してください。");
      }

      await saveOpenAIAPIKey(app.getPath("userData"), input.apiKey);
      return ok(await getAISettingsState());
    } catch (error) {
      return fail("AI_SETTINGS_OPENAI_KEY_SAVE_FAILED", "OpenAI APIキーを保存できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(saveAIModelChannel, async (_event, input: SaveAIModelInput): Promise<RelicResult<AISettingsState>> => {
    try {
      if (!isSaveAIModelInput(input)) {
        return fail("AI_SETTINGS_MODEL_INVALID", "OpenAIモデルを選んでください。");
      }

      const userDataPath = app.getPath("userData");
      const settings = await readAppSettings(userDataPath);
      await writeAppSettings(userDataPath, {
        ...settings,
        aiSettings: {
          ...settings.aiSettings,
          openAIModel: input.model
        }
      });

      return ok(await getAISettingsState());
    } catch (error) {
      return fail("AI_SETTINGS_MODEL_SAVE_FAILED", "OpenAIモデルを保存できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(saveAIProviderChannel, async (_event, input: SaveAIProviderInput): Promise<RelicResult<AISettingsState>> => {
    try {
      if (!isSaveAIProviderInput(input)) {
        return fail("AI_SETTINGS_PROVIDER_INVALID", "AI接続方式を選んでください。");
      }

      const userDataPath = app.getPath("userData");
      const settings = await readAppSettings(userDataPath);
      await writeAppSettings(userDataPath, {
        ...settings,
        aiSettings: {
          ...settings.aiSettings,
          aiProvider: input.aiProvider
        }
      });

      return ok(await getAISettingsState());
    } catch (error) {
      return fail("AI_SETTINGS_PROVIDER_SAVE_FAILED", "AI接続方式を保存できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(deleteOpenAIAPIKeyChannel, async (): Promise<RelicResult<AISettingsState>> => {
    try {
      await deleteOpenAIAPIKey(app.getPath("userData"));
      return ok(await getAISettingsState());
    } catch (error) {
      return fail("AI_SETTINGS_OPENAI_KEY_DELETE_FAILED", "OpenAI APIキーを削除できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(testOpenAIAPIKeyChannel, async (): Promise<RelicResult<TestOpenAIAPIKeyResult>> => {
    try {
      const apiKey = await readOpenAIAPIKey(app.getPath("userData"));
      if (!apiKey) {
        return fail("AI_SETTINGS_OPENAI_KEY_MISSING", "OpenAI APIキーを先に登録してください。");
      }

      await testOpenAIAPIKey(apiKey);
      const settings = await readAppSettings(app.getPath("userData"));
      return ok({ model: settings.aiSettings.openAIModel, ok: true });
    } catch (error) {
      return fail("AI_SETTINGS_OPENAI_KEY_TEST_FAILED", "OpenAI APIキーを確認できませんでした。", ipcErrorDetails(error));
    }
  });

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

  ipcMain.handle(createAIWorkspaceChatChannel, async (_event, input: CreateAIWorkspaceChatInput) => {
    try {
      const context = await getAIWorkspaceContext();
      if (!context.ok) return context;

      return createAIWorkspaceChat(context.value, input ?? {});
    } catch (error) {
      return fail("AI_WORKSPACE_CHAT_CREATE_FAILED", "AIチャットを作成できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(selectAIWorkspaceChatChannel, async (_event, input: SelectAIWorkspaceChatInput) => {
    try {
      if (!isSelectAIWorkspaceChatInput(input)) {
        return fail("AI_WORKSPACE_CHAT_INVALID", "切り替えるAIチャットを選んでください。");
      }

      const context = await getAIWorkspaceContext();
      if (!context.ok) return context;

      return selectAIWorkspaceChat(context.value, input);
    } catch (error) {
      return fail("AI_WORKSPACE_CHAT_SELECT_FAILED", "AIチャットを切り替えられませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(sendAIWorkspaceMessageChannel, async (event, input: SendAIWorkspaceMessageInput) => {
    try {
      if (!isSendAIWorkspaceMessageInput(input)) {
        return fail("AI_WORKSPACE_MESSAGE_INVALID", "AIに送る内容を入力してください。");
      }

      const context = await getAIWorkspaceContext();
      if (!context.ok) return context;

      const result = await sendAIWorkspaceMessage(context.value, input, shell.trashItem);
      if (result.ok) {
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

      const beforeState = await getAIWorkspaceState(context.value);
      const result = await applyAIWorkspaceOperations(context.value, input ?? {}, shell.trashItem);
      if (result.ok && beforeState.ok && hasAppliedPendingOperation(beforeState.value, result.value)) {
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

async function getAISettingsState(): Promise<AISettingsState> {
  const userDataPath = app.getPath("userData");
  const settings = await readAppSettings(userDataPath);

  return {
    aiProvider: settings.aiSettings.aiProvider,
    model: settings.aiSettings.openAIModel,
    openAIAPIKeyConfigured: await hasOpenAIAPIKey(userDataPath),
    secureStorageAvailable: isOpenAIKeyStorageAvailable()
  };
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

function isSelectAIWorkspaceChatInput(value: unknown): value is SelectAIWorkspaceChatInput {
  if (!value || typeof value !== "object") return false;
  const record = value as { chatId?: unknown };

  return typeof record.chatId === "string" && record.chatId.trim().length > 0;
}

function isSaveAIModelInput(value: unknown): value is SaveAIModelInput {
  if (!value || typeof value !== "object") return false;
  const record = value as { model?: unknown };

  return record.model === "gpt-5.5" ||
    record.model === "gpt-5.4" ||
    record.model === "gpt-5.4-mini" ||
    record.model === "gpt-5.4-nano";
}

function isSaveAIProviderInput(value: unknown): value is SaveAIProviderInput {
  if (!value || typeof value !== "object") return false;
  const record = value as { aiProvider?: unknown };

  return record.aiProvider === "codex-app-server" || record.aiProvider === "openai-api";
}

function hasAppliedPendingOperation(beforeState: AIWorkspaceState, afterState: AIWorkspaceState): boolean {
  const pendingIds = new Set<string>();
  for (const operation of beforeState.operationHistory) {
    if (operation.status === "pending") {
      pendingIds.add(operation.id);
    }
  }

  return afterState.operationHistory.some((operation) => {
    return pendingIds.has(operation.id) && operation.status === "applied";
  });
}
