import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn()
}));

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: electronMock.exposeInMainWorld
  },
  ipcRenderer: {
    invoke: electronMock.invoke,
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn()
  }
}));

import {
  copyEditorTextToClipboardChannel,
  copyDiagramSvgChannel,
  printHtmlChannel,
  printPreviewChannel,
  saveDiagramSvgChannel,
  savePreviewAsPdfChannel,
  type RelicApi
} from "../shared/ipc";

describe("preload output API", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    electronMock.invoke.mockResolvedValue({ ok: true, value: undefined });
    await import("./preload");
  });

  function exposedApi(): RelicApi {
    const api = electronMock.exposeInMainWorld.mock.calls.find(([name]) => name === "relic")?.[1];
    if (!api) throw new Error("Relic API was not exposed.");
    return api as RelicApi;
  }

  it("preloadから出力APIを公開する", async () => {
    const api = exposedApi();

    await api.savePreviewAsPdf({ defaultFileName: "Note", html: "<html></html>", title: "Note" });
    await api.printPreview({ html: "<html></html>", title: "Note" });
    await api.printHtml({ html: "<html></html>", title: "Note" });
    await api.saveDiagramSvg({
      defaultFileName: "Note-diagram-1-mermaid",
      language: "mermaid",
      svg: "<svg><path /></svg>"
    });
    await api.copyDiagramSvg({ language: "d2", svg: "<svg><path /></svg>" });
    await api.copyEditorTextToClipboard({ text: "selected text" });

    expect(electronMock.invoke).toHaveBeenCalledWith(savePreviewAsPdfChannel, {
      defaultFileName: "Note",
      html: "<html></html>",
      title: "Note"
    });
    expect(electronMock.invoke).toHaveBeenCalledWith(printPreviewChannel, {
      html: "<html></html>",
      title: "Note"
    });
    expect(electronMock.invoke).toHaveBeenCalledWith(printHtmlChannel, {
      html: "<html></html>",
      title: "Note"
    });
    expect(electronMock.invoke).toHaveBeenCalledWith(saveDiagramSvgChannel, {
      defaultFileName: "Note-diagram-1-mermaid",
      language: "mermaid",
      svg: "<svg><path /></svg>"
    });
    expect(electronMock.invoke).toHaveBeenCalledWith(copyDiagramSvgChannel, {
      language: "d2",
      svg: "<svg><path /></svg>"
    });
    expect(electronMock.invoke).toHaveBeenCalledWith(copyEditorTextToClipboardChannel, {
      text: "selected text"
    });
    expect("readEditorClipboardForPaste" in api).toBe(false);
    expect("readClipboardText" in api).toBe(false);
    expect("writeClipboardText" in api).toBe(false);
  });
});
