import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  getPath: vi.fn(),
  handle: vi.fn(),
}));

const settingsMock = vi.hoisted(() => ({
  readAppSettings: vi.fn(),
  updateAppSettings: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getPath: electronMock.getPath },
  ipcMain: { handle: electronMock.handle },
}));

vi.mock("../settings/appSettings", () => ({
  readAppSettings: settingsMock.readAppSettings,
  updateAppSettings: settingsMock.updateAppSettings,
}));

vi.mock("./activeWorkspace", () => ({
  ipcErrorDetails: (error: unknown) =>
    error instanceof Error ? error.message : "Unknown error",
}));

import {
  getFrontmatterTemplatesChannel,
  getUserDefinedFieldsChannel,
  saveFrontmatterTemplatesChannel,
  saveUserDefinedFieldsChannel,
} from "../../shared/ipc";
import { runWorkspaceRegistrationTask } from "../workspace/workspaceRegistrationGate";
import { registerWorkspacePreferenceHandlers } from "./workspacePreferenceHandlers";

type RegisteredHandler = (...args: unknown[]) => Promise<unknown>;

const userDefinedFields = [
  { choices: ["high", "low"], name: "priority", type: "select" as const },
];
const frontmatterTemplates = [
  { fieldNames: ["priority"], name: "Task" },
];
const baseSettings = {
  editorSettings: {},
  frontmatterTemplates,
  lastWorkspaceId: null,
  userDefinedFields,
  workspaces: [],
};

function handlerFor(channel: string): RegisteredHandler {
  const registration = electronMock.handle.mock.calls.find(
    ([registeredChannel]) => registeredChannel === channel,
  );

  if (!registration) throw new Error(`Handler is not registered: ${channel}`);
  return registration[1] as RegisteredHandler;
}

describe("registerWorkspacePreferenceHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.getPath.mockReturnValue("/user-data");
    settingsMock.readAppSettings.mockResolvedValue(baseSettings);
    settingsMock.updateAppSettings.mockImplementation(
      async (_userDataPath, update) => update(baseSettings),
    );
    registerWorkspacePreferenceHandlers();
  });

  it.each([
    {
      channel: getUserDefinedFieldsChannel,
      label: "カスタムフィールド",
      value: userDefinedFields,
    },
    {
      channel: getFrontmatterTemplatesChannel,
      label: "フロントマターテンプレート",
      value: frontmatterTemplates,
    },
  ])("保存済みの$labelを返す", async ({ channel, value }) => {
    const result = await handlerFor(channel)();

    expect(result).toEqual({ ok: true, value });
    expect(settingsMock.readAppSettings).toHaveBeenCalledWith("/user-data");
  });

  it.each([
    {
      channel: saveUserDefinedFieldsChannel,
      input: [{ name: "priority", type: "unknown" }],
      label: "未知の型を持つカスタムフィールド",
    },
    {
      channel: saveFrontmatterTemplatesChannel,
      input: [{ fieldNames: [], name: "Empty" }],
      label: "項目のないテンプレート",
    },
  ])("$labelを設定更新前に拒否する", async ({ channel, input }) => {
    const result = await handlerFor(channel)({}, input);

    expect(result).toMatchObject({ ok: false });
    expect(settingsMock.updateAppSettings).not.toHaveBeenCalled();
  });

  it.each([
    {
      channel: saveUserDefinedFieldsChannel,
      input: userDefinedFields,
      key: "userDefinedFields",
      label: "カスタムフィールド",
    },
    {
      channel: saveFrontmatterTemplatesChannel,
      input: frontmatterTemplates,
      key: "frontmatterTemplates",
      label: "フロントマターテンプレート",
    },
  ])("有効な$labelだけを置き換えて保存する", async ({ channel, input, key }) => {
    const result = await handlerFor(channel)({}, input);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(settingsMock.updateAppSettings).toHaveBeenCalledWith(
      "/user-data",
      expect.any(Function),
    );
    const update = settingsMock.updateAppSettings.mock.calls[0][1];
    const updated = await update(baseSettings);
    expect(updated).toEqual({ ...baseSettings, [key]: input });
  });

  it("登録gate保持中のアプリ設定保存は解放後に実行する", async () => {
    let release!: () => void;
    const hold = runWorkspaceRegistrationTask(() => new Promise<void>((resolve) => {
      release = resolve;
    }));
    const save = handlerFor(saveUserDefinedFieldsChannel)({}, userDefinedFields);

    await Promise.resolve();
    expect(settingsMock.updateAppSettings).not.toHaveBeenCalled();
    release();

    await expect(hold).resolves.toBeUndefined();
    await expect(save).resolves.toEqual({ ok: true, value: undefined });
    expect(settingsMock.updateAppSettings).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      channel: getUserDefinedFieldsChannel,
      code: "USER_DEFINED_FIELDS_READ_FAILED",
    },
    {
      channel: getFrontmatterTemplatesChannel,
      code: "FRONTMATTER_TEMPLATES_READ_FAILED",
    },
  ])("設定読取例外を操作固有のエラーへ変換する: $code", async ({ channel, code }) => {
    settingsMock.readAppSettings.mockRejectedValueOnce(
      new Error("settings read unavailable"),
    );

    const result = await handlerFor(channel)();

    expect(result).toMatchObject({
      error: { code, details: "settings read unavailable" },
      ok: false,
    });
  });

  it.each([
    {
      channel: saveUserDefinedFieldsChannel,
      code: "USER_DEFINED_FIELDS_SAVE_FAILED",
      input: userDefinedFields,
    },
    {
      channel: saveFrontmatterTemplatesChannel,
      code: "FRONTMATTER_TEMPLATES_SAVE_FAILED",
      input: frontmatterTemplates,
    },
  ])("設定保存例外を操作固有のエラーへ変換する: $code", async ({ channel, code, input }) => {
    settingsMock.updateAppSettings.mockRejectedValueOnce(
      new Error("settings write unavailable"),
    );

    const result = await handlerFor(channel)({}, input);

    expect(result).toMatchObject({
      error: { code, details: "settings write unavailable" },
      ok: false,
    });
  });
});
