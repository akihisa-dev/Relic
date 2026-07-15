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
  defaultFeatureToggles,
  getFeatureTogglesChannel,
  getFrontmatterTemplatesChannel,
  getUserDefinedFieldsChannel,
  saveFeatureTogglesChannel,
  saveFrontmatterTemplatesChannel,
  saveUserDefinedFieldsChannel,
} from "../../shared/ipc";
import { registerWorkspacePreferenceHandlers } from "./workspacePreferenceHandlers";

type RegisteredHandler = (...args: unknown[]) => Promise<unknown>;

const featureToggles = {
  chronicle: true,
  chronicleSettings: true,
  frontmatter: true,
  graph: true,
  rightPanelLinks: false,
  rightPanelOutline: true,
  tools: true,
};
const userDefinedFields = [
  { choices: ["high", "low"], name: "priority", type: "select" as const },
];
const frontmatterTemplates = [
  { fieldNames: ["priority"], name: "Task" },
];
const baseSettings = {
  editorSettings: {},
  featureToggles,
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
      channel: getFeatureTogglesChannel,
      label: "機能トグル",
      value: featureToggles,
    },
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

  it("古い設定に機能トグルがない場合は安全な既定値を返す", async () => {
    settingsMock.readAppSettings.mockResolvedValueOnce({
      ...baseSettings,
      featureToggles: undefined,
    });

    const result = await handlerFor(getFeatureTogglesChannel)();

    expect(result).toEqual({ ok: true, value: defaultFeatureToggles });
  });

  it.each([
    {
      channel: saveFeatureTogglesChannel,
      input: { chronicle: true },
      label: "項目を欠いた機能トグル",
    },
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
      channel: saveFeatureTogglesChannel,
      input: featureToggles,
      key: "featureToggles",
      label: "機能トグル",
    },
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

  it.each([
    {
      channel: getFeatureTogglesChannel,
      code: "FEATURE_TOGGLES_READ_FAILED",
    },
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
      channel: saveFeatureTogglesChannel,
      code: "FEATURE_TOGGLES_SAVE_FAILED",
      input: featureToggles,
    },
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
