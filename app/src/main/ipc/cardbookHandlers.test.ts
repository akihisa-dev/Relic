import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  getAllWindows: vi.fn().mockReturnValue([]),
  getPath: vi.fn(),
  handle: vi.fn(),
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn()
}));

vi.mock("electron", () => ({
  app: { getPath: electronMock.getPath },
  BrowserWindow: { getAllWindows: electronMock.getAllWindows },
  dialog: {
    showOpenDialog: electronMock.showOpenDialog,
    showSaveDialog: electronMock.showSaveDialog
  },
  ipcMain: { handle: electronMock.handle }
}));

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields,
  getCardbookStateChannel
} from "../../shared/ipc";
import { writeAppSettings } from "../settings/appSettings";
import { defaultTimelineCharts, writeCardbookSettings } from "../settings/cardbookSettings";
import { addOrActivateCardbook, createCardbookSummary } from "../cardbook/cardbookService";
import { registerCardbookHandlers } from "./cardbookHandlers";

describe("cardbookHandlers", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    vi.clearAllMocks();
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("起動時のカードブック状態でアクティブカードブックのカードツリーを復元する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-cardbook-"));
    temporaryPaths.push(userDataPath, cardbookPath);

    await writeFile(path.join(cardbookPath, "読書メモ.md"), "# 読書メモ\n", "utf8");
    await mkdir(path.join(cardbookPath, "資料"));
    await writeFile(path.join(cardbookPath, "資料", "保管メモ.md"), "# 保管メモ\n", "utf8");

    const cardbook = createCardbookSummary(cardbookPath);
    const settings = addOrActivateCardbook(
      {
        editorSettings: defaultEditorSettings,
        featureToggles: defaultFeatureToggles,
        frontmatterTemplates: defaultFrontmatterTemplates,
        lastCardbookId: null,
        userDefinedFields: defaultUserDefinedFields,
        cardbooks: []
      },
      cardbook
    );
    await writeAppSettings(userDataPath, settings);
    await writeCardbookSettings(userDataPath, cardbook.id, {
      timelineCharts: defaultTimelineCharts,
      pinnedPaths: ["読書メモ.md"],
      cardbookPath
    });

    electronMock.getPath.mockReturnValue(userDataPath);
    registerCardbookHandlers();
    const getCardbookStateHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === getCardbookStateChannel
    )?.[1];

    if (!getCardbookStateHandler) throw new Error("getCardbookState handler was not registered");

    const result = await getCardbookStateHandler();

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        activeCardbook: cardbook,
        pinnedPaths: ["読書メモ.md"],
        cardbooks: [cardbook]
      })
    });
    expect(result.ok ? result.value.cardTree : []).toEqual([
      {
        children: [
          { name: "保管メモ", path: "資料/保管メモ.md", type: "card" }
        ],
        name: "資料",
        path: "資料",
        type: "cardFolder"
      },
      { name: "読書メモ", path: "読書メモ.md", type: "card" }
    ]);
  });
});
