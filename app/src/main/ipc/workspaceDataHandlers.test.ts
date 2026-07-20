import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  handle: vi.fn(),
}));

const dependencies = vi.hoisted(() => ({
  getActiveWorkspaceContext: vi.fn(),
  invalidateWorkspaceData: vi.fn(),
  normalizeWorkspaceRelativeSettingPath: vi.fn(
    (path: string): string | null => path,
  ),
  providerGet: vi.fn(),
  readWorkspaceAliases: vi.fn(),
  readWorkspaceCharts: vi.fn(),
  readWorkspaceCards: vi.fn(),
  readWorkspaceGraph: vi.fn(),
  readWorkspaceTable: vi.fn(),
  readWorkspaceSettings: vi.fn(),
  readWorkspaceTags: vi.fn(),
  readFrontmatterValueCandidates: vi.fn(),
  updateWorkspaceChartEntry: vi.fn(),
  updateWorkspaceSettings: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: electronMock.handle,
  },
}));

vi.mock("./activeWorkspace", () => ({
  getActiveWorkspaceContext: dependencies.getActiveWorkspaceContext,
  ipcErrorDetails: (error: unknown) =>
    error instanceof Error ? error.message : "Unknown error",
}));

vi.mock("../files/workspaceDataInvalidation", () => ({
  invalidateWorkspaceData: dependencies.invalidateWorkspaceData,
}));

vi.mock("../files/workspaceDataProvider", () => ({
  workspaceDataProvider: {
    get: dependencies.providerGet,
  },
}));

vi.mock("../files/tags", () => ({
  readWorkspaceTags: dependencies.readWorkspaceTags,
}));

vi.mock("../files/frontmatterCandidates", () => ({
  readFrontmatterValueCandidates: dependencies.readFrontmatterValueCandidates,
}));

vi.mock("../files/aliases", () => ({
  readWorkspaceAliases: dependencies.readWorkspaceAliases,
}));

vi.mock("../files/workspaceGraph", () => ({
  readWorkspaceGraph: dependencies.readWorkspaceGraph,
}));

vi.mock("../files/charts", () => ({
  readWorkspaceCharts: dependencies.readWorkspaceCharts,
  updateWorkspaceChartEntry: dependencies.updateWorkspaceChartEntry,
}));

vi.mock("../files/cards", () => ({
  readWorkspaceCards: dependencies.readWorkspaceCards,
}));

vi.mock("../files/workspaceTable", () => ({
  readWorkspaceTable: dependencies.readWorkspaceTable,
}));

vi.mock("../settings/workspaceSettings", () => ({
  normalizeWorkspaceRelativeSettingPath:
    dependencies.normalizeWorkspaceRelativeSettingPath,
  readWorkspaceSettings: dependencies.readWorkspaceSettings,
  updateWorkspaceSettings: dependencies.updateWorkspaceSettings,
}));

import {
  getFrontmatterValueCandidatesChannel,
  getWorkspaceAliasesChannel,
  getWorkspaceChartsChannel,
  getWorkspaceCardsChannel,
  getWorkspaceChronicleCalendarSettingsChannel,
  getWorkspaceFrontmatterCategoryChoicesChannel,
  getWorkspaceGraphChannel,
  getWorkspaceTableChannel,
  getWorkspaceTagsChannel,
  saveWorkspaceChartsChannel,
  saveWorkspaceChronicleCalendarSettingsChannel,
  saveWorkspaceFrontmatterCategoryChoicesChannel,
  saveWorkspaceTablePreferencesChannel,
  updateChartEntryChannel,
} from "../../shared/ipc";
import { registerWorkspaceDataHandlers } from "./workspaceDataHandlers";
import { setMainTranslator } from "../i18n";

type RegisteredHandler = (...args: unknown[]) => Promise<unknown>;

const workspace = {
  id: "workspace-1",
  name: "Notes",
  path: "/workspace",
};

const workspaceSettings = {
  charts: [
    {
      id: "chronicle",
      name: "Chronicle",
      source: "chronicle" as const,
    },
  ],
  chronicleCalendarSettings: {
    baseCalendarName: "基準暦",
    calendars: [{ name: "別暦", range: null, yearOne: 450 }],
    visibleCalendarNames: ["基準暦", "別暦"]
  },
  frontmatterCategoryChoices: ["人物"],
  tablePreferences: {
    columnWidths: [],
    fileColumnWidth: 260,
    filters: [],
    selectedProperties: ["status", "removed"],
    sort: { direction: "asc" as const, property: null },
    wrappedProperties: []
  },
};

const providerOptions = {
  cachePath: "/cache/workspace-index.json",
  fileIndex: { version: 1 },
  parseCache: new Map(),
};

function handlerFor(channel: string): RegisteredHandler {
  const registration = electronMock.handle.mock.calls.find(
    ([registeredChannel]) => registeredChannel === channel,
  );

  if (!registration) {
    throw new Error(`Handler is not registered: ${channel}`);
  }

  return registration[1] as RegisteredHandler;
}

describe("registerWorkspaceDataHandlers", () => {
  beforeEach(() => {
    setMainTranslator("ja", "ja");
    vi.clearAllMocks();
    dependencies.normalizeWorkspaceRelativeSettingPath.mockImplementation(
      (path: string): string | null => path,
    );
    dependencies.getActiveWorkspaceContext.mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: workspace,
        settings: { activeWorkspaceId: workspace.id },
        userDataPath: "/user-data",
      },
    });
    dependencies.providerGet.mockResolvedValue({
      options: providerOptions,
      workspacePath: workspace.path,
    });
    dependencies.readWorkspaceSettings.mockResolvedValue(workspaceSettings);
    dependencies.updateWorkspaceSettings.mockImplementation(
      async (_userDataPath, _workspaceId, update) => update(workspaceSettings),
    );
    dependencies.readWorkspaceTags.mockResolvedValue({ ok: true, value: [] });
    dependencies.readFrontmatterValueCandidates.mockResolvedValue({
      ok: true,
      value: {},
    });
    dependencies.readWorkspaceAliases.mockResolvedValue({
      ok: true,
      value: {},
    });
    dependencies.readWorkspaceGraph.mockResolvedValue({
      ok: true,
      value: { edges: [], nodes: [] },
    });
    dependencies.readWorkspaceCharts.mockResolvedValue({ ok: true, value: [] });
    dependencies.readWorkspaceCards.mockResolvedValue({ ok: true, value: [] });
    dependencies.readWorkspaceTable.mockResolvedValue({
      ok: true,
      value: { availableProperties: [], preferences: workspaceSettings.tablePreferences, rows: [] },
    });
    dependencies.updateWorkspaceChartEntry.mockResolvedValue({
      ok: true,
      value: [],
    });

    registerWorkspaceDataHandlers();
  });

  it.each([
    {
      channel: getWorkspaceTagsChannel,
      label: "タグ",
      reader: dependencies.readWorkspaceTags,
      value: ["project", "review"],
    },
    {
      channel: getFrontmatterValueCandidatesChannel,
      label: "フロントマター候補",
      reader: dependencies.readFrontmatterValueCandidates,
      value: { status: ["draft", "published"] },
    },
    {
      channel: getWorkspaceAliasesChannel,
      label: "エイリアス",
      reader: dependencies.readWorkspaceAliases,
      value: { Home: ["index.md"] },
    },
    {
      channel: getWorkspaceCardsChannel,
      label: "カード",
      reader: dependencies.readWorkspaceCards,
      value: [{ flavorText: null, imagePath: "images/card.webp", name: "Card", path: "card.md" }],
    },
    {
      channel: getWorkspaceGraphChannel,
      label: "グラフ",
      reader: dependencies.readWorkspaceGraph,
      value: { edges: [], nodes: [{ id: "index.md" }] },
    },
  ])(
    "$label の読取で同じprovider snapshotを派生データreaderへ渡す",
    async ({ channel, reader, value }) => {
      reader.mockResolvedValueOnce({ ok: true, value });

      const result = await handlerFor(channel)();

      expect(result).toEqual({ ok: true, value });
      expect(dependencies.providerGet).toHaveBeenCalledWith({
        userDataPath: "/user-data",
        workspaceId: workspace.id,
        workspacePath: workspace.path,
      });
      expect(reader).toHaveBeenCalledWith(workspace.path, providerOptions);
    },
  );

  it("provider取得に失敗した場合は派生データreaderを呼ばずIPCエラーを返す", async () => {
    dependencies.providerGet.mockRejectedValueOnce(
      new Error("workspace snapshot unavailable"),
    );

    const result = await handlerFor(getWorkspaceGraphChannel)();

    expect(result).toEqual({
      ok: false,
      error: {
        code: "WORKSPACE_GRAPH_FAILED",
        details: "workspace snapshot unavailable",
        message: "グラフを読み込めませんでした。",
      },
    });
    expect(dependencies.readWorkspaceGraph).not.toHaveBeenCalled();
  });

  it("チャート読取で保存設定とprovider snapshotを組み合わせる", async () => {
    const charts = [{ id: "chronicle", rows: [] }];
    dependencies.readWorkspaceCharts.mockResolvedValueOnce({
      ok: true,
      value: charts,
    });

    const result = await handlerFor(getWorkspaceChartsChannel)();

    expect(result).toEqual({ ok: true, value: charts });
    expect(dependencies.readWorkspaceSettings).toHaveBeenCalledWith(
      "/user-data",
      workspace.id,
    );
    expect(dependencies.readWorkspaceCharts).toHaveBeenCalledWith(
      workspace.path,
      workspaceSettings.charts,
      workspaceSettings.chronicleCalendarSettings,
      providerOptions,
    );
  });

  it("テーブル読取で保存列と共有snapshotを使い、消滅した列を設定から外す", async () => {
    const table = {
      availableProperties: ["status"],
      rows: [],
      preferences: { ...workspaceSettings.tablePreferences, selectedProperties: ["status"] },
    };
    dependencies.readWorkspaceTable.mockResolvedValueOnce({ ok: true, value: table });

    const result = await handlerFor(getWorkspaceTableChannel)();

    expect(result).toEqual({ ok: true, value: table });
    expect(dependencies.readWorkspaceTable).toHaveBeenCalledWith(
      workspace.path,
      workspaceSettings.tablePreferences,
      providerOptions,
    );
    expect(dependencies.updateWorkspaceSettings).toHaveBeenCalledWith(
      "/user-data",
      workspace.id,
      expect.any(Function),
    );
  });

  it.each([
    {
      channel: getWorkspaceFrontmatterCategoryChoicesChannel,
      label: "カテゴリ候補",
      value: workspaceSettings.frontmatterCategoryChoices,
    },
    {
      channel: getWorkspaceChronicleCalendarSettingsChannel,
      label: "暦面設定",
      value: workspaceSettings.chronicleCalendarSettings,
    },
  ])("$label の読取はワークスペース設定の対応値だけを返す", async ({ channel, value }) => {
    const result = await handlerFor(channel)();

    expect(result).toEqual({ ok: true, value });
    expect(dependencies.readWorkspaceSettings).toHaveBeenCalledWith(
      "/user-data",
      workspace.id,
    );
    expect(dependencies.providerGet).not.toHaveBeenCalled();
  });

  it.each([
    {
      channel: saveWorkspaceChartsChannel,
      input: [],
      label: "空のチャート設定",
    },
    {
      channel: saveWorkspaceFrontmatterCategoryChoicesChannel,
      input: ["人物", "人物"],
      label: "重複したカテゴリ候補",
    },
    {
      channel: saveWorkspaceChronicleCalendarSettingsChannel,
      input: {
        baseCalendarName: "基準暦",
        calendars: [{ name: "別暦", range: { end: 1, start: 10 }, yearOne: 450 }],
        visibleCalendarNames: ["基準暦", "別暦"]
      },
      label: "逆転した暦面範囲",
    },
    {
      channel: updateChartEntryChannel,
      input: {},
      label: "項目を欠いたチャート更新",
    },
    {
      channel: saveWorkspaceTablePreferencesChannel,
      input: { ...workspaceSettings.tablePreferences, fileColumnWidth: 20 },
      label: "不正なテーブル表示設定",
    },
  ])("$label は状態を読む前に拒否する", async ({ channel, input }) => {
    const result = await handlerFor(channel)({}, input);

    expect(result).toMatchObject({ ok: false });
    expect(dependencies.getActiveWorkspaceContext).not.toHaveBeenCalled();
    expect(dependencies.updateWorkspaceSettings).not.toHaveBeenCalled();
    expect(dependencies.updateWorkspaceChartEntry).not.toHaveBeenCalled();
    expect(dependencies.providerGet).not.toHaveBeenCalled();
    expect(dependencies.invalidateWorkspaceData).not.toHaveBeenCalled();
  });

  it("チャート設定を正規化して保存し、その設定で派生チャートを読み直す", async () => {
    dependencies.normalizeWorkspaceRelativeSettingPath.mockImplementation(
      (path: string) => (path === "removed.md" ? null : path),
    );
    const input = [
      {
        filePaths: ["events/launch.md", "removed.md"],
        id: " chronicle ",
        name: " Chronicle ",
        source: "chronicle" as const,
      },
    ];
    const savedCharts = [
      {
        filePaths: ["events/launch.md"],
        id: "chronicle",
        name: "Chronicle",
        source: "chronicle" as const,
      },
    ];
    const derivedCharts = [{ id: "chronicle", rows: [] }];
    dependencies.readWorkspaceCharts.mockResolvedValueOnce({
      ok: true,
      value: derivedCharts,
    });

    const result = await handlerFor(saveWorkspaceChartsChannel)({}, input);

    expect(result).toEqual({ ok: true, value: derivedCharts });
    expect(dependencies.updateWorkspaceSettings).toHaveBeenCalledWith(
      "/user-data",
      workspace.id,
      expect.any(Function),
    );
    expect(dependencies.readWorkspaceCharts).toHaveBeenCalledWith(
      workspace.path,
      savedCharts,
      workspaceSettings.chronicleCalendarSettings,
      providerOptions,
    );
  });

  it("カテゴリ候補を保存し、設定層から確定した値を返す", async () => {
    const choices = ["人物", "場所"];

    const result = await handlerFor(
      saveWorkspaceFrontmatterCategoryChoicesChannel,
    )({}, choices);

    expect(result).toEqual({ ok: true, value: choices });
    expect(dependencies.updateWorkspaceSettings).toHaveBeenCalledWith(
      "/user-data",
      workspace.id,
      expect.any(Function),
    );
    expect(dependencies.invalidateWorkspaceData).not.toHaveBeenCalled();
  });

  it("有効な暦面範囲だけをワークスペース設定へ保存する", async () => {
    const input = {
      baseCalendarName: "基準暦",
      calendars: [{ name: "別暦", range: { end: 100, start: -10 }, yearOne: 450 }],
      visibleCalendarNames: ["基準暦", "別暦"]
    };
    dependencies.updateWorkspaceSettings.mockImplementationOnce(
      async (_userDataPath, _workspaceId, update) => update(workspaceSettings)
    );

    const result = await handlerFor(saveWorkspaceChronicleCalendarSettingsChannel)({}, input);

    expect(result).toEqual({ ok: true, value: input });
    expect(dependencies.updateWorkspaceSettings).toHaveBeenCalledWith(
      "/user-data",
      workspace.id,
      expect.any(Function)
    );
  });

  it("テーブル表示設定をワークスペース設定へ保存する", async () => {
    const preferences = {
      ...workspaceSettings.tablePreferences,
      filters: [{ operator: "missing" as const, property: "tags", target: "property" as const }],
      selectedProperties: ["status", "tags"]
    };

    const result = await handlerFor(saveWorkspaceTablePreferencesChannel)({}, preferences);

    expect(result).toEqual({ ok: true, value: preferences });
    expect(dependencies.updateWorkspaceSettings).toHaveBeenCalledWith(
      "/user-data",
      workspace.id,
      expect.any(Function),
    );
  });

  it("チャート項目更新が成功した時だけ派生データを無効化する", async () => {
    const input = {
      chronicleEntryIndex: 0,
      endValue: 3,
      kind: "move" as const,
      originalEndValue: 2,
      originalStartValue: 1,
      path: "events/launch.md",
      source: "chronicle" as const,
      startValue: 2,
    };
    const updatedCharts = [
      {
        id: "chronicle",
        name: "Chronicle",
        source: "chronicle" as const,
      },
    ];
    dependencies.updateWorkspaceChartEntry.mockResolvedValueOnce({
      ok: true,
      value: updatedCharts,
    });

    const successResult = await handlerFor(updateChartEntryChannel)(
      {},
      input,
    );

    expect(successResult).toEqual({ ok: true, value: updatedCharts });
    expect(dependencies.updateWorkspaceChartEntry).toHaveBeenCalledWith(
      workspace.path,
      workspaceSettings.charts,
      workspaceSettings.chronicleCalendarSettings,
      input,
    );
    expect(dependencies.invalidateWorkspaceData).toHaveBeenCalledWith(
      workspace.id,
    );

    dependencies.invalidateWorkspaceData.mockClear();
    dependencies.updateWorkspaceChartEntry.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "CHART_ENTRY_UPDATE_FAILED",
        message: "チャート項目を更新できませんでした。",
      },
    });

    const failureResult = await handlerFor(updateChartEntryChannel)(
      {},
      input,
    );

    expect(failureResult).toMatchObject({ ok: false });
    expect(dependencies.invalidateWorkspaceData).not.toHaveBeenCalled();
  });
});
