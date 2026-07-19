import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  getPath: vi.fn(),
  handle: vi.fn(),
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
}));

const dependencies = vi.hoisted(() => ({
  activateWorkspace: vi.fn(),
  addOrActivateWorkspace: vi.fn(),
  buildWorkspaceState: vi.fn(),
  createWorkspaceSummary: vi.fn(),
  getMainTranslator: vi.fn(),
  invalidateWorkspaceData: vi.fn(),
  mkdir: vi.fn(),
  parsePinnedPaths: vi.fn(),
  prepareWorkspace: vi.fn(),
  readAppSettings: vi.fn(),
  readWorkspaceSettings: vi.fn(),
  removeWorkspaceRegistration: vi.fn(),
  removeWorkspaceSettings: vi.fn(),
  renameWorkspaceRegistration: vi.fn(),
  rm: vi.fn(),
  syncWorkspaceWatcher: vi.fn(),
  updateAppSettings: vi.fn(),
  updateWorkspaceSettings: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getPath: electronMock.getPath },
  dialog: {
    showOpenDialog: electronMock.showOpenDialog,
    showSaveDialog: electronMock.showSaveDialog,
  },
  ipcMain: { handle: electronMock.handle },
}));

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  mkdir: dependencies.mkdir,
  rm: dependencies.rm,
}));

vi.mock("../i18n", async () => {
  const { createTranslator } = await vi.importActual<typeof import("../../shared/i18n")>("../../shared/i18n");
  return {
    getCachedMainLanguage: () => "ja",
    getCachedMainTranslator: () => createTranslator("ja"),
    getMainTranslator: dependencies.getMainTranslator,
  };
});

vi.mock("../files/workspaceDataInvalidation", () => ({
  invalidateWorkspaceData: dependencies.invalidateWorkspaceData,
}));

vi.mock("../settings/appSettings", () => ({
  readAppSettings: dependencies.readAppSettings,
  updateAppSettings: dependencies.updateAppSettings,
}));

vi.mock("../settings/workspaceSettings", () => ({
  parsePinnedPaths: dependencies.parsePinnedPaths,
  readWorkspaceSettings: dependencies.readWorkspaceSettings,
  removeWorkspaceSettings: dependencies.removeWorkspaceSettings,
  updateWorkspaceSettings: dependencies.updateWorkspaceSettings,
}));

vi.mock("../workspace/workspaceService", () => ({
  activateWorkspace: dependencies.activateWorkspace,
  addOrActivateWorkspace: dependencies.addOrActivateWorkspace,
  createWorkspaceSummary: dependencies.createWorkspaceSummary,
  prepareWorkspace: dependencies.prepareWorkspace,
  removeWorkspaceRegistration: dependencies.removeWorkspaceRegistration,
  renameWorkspaceRegistration: dependencies.renameWorkspaceRegistration,
}));

vi.mock("../workspace/workspaceWatcher", () => ({
  syncWorkspaceWatcher: dependencies.syncWorkspaceWatcher,
}));

vi.mock("./activeWorkspace", () => ({
  ipcErrorDetails: (error: unknown) =>
    error instanceof Error ? error.message : "Unknown error",
}));

vi.mock("./workspaceState", () => ({
  buildWorkspaceState: dependencies.buildWorkspaceState,
}));

import {
  createNewWorkspaceChannel,
  getWorkspaceStateChannel,
  openWorkspaceChannel,
  refreshWorkspaceChannel,
  removeWorkspaceChannel,
  renameWorkspaceChannel,
  switchWorkspaceChannel,
  togglePinChannel,
} from "../../shared/ipc";
import { registerWorkspaceRegistrationHandlers } from "./workspaceRegistrationHandlers";

type RegisteredHandler = (...args: unknown[]) => Promise<unknown>;

const workspaceOne = {
  id: "workspace-1",
  name: "One",
  path: "/workspaces/one",
};
const workspaceTwo = {
  id: "workspace-2",
  name: "Two",
  path: "/workspaces/two",
};
const baseSettings = {
  editorSettings: {},
  featureToggles: {},
  frontmatterTemplates: [],
  lastWorkspaceId: workspaceOne.id,
  userDefinedFields: [],
  workspaces: [workspaceOne, workspaceTwo],
};

function stateFor(settings = baseSettings) {
  return {
    activeWorkspace:
      settings.workspaces.find(
        (workspace) => workspace.id === settings.lastWorkspaceId,
      ) ?? null,
    fileIndex: [],
    fileTree: [],
    pinnedPaths: [],
    workspaces: settings.workspaces,
  };
}

function handlerFor(channel: string): RegisteredHandler {
  const registration = electronMock.handle.mock.calls.find(
    ([registeredChannel]) => registeredChannel === channel,
  );

  if (!registration) throw new Error(`Handler is not registered: ${channel}`);
  return registration[1] as RegisteredHandler;
}

describe("registerWorkspaceRegistrationHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.getPath.mockReturnValue("/user-data");
    electronMock.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    electronMock.showSaveDialog.mockResolvedValue({ canceled: true });
    dependencies.getMainTranslator.mockResolvedValue((key: string) => key);
    dependencies.readAppSettings.mockResolvedValue(baseSettings);
    dependencies.updateAppSettings.mockImplementation(
      async (_userDataPath, update) => update(baseSettings),
    );
    dependencies.buildWorkspaceState.mockImplementation(async (settings) =>
      stateFor(settings),
    );
    dependencies.createWorkspaceSummary.mockReturnValue(workspaceTwo);
    dependencies.addOrActivateWorkspace.mockReturnValue({
      ...baseSettings,
      lastWorkspaceId: workspaceTwo.id,
    });
    dependencies.activateWorkspace.mockImplementation((settings, workspaceId) => ({
      ok: true,
      value: { ...settings, lastWorkspaceId: workspaceId },
    }));
    dependencies.removeWorkspaceRegistration.mockImplementation(
      (settings, workspaceId) => ({
        ok: true,
        value: {
          ...settings,
          lastWorkspaceId:
            settings.lastWorkspaceId === workspaceId ? workspaceTwo.id : settings.lastWorkspaceId,
          workspaces: settings.workspaces.filter(
            (workspace: typeof workspaceOne) => workspace.id !== workspaceId,
          ),
        },
      }),
    );
    dependencies.renameWorkspaceRegistration.mockResolvedValue({
      ok: true,
      value: {
        newWorkspaceId: workspaceTwo.id,
        nextSettings: {
          ...baseSettings,
          lastWorkspaceId: workspaceTwo.id,
          workspaces: [workspaceTwo],
        },
        oldWorkspaceId: workspaceOne.id,
      },
    });
    dependencies.parsePinnedPaths.mockImplementation((paths) =>
      paths.filter((value: unknown): value is string => typeof value === "string"),
    );
    dependencies.readWorkspaceSettings.mockResolvedValue({
      pinnedPaths: [],
    });
    dependencies.updateWorkspaceSettings.mockImplementation(
      async (_userDataPath, _workspaceId, update) =>
        update({ pinnedPaths: [] }),
    );
    dependencies.prepareWorkspace.mockResolvedValue(undefined);
    dependencies.mkdir.mockResolvedValue(undefined);
    dependencies.removeWorkspaceSettings.mockResolvedValue(undefined);
    dependencies.rm.mockResolvedValue(undefined);

    registerWorkspaceRegistrationHandlers();
  });

  it("現在の設定から状態を構築し、監視対象を同期する", async () => {
    const result = await handlerFor(getWorkspaceStateChannel)();

    expect(result).toEqual({ ok: true, value: stateFor() });
    expect(dependencies.syncWorkspaceWatcher).toHaveBeenCalledWith(baseSettings);
    expect(dependencies.buildWorkspaceState).toHaveBeenCalledWith(baseSettings);
  });

  it("リフレッシュ中にワークスペースが切り替わった場合は古い状態を返さない", async () => {
    dependencies.readAppSettings
      .mockResolvedValueOnce(baseSettings)
      .mockResolvedValueOnce({ ...baseSettings, lastWorkspaceId: workspaceTwo.id });

    const result = await handlerFor(refreshWorkspaceChannel)({}, { workspaceId: workspaceOne.id });

    expect(dependencies.invalidateWorkspaceData).toHaveBeenCalledWith(workspaceOne.id);
    expect(dependencies.buildWorkspaceState).toHaveBeenCalledWith(baseSettings, { strict: true });
    expect(result).toMatchObject({
      error: { code: "WORKSPACE_REFRESH_STALE" },
      ok: false
    });
    expect(dependencies.syncWorkspaceWatcher).not.toHaveBeenCalled();
  });

  it("同じワークスペースの同時リフレッシュを一つの再同期処理へまとめる", async () => {
    let resolveBuild!: (value: ReturnType<typeof stateFor>) => void;
    dependencies.buildWorkspaceState.mockReturnValueOnce(new Promise((resolve) => {
      resolveBuild = resolve;
    }));

    const first = handlerFor(refreshWorkspaceChannel)({}, { workspaceId: workspaceOne.id });
    const second = handlerFor(refreshWorkspaceChannel)({}, { workspaceId: workspaceOne.id });
    await vi.waitFor(() => expect(dependencies.buildWorkspaceState).toHaveBeenCalledTimes(1));
    resolveBuild(stateFor());

    await expect(first).resolves.toEqual({ ok: true, value: stateFor() });
    await expect(second).resolves.toEqual({ ok: true, value: stateFor() });
    expect(dependencies.invalidateWorkspaceData).toHaveBeenCalledTimes(1);
    expect(dependencies.rm).toHaveBeenCalledTimes(1);
  });

  it("再走査に失敗した場合は監視対象や画面用状態を更新しない", async () => {
    dependencies.buildWorkspaceState.mockRejectedValueOnce(new Error("scan failed"));

    const result = await handlerFor(refreshWorkspaceChannel)({}, { workspaceId: workspaceOne.id });

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_REFRESH_FAILED" },
      ok: false
    });
    expect(dependencies.syncWorkspaceWatcher).not.toHaveBeenCalled();
    expect(dependencies.readAppSettings).toHaveBeenCalledTimes(1);
  });

  it.each([
    { channel: openWorkspaceChannel, dialog: electronMock.showOpenDialog },
    { channel: createNewWorkspaceChannel, dialog: electronMock.showSaveDialog },
  ])("選択ダイアログを取り消した場合は登録を変えず現在状態を返す", async ({ channel, dialog }) => {
    const result = await handlerFor(channel)();

    expect(dialog).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, value: stateFor() });
    expect(dependencies.updateAppSettings).not.toHaveBeenCalled();
    expect(dependencies.prepareWorkspace).not.toHaveBeenCalled();
    expect(dependencies.syncWorkspaceWatcher).toHaveBeenCalledWith(baseSettings);
  });

  it("選択した既存フォルダを準備し、登録・有効化した設定を保存する", async () => {
    electronMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [workspaceTwo.path],
    });

    const result = await handlerFor(openWorkspaceChannel)();

    expect(result).toMatchObject({
      ok: true,
      value: { activeWorkspace: workspaceTwo },
    });
    expect(dependencies.createWorkspaceSummary).toHaveBeenCalledWith(
      workspaceTwo.path,
    );
    expect(dependencies.prepareWorkspace).toHaveBeenCalledWith(workspaceTwo.path);
    expect(dependencies.addOrActivateWorkspace).toHaveBeenCalledWith(
      baseSettings,
      workspaceTwo,
    );
    expect(dependencies.syncWorkspaceWatcher).toHaveBeenCalledWith(
      expect.objectContaining({ lastWorkspaceId: workspaceTwo.id }),
    );
  });

  it("新規フォルダを作成してから登録・有効化する", async () => {
    electronMock.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: workspaceTwo.path,
    });

    const result = await handlerFor(createNewWorkspaceChannel)();

    expect(result).toMatchObject({
      ok: true,
      value: { activeWorkspace: workspaceTwo },
    });
    expect(dependencies.mkdir).toHaveBeenCalledWith(workspaceTwo.path, {
      recursive: true,
    });
    expect(dependencies.prepareWorkspace).toHaveBeenCalledWith(workspaceTwo.path);
    expect(dependencies.updateAppSettings).toHaveBeenCalledOnce();
  });

  it.each([
    { channel: switchWorkspaceChannel, input: {}, operation: "switch" },
    { channel: removeWorkspaceChannel, input: {}, operation: "remove" },
    {
      channel: renameWorkspaceChannel,
      input: { name: null, workspaceId: workspaceOne.id },
      operation: "rename",
    },
  ])("危険または不足した入力を設定読取前に拒否する: $operation", async ({ channel, input }) => {
    const result = await handlerFor(channel)({}, input);

    expect(result).toMatchObject({ ok: false });
    expect(dependencies.readAppSettings).not.toHaveBeenCalled();
    expect(dependencies.updateAppSettings).not.toHaveBeenCalled();
    expect(dependencies.prepareWorkspace).not.toHaveBeenCalled();
  });

  it("不正なピン留めパスを設定読取前に拒否する", async () => {
    dependencies.parsePinnedPaths.mockReturnValueOnce([]);

    const result = await handlerFor(togglePinChannel)({}, "../outside.md");

    expect(result).toMatchObject({
      error: { code: "TOGGLE_PIN_INVALID_INPUT" },
      ok: false,
    });
    expect(dependencies.readAppSettings).not.toHaveBeenCalled();
    expect(dependencies.updateWorkspaceSettings).not.toHaveBeenCalled();
  });

  it("アクティブな登録がない場合はピン留め設定を変更しない", async () => {
    dependencies.readAppSettings.mockResolvedValueOnce({
      ...baseSettings,
      lastWorkspaceId: null,
    });

    const result = await handlerFor(togglePinChannel)({}, "note.md");

    expect(result).toMatchObject({
      error: { code: "TOGGLE_PIN_NO_WORKSPACE" },
      ok: false,
    });
    expect(dependencies.updateWorkspaceSettings).not.toHaveBeenCalled();
  });

  it.each([
    { current: [] as string[], expected: ["note.md"], label: "追加" },
    { current: ["note.md"], expected: [] as string[], label: "解除" },
  ])("ピン留めを$labelし、保存後の状態を返す", async ({ current, expected }) => {
    dependencies.readWorkspaceSettings.mockResolvedValueOnce({
      pinnedPaths: current,
    });
    dependencies.updateWorkspaceSettings.mockImplementationOnce(
      async (_userDataPath, _workspaceId, update) =>
        update({ pinnedPaths: current }),
    );

    const result = await handlerFor(togglePinChannel)({}, "note.md");

    expect(result).toMatchObject({ ok: true });
    expect(dependencies.updateWorkspaceSettings).toHaveBeenCalledWith(
      "/user-data",
      workspaceOne.id,
      expect.any(Function),
    );
    const update = dependencies.updateWorkspaceSettings.mock.calls[0][2];
    expect(update({ pinnedPaths: current })).toMatchObject({
      pinnedPaths: expected,
    });
  });

  it.each([
    { channel: switchWorkspaceChannel, operation: dependencies.activateWorkspace },
    {
      channel: removeWorkspaceChannel,
      operation: dependencies.removeWorkspaceRegistration,
    },
    {
      channel: renameWorkspaceChannel,
      operation: dependencies.renameWorkspaceRegistration,
    },
  ])("登録操作のdomain失敗をそのまま返し、設定を保存しない", async ({ channel, operation }) => {
    operation.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "WORKSPACE_NOT_FOUND",
        message: "登録済みワークスペースが見つかりませんでした。",
      },
    });
    const input =
      channel === renameWorkspaceChannel
        ? { name: "Renamed", workspaceId: "missing" }
        : { workspaceId: "missing" };

    const result = await handlerFor(channel)({}, input);

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_NOT_FOUND" },
      ok: false,
    });
    expect(dependencies.updateAppSettings).not.toHaveBeenCalled();
    expect(dependencies.syncWorkspaceWatcher).not.toHaveBeenCalled();
  });

  it("切替先を準備し、保存後に監視対象と状態を更新する", async () => {
    const result = await handlerFor(switchWorkspaceChannel)({}, {
      workspaceId: workspaceTwo.id,
    });

    expect(result).toMatchObject({
      ok: true,
      value: { activeWorkspace: workspaceTwo },
    });
    expect(dependencies.prepareWorkspace).toHaveBeenCalledWith(workspaceTwo.path);
    expect(dependencies.updateAppSettings).toHaveBeenCalledOnce();
    expect(dependencies.syncWorkspaceWatcher).toHaveBeenCalledWith(
      expect.objectContaining({ lastWorkspaceId: workspaceTwo.id }),
    );
  });

  it("削除が成功した場合だけ登録設定と監視対象を更新する", async () => {
    const result = await handlerFor(removeWorkspaceChannel)({}, {
      workspaceId: workspaceOne.id,
    });

    expect(result).toMatchObject({
      ok: true,
      value: { activeWorkspace: workspaceTwo, workspaces: [workspaceTwo] },
    });
    expect(dependencies.updateAppSettings).toHaveBeenCalledOnce();
    expect(dependencies.syncWorkspaceWatcher).toHaveBeenCalledOnce();
  });

  it("IDが変わるrenameではワークスペース設定を移行してから旧設定を削除する", async () => {
    const migratedSettings = { pinnedPaths: ["note.md"] };
    dependencies.readWorkspaceSettings.mockResolvedValueOnce(migratedSettings);

    const result = await handlerFor(renameWorkspaceChannel)({}, {
      name: "Two",
      workspaceId: workspaceOne.id,
    });

    expect(result).toMatchObject({ ok: true });
    expect(dependencies.updateWorkspaceSettings).toHaveBeenCalledWith(
      "/user-data",
      workspaceTwo.id,
      expect.any(Function),
    );
    const migrate = dependencies.updateWorkspaceSettings.mock.calls[0][2];
    expect(migrate({ pinnedPaths: [] })).toBe(migratedSettings);
    expect(dependencies.removeWorkspaceSettings).toHaveBeenCalledWith(
      "/user-data",
      workspaceOne.id,
    );
  });

  it("IDが変わらないrenameでは設定移行を行わない", async () => {
    dependencies.renameWorkspaceRegistration.mockResolvedValueOnce({
      ok: true,
      value: {
        newWorkspaceId: workspaceOne.id,
        nextSettings: baseSettings,
        oldWorkspaceId: workspaceOne.id,
      },
    });

    const result = await handlerFor(renameWorkspaceChannel)({}, {
      name: workspaceOne.name,
      workspaceId: workspaceOne.id,
    });

    expect(result).toMatchObject({ ok: true });
    expect(dependencies.readWorkspaceSettings).not.toHaveBeenCalled();
    expect(dependencies.updateWorkspaceSettings).not.toHaveBeenCalled();
    expect(dependencies.removeWorkspaceSettings).not.toHaveBeenCalled();
  });

  it.each([
    {
      channel: getWorkspaceStateChannel,
      code: "WORKSPACE_STATE_FAILED",
      fail: () => dependencies.readAppSettings.mockRejectedValueOnce(new Error("read failed")),
      input: [] as unknown[],
    },
    {
      channel: openWorkspaceChannel,
      code: "WORKSPACE_OPEN_FAILED",
      fail: () => dependencies.prepareWorkspace.mockRejectedValueOnce(new Error("open failed")),
      input: [] as unknown[],
      select: () => electronMock.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [workspaceTwo.path] }),
    },
    {
      channel: createNewWorkspaceChannel,
      code: "WORKSPACE_CREATE_FAILED",
      fail: () => dependencies.mkdir.mockRejectedValueOnce(new Error("create failed")),
      input: [] as unknown[],
      select: () => electronMock.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: workspaceTwo.path }),
    },
    {
      channel: switchWorkspaceChannel,
      code: "WORKSPACE_SWITCH_FAILED",
      fail: () => dependencies.prepareWorkspace.mockRejectedValueOnce(new Error("switch failed")),
      input: [{}, { workspaceId: workspaceTwo.id }],
    },
    {
      channel: removeWorkspaceChannel,
      code: "WORKSPACE_REMOVE_FAILED",
      fail: () => dependencies.updateAppSettings.mockRejectedValueOnce(new Error("remove failed")),
      input: [{}, { workspaceId: workspaceOne.id }],
    },
    {
      channel: renameWorkspaceChannel,
      code: "WORKSPACE_RENAME_FAILED",
      fail: () => dependencies.renameWorkspaceRegistration.mockRejectedValueOnce(new Error("rename failed")),
      input: [{}, { name: "Renamed", workspaceId: workspaceOne.id }],
    },
  ])("予期しない例外を操作固有のIPCエラーへ変換する: $code", async ({ channel, code, fail, input, select }) => {
    select?.();
    fail();

    const result = await handlerFor(channel)(...input);

    expect(result).toMatchObject({ error: { code }, ok: false });
  });
});
