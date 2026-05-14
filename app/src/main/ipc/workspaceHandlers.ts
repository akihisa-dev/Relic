import { mkdir } from "node:fs/promises";

import { app, dialog, ipcMain } from "electron";

import {
  createNewWorkspaceChannel,
  defaultFeatureToggles,
  getFeatureTogglesChannel,
  getUserDefinedFieldsChannel,
  getWorkspaceAliasesChannel,
  getWorkspaceChronicleChannel,
  getWorkspaceGraphChannel,
  getWorkspaceStateChannel,
  getWorkspaceTagsChannel,
  openWorkspaceChannel,
  removeWorkspaceChannel,
  renameWorkspaceChannel,
  type RemoveWorkspaceInput,
  type RenameWorkspaceInput,
  saveWorkspaceGanttChartsChannel,
  updateGanttChartEntryChannel,
  saveFeatureTogglesChannel,
  getFrontmatterTemplatesChannel,
  getFrontmatterValueCandidatesChannel,
  saveFrontmatterTemplatesChannel,
  saveUserDefinedFieldsChannel,
  type FeatureToggles,
  type FrontmatterTemplate,
  type GanttChartSettings,
  type GanttChartSource,
  type UpdateGanttChartEntryInput,
  switchWorkspaceChannel,
  type SwitchWorkspaceInput,
  togglePinChannel,
  type UserDefinedField,
  type UserDefinedFieldType,
  type WorkspaceState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readWorkspaceAliases } from "../files/aliases";
import { readWorkspaceChronicle, updateWorkspaceGanttChartEntry } from "../files/chronicle";
import { readWorkspaceFileTree } from "../files/fileTree";
import { readFrontmatterValueCandidates } from "../files/frontmatterCandidates";
import { readWorkspaceGraph } from "../files/graph";
import { readWorkspaceTags } from "../files/tags";
import { readAppSettings, writeAppSettings } from "../settings/appSettings";
import { readWorkspaceSettings, writeWorkspaceSettings } from "../settings/workspaceSettings";
import {
  addOrActivateWorkspace,
  activateWorkspace,
  createWorkspaceSummary,
  prepareWorkspace,
  removeWorkspaceRegistration,
  renameWorkspaceRegistration,
  toWorkspaceState
} from "../workspace/workspaceService";

const userDefinedFieldTypes: UserDefinedFieldType[] = [
  "text",
  "number",
  "date",
  "datetime",
  "time",
  "boolean",
  "select",
  "multi-select",
  "url"
];
const userDefinedFieldNamePattern = /^[^\s:][^\r\n:]*$/;
const reservedUserDefinedFieldNames = new Set(["aliases", "tags", "chronicle", "date", "plannedDate", "actualDate"]);
const ganttChartSources: GanttChartSource[] = ["chronicle", "date"];

function isUserDefinedFieldsInput(input: unknown): input is UserDefinedField[] {
  if (!Array.isArray(input)) return false;

  const names = new Set<string>();

  return input.every((field) => {
    if (typeof field !== "object" || field === null) return false;
    const candidate = field as Record<string, unknown>;

    if (
      typeof candidate.name !== "string" ||
      !userDefinedFieldNamePattern.test(candidate.name) ||
      reservedUserDefinedFieldNames.has(candidate.name)
    ) return false;
    if (names.has(candidate.name)) return false;
    names.add(candidate.name);
    if (!userDefinedFieldTypes.includes(candidate.type as UserDefinedFieldType)) return false;
    if ("choices" in candidate && !Array.isArray(candidate.choices)) return false;
    if (Array.isArray(candidate.choices) && !candidate.choices.every((choice) => typeof choice === "string")) return false;

    return true;
  });
}

function isGanttChartsInput(input: unknown): input is GanttChartSettings[] {
  if (!Array.isArray(input) || input.length !== 2) return false;

  const sources = new Set<GanttChartSource>();

  return input.every((chart) => {
    if (typeof chart !== "object" || chart === null) return false;

    const candidate = chart as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim() === "") return false;
    if (typeof candidate.name !== "string" || candidate.name.trim() === "") return false;
    if (!ganttChartSources.includes(candidate.source as GanttChartSource)) return false;
    if (sources.has(candidate.source as GanttChartSource)) return false;
    if ("filePaths" in candidate && !Array.isArray(candidate.filePaths)) return false;
    if (Array.isArray(candidate.filePaths) && !candidate.filePaths.every((path) => typeof path === "string")) return false;

    sources.add(candidate.source as GanttChartSource);
    return true;
  });
}

function isUpdateGanttChartEntryInput(input: unknown): input is UpdateGanttChartEntryInput {
  if (typeof input !== "object" || input === null) return false;

  const candidate = input as Record<string, unknown>;
  const startValue = candidate.startValue;
  const endValue = candidate.endValue;

  if (typeof startValue !== "number" || typeof endValue !== "number") return false;

  return (
    typeof candidate.path === "string" &&
    ganttChartSources.includes(candidate.source as GanttChartSource) &&
    (!("dateKind" in candidate) || candidate.dateKind === "planned" || candidate.dateKind === "actual") &&
    (candidate.kind === "move" || candidate.kind === "resize-start" || candidate.kind === "resize-end") &&
    Number.isInteger(candidate.originalStartValue) &&
    Number.isInteger(candidate.originalEndValue) &&
    Number.isInteger(startValue) &&
    Number.isInteger(endValue) &&
    startValue <= endValue
  );
}

function isFrontmatterTemplatesInput(input: unknown): input is FrontmatterTemplate[] {
  if (!Array.isArray(input)) return false;

  const names = new Set<string>();

  return input.every((template) => {
    if (typeof template !== "object" || template === null) return false;
    const candidate = template as Record<string, unknown>;
    if (typeof candidate.name !== "string" || candidate.name.trim() === "") return false;
    if (names.has(candidate.name)) return false;
    names.add(candidate.name);

    return (
      Array.isArray(candidate.fieldNames) &&
      candidate.fieldNames.length > 0 &&
      candidate.fieldNames.every((fieldName) => (
        typeof fieldName === "string" && userDefinedFieldNamePattern.test(fieldName)
      ))
    );
  });
}

export function registerWorkspaceHandlers(): void {
  ipcMain.handle(getWorkspaceStateChannel, async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));

      return ok(await buildWorkspaceState(settings));
    } catch (error) {
      return fail(
        "WORKSPACE_STATE_FAILED",
        "ワークスペース情報を読み込めませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getWorkspaceTagsChannel, async () => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readWorkspaceTags(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "TAGS_READ_FAILED",
        "タグを読み込めませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getFrontmatterValueCandidatesChannel, async () => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readFrontmatterValueCandidates(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "FRONTMATTER_VALUE_CANDIDATES_READ_FAILED",
        "フロントマター候補を読み込めませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getWorkspaceAliasesChannel, async () => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readWorkspaceAliases(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "WORKSPACE_ALIASES_FAILED",
        "別名を読み込めませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getWorkspaceChronicleChannel, async () => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      const workspaceSettings = await readWorkspaceSettings(app.getPath("userData"), state.activeWorkspace.id);
      return readWorkspaceChronicle(state.activeWorkspace.path, workspaceSettings.ganttCharts);
    } catch (error) {
      return fail(
        "WORKSPACE_CHRONICLE_FAILED",
        "年表を読み込めませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getWorkspaceGraphChannel, async () => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readWorkspaceGraph(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "WORKSPACE_GRAPH_FAILED",
        "グラフを読み込めませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(saveWorkspaceGanttChartsChannel, async (_event, input: unknown) => {
    try {
      if (!isGanttChartsInput(input)) {
        return fail("INVALID_GANTT_CHARTS", "年表設定が正しくありません。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      const workspaceSettings = await readWorkspaceSettings(app.getPath("userData"), state.activeWorkspace.id);
      await writeWorkspaceSettings(app.getPath("userData"), state.activeWorkspace.id, {
        ...workspaceSettings,
        ganttCharts: input.map((chart) => ({
          filePaths: chart.filePaths,
          id: chart.id.trim(),
          name: chart.name.trim(),
          source: chart.source
        }))
      });

      return readWorkspaceChronicle(state.activeWorkspace.path, input);
    } catch (error) {
      return fail(
        "WORKSPACE_GANTT_SAVE_FAILED",
        "年表設定を保存できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(updateGanttChartEntryChannel, async (_event, input: unknown) => {
    try {
      if (!isUpdateGanttChartEntryInput(input)) {
        return fail("GANTT_ENTRY_UPDATE_INVALID_INPUT", "チャートの変更内容が正しくありません。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      const workspaceSettings = await readWorkspaceSettings(app.getPath("userData"), state.activeWorkspace.id);
      return updateWorkspaceGanttChartEntry(state.activeWorkspace.path, workspaceSettings.ganttCharts, input);
    } catch (error) {
      return fail(
        "GANTT_ENTRY_UPDATE_FAILED",
        "チャートの変更を保存できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(openWorkspaceChannel, async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const selection = await dialog.showOpenDialog({
        buttonLabel: "開く",
        message: "Relicで使うワークスペースフォルダを選んでください。",
        properties: ["openDirectory", "createDirectory"]
      });

      if (selection.canceled || selection.filePaths.length === 0) {
        const settings = await readAppSettings(app.getPath("userData"));

        return ok(await buildWorkspaceState(settings));
      }

      const workspace = createWorkspaceSummary(selection.filePaths[0]);
      await prepareWorkspace(workspace.path);

      const settings = await readAppSettings(app.getPath("userData"));
      const nextSettings = addOrActivateWorkspace(settings, workspace);
      await writeAppSettings(app.getPath("userData"), nextSettings);

      return ok(await buildWorkspaceState(nextSettings));
    } catch (error) {
      return fail(
        "WORKSPACE_OPEN_FAILED",
        "ワークスペースを開けませんでした。フォルダの権限や保存場所を確認してください。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(createNewWorkspaceChannel, async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const selection = await dialog.showSaveDialog({
        buttonLabel: "ここに作成",
        message: "新しいワークスペースの場所と名前を指定してください。",
        nameFieldLabel: "ワークスペース名",
        showsTagField: false
      });

      if (selection.canceled || !selection.filePath) {
        const settings = await readAppSettings(app.getPath("userData"));

        return ok(await buildWorkspaceState(settings));
      }

      await mkdir(selection.filePath, { recursive: true });
      const workspace = createWorkspaceSummary(selection.filePath);
      await prepareWorkspace(workspace.path);

      const settings = await readAppSettings(app.getPath("userData"));
      const nextSettings = addOrActivateWorkspace(settings, workspace);
      await writeAppSettings(app.getPath("userData"), nextSettings);

      return ok(await buildWorkspaceState(nextSettings));
    } catch (error) {
      return fail(
        "WORKSPACE_CREATE_FAILED",
        "ワークスペースを作成できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(togglePinChannel, async (_event, path: unknown): Promise<RelicResult<WorkspaceState>> => {
    try {
      if (typeof path !== "string") {
        return fail("TOGGLE_PIN_INVALID_INPUT", "パスが無効です。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const activeWorkspace = settings.workspaces.find((ws) => ws.id === settings.lastWorkspaceId);

      if (!activeWorkspace) {
        return fail("TOGGLE_PIN_NO_WORKSPACE", "アクティブなワークスペースがありません。");
      }

      const wsSettings = await readWorkspaceSettings(app.getPath("userData"), activeWorkspace.id);
      const updated = wsSettings.pinnedPaths.includes(path)
        ? wsSettings.pinnedPaths.filter((p) => p !== path)
        : [...wsSettings.pinnedPaths, path];

      await writeWorkspaceSettings(app.getPath("userData"), activeWorkspace.id, {
        ...wsSettings,
        pinnedPaths: updated
      });

      return ok(await buildWorkspaceState(settings));
    } catch (error) {
      return fail(
        "TOGGLE_PIN_FAILED",
        "ピン留め操作に失敗しました。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(
    switchWorkspaceChannel,
    async (_event, input: SwitchWorkspaceInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isSwitchWorkspaceInput(input)) {
          return fail("WORKSPACE_SWITCH_INVALID_INPUT", "ワークスペースを選択してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const nextSettings = activateWorkspace(settings, input.workspaceId);

        if (!nextSettings.ok) {
          return nextSettings;
        }

        const activeWorkspace = nextSettings.value.workspaces.find(
          (workspace) => workspace.id === input.workspaceId
        );

        if (!activeWorkspace) {
          return fail("WORKSPACE_NOT_FOUND", "登録済みワークスペースが見つかりませんでした。");
        }

        await prepareWorkspace(activeWorkspace.path);
        await writeAppSettings(app.getPath("userData"), nextSettings.value);

        return ok(await buildWorkspaceState(nextSettings.value));
      } catch (error) {
        return fail(
          "WORKSPACE_SWITCH_FAILED",
          "ワークスペースを切り替えられませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  ipcMain.handle(
    removeWorkspaceChannel,
    async (_event, input: RemoveWorkspaceInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isWorkspaceIdInput(input)) {
          return fail("WORKSPACE_REMOVE_INVALID_INPUT", "ワークスペースを選択してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const nextSettings = removeWorkspaceRegistration(settings, input.workspaceId);

        if (!nextSettings.ok) {
          return nextSettings;
        }

        await writeAppSettings(app.getPath("userData"), nextSettings.value);

        return ok(await buildWorkspaceState(nextSettings.value));
      } catch (error) {
        return fail(
          "WORKSPACE_REMOVE_FAILED",
          "ワークスペースを一覧から削除できませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  ipcMain.handle(
    renameWorkspaceChannel,
    async (_event, input: RenameWorkspaceInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isRenameWorkspaceInput(input)) {
          return fail("WORKSPACE_RENAME_INVALID_INPUT", "ワークスペース名を入力してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const renameResult = await renameWorkspaceRegistration(settings, input.workspaceId, input.name);

        if (!renameResult.ok) {
          return renameResult;
        }

        if (renameResult.value.oldWorkspaceId !== renameResult.value.newWorkspaceId) {
          const workspaceSettings = await readWorkspaceSettings(
            app.getPath("userData"),
            renameResult.value.oldWorkspaceId
          );
          await writeWorkspaceSettings(
            app.getPath("userData"),
            renameResult.value.newWorkspaceId,
            workspaceSettings
          );
        }

        await writeAppSettings(app.getPath("userData"), renameResult.value.nextSettings);

        return ok(await buildWorkspaceState(renameResult.value.nextSettings));
      } catch (error) {
        return fail(
          "WORKSPACE_RENAME_FAILED",
          "ワークスペース名を変更できませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  ipcMain.handle(getFeatureTogglesChannel, async (): Promise<RelicResult<FeatureToggles>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      return ok(settings.featureToggles ?? defaultFeatureToggles);
    } catch (error) {
      return fail("FEATURE_TOGGLES_READ_FAILED", "機能トグルを読み込めませんでした。", error instanceof Error ? error.message : String(error));
    }
  });

  ipcMain.handle(saveFeatureTogglesChannel, async (_event, input: FeatureToggles): Promise<RelicResult<void>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      await writeAppSettings(app.getPath("userData"), { ...settings, featureToggles: input });
      return ok(undefined);
    } catch (error) {
      return fail("FEATURE_TOGGLES_SAVE_FAILED", "機能トグルを保存できませんでした。", error instanceof Error ? error.message : String(error));
    }
  });

  ipcMain.handle(getUserDefinedFieldsChannel, async (): Promise<RelicResult<UserDefinedField[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      return ok(settings.userDefinedFields);
    } catch (error) {
      return fail("USER_DEFINED_FIELDS_READ_FAILED", "カスタムフィールドを読み込めませんでした。", error instanceof Error ? error.message : String(error));
    }
  });

  ipcMain.handle(saveUserDefinedFieldsChannel, async (_event, input: UserDefinedField[]): Promise<RelicResult<void>> => {
    try {
      if (!isUserDefinedFieldsInput(input)) {
        return fail("USER_DEFINED_FIELDS_INVALID_INPUT", "カスタムフィールドの値が正しくありません。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      await writeAppSettings(app.getPath("userData"), { ...settings, userDefinedFields: input });
      return ok(undefined);
    } catch (error) {
      return fail("USER_DEFINED_FIELDS_SAVE_FAILED", "カスタムフィールドを保存できませんでした。", error instanceof Error ? error.message : String(error));
    }
  });

  ipcMain.handle(getFrontmatterTemplatesChannel, async (): Promise<RelicResult<FrontmatterTemplate[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      return ok(settings.frontmatterTemplates);
    } catch (error) {
      return fail("FRONTMATTER_TEMPLATES_READ_FAILED", "フロントマターテンプレートを読み込めませんでした。", error instanceof Error ? error.message : String(error));
    }
  });

  ipcMain.handle(saveFrontmatterTemplatesChannel, async (_event, input: FrontmatterTemplate[]): Promise<RelicResult<void>> => {
    try {
      if (!isFrontmatterTemplatesInput(input)) {
        return fail("FRONTMATTER_TEMPLATES_INVALID_INPUT", "フロントマターテンプレートの値が正しくありません。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      await writeAppSettings(app.getPath("userData"), { ...settings, frontmatterTemplates: input });
      return ok(undefined);
    } catch (error) {
      return fail("FRONTMATTER_TEMPLATES_SAVE_FAILED", "フロントマターテンプレートを保存できませんでした。", error instanceof Error ? error.message : String(error));
    }
  });
}

export async function buildWorkspaceState(
  settings: Awaited<ReturnType<typeof readAppSettings>>
): Promise<WorkspaceState> {
  const activeWorkspace =
    settings.workspaces.find((ws) => ws.id === settings.lastWorkspaceId) ?? null;

  if (!activeWorkspace) {
    return toWorkspaceState(settings);
  }

  const [fileTree, wsSettings] = await Promise.all([
    readWorkspaceFileTree(activeWorkspace.path),
    readWorkspaceSettings(app.getPath("userData"), activeWorkspace.id)
  ]);

  return toWorkspaceState(settings, fileTree, wsSettings.pinnedPaths);
}

function isWorkspaceIdInput(input: unknown): input is { workspaceId: string } {
  return (
    typeof input === "object" &&
    input !== null &&
    "workspaceId" in input &&
    typeof (input as { workspaceId?: unknown }).workspaceId === "string"
  );
}

function isSwitchWorkspaceInput(input: unknown): input is SwitchWorkspaceInput {
  return isWorkspaceIdInput(input);
}

function isRenameWorkspaceInput(input: unknown): input is RenameWorkspaceInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "workspaceId" in input &&
    "name" in input &&
    typeof (input as { workspaceId?: unknown }).workspaceId === "string" &&
    typeof (input as { name?: unknown }).name === "string"
  );
}
