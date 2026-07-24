import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const outputMock = vi.hoisted(() => ({
  buildPreviewOutputHtml: vi.fn()
}));

vi.mock("../outputHtml", () => ({
  buildPreviewOutputHtml: outputMock.buildPreviewOutputHtml
}));

import { makeRelicApi } from "../../test/rendererTestUtils";
import type { RelicApi } from "../../shared/ipc";
import type { FileTab } from "../store/editorStore";
import { createTranslator } from "../i18nModel";
import { installRelicClientProvider } from "../relicClient";
import { useAppPreviewOutputActions } from "./useAppPreviewOutputActions";

const activeFileTab: FileTab = {
  content: "# Note",
  id: "note",
  kind: "file",
  name: "Note.md",
  path: "docs/Note.md",
  savedContent: "# Note"
};
const outputPayload = {
  defaultFileName: "Note",
  html: "<html><body>Note</body></html>",
  title: "Note"
};
const restores: Array<() => void> = [];
type SavePreviewAsPdf = RelicApi["savePreviewAsPdf"];

describe("useAppPreviewOutputActions", () => {
  beforeEach(() => {
    outputMock.buildPreviewOutputHtml.mockResolvedValue(outputPayload);
  });

  afterEach(() => {
    restores.splice(0).reverse().forEach((restore) => restore());
    vi.clearAllMocks();
  });

  it("選択中のファイルからPDF入力を生成して保存成功を通知する", async () => {
    const savePreviewAsPdf = vi.fn<SavePreviewAsPdf>().mockResolvedValue({
      ok: true,
      value: { status: "saved" }
    });
    installApi(savePreviewAsPdf);
    const showToast = vi.fn();
    const setWorkspaceError = vi.fn();
    const t = createTranslator("en");
    const { result } = renderHook(() => useAppPreviewOutputActions({
      activeFileTab,
      setWorkspaceError,
      showToast,
      t,
      workspacePath: "/workspace",
      workspaceRevision: 3
    }));

    act(() => result.current.handleSavePreviewAsPdf());

    await waitFor(() => expect(savePreviewAsPdf).toHaveBeenCalledWith(outputPayload));
    expect(outputMock.buildPreviewOutputHtml).toHaveBeenCalledWith({
      content: activeFileTab.content,
      fileName: activeFileTab.name,
      path: activeFileTab.path,
      t,
      title: activeFileTab.name,
      workspacePath: "/workspace",
      workspaceRevision: 3
    });
    expect(showToast).toHaveBeenCalledWith(t("output.pdfSaved"), "info");
    expect(setWorkspaceError).not.toHaveBeenCalled();
  });

  it("保存キャンセルでは成功通知もエラーも表示しない", async () => {
    const savePreviewAsPdf = vi.fn<SavePreviewAsPdf>().mockResolvedValue({
      ok: true,
      value: { status: "canceled" }
    });
    installApi(savePreviewAsPdf);
    const showToast = vi.fn();
    const setWorkspaceError = vi.fn();
    const { result } = renderHook(() => useAppPreviewOutputActions({
      activeFileTab,
      setWorkspaceError,
      showToast,
      t: createTranslator("ja")
    }));

    act(() => result.current.handleSavePreviewAsPdf());

    await waitFor(() => expect(savePreviewAsPdf).toHaveBeenCalled());
    expect(showToast).not.toHaveBeenCalled();
    expect(setWorkspaceError).not.toHaveBeenCalled();
  });

  it("対象ファイルがなければ保存せず利用者へ知らせる", async () => {
    const savePreviewAsPdf = vi.fn<SavePreviewAsPdf>();
    installApi(savePreviewAsPdf);
    const setWorkspaceError = vi.fn();
    const t = createTranslator("en");
    const { result } = renderHook(() => useAppPreviewOutputActions({
      activeFileTab: null,
      setWorkspaceError,
      showToast: vi.fn(),
      t
    }));

    act(() => result.current.handleSavePreviewAsPdf());

    await waitFor(() => expect(setWorkspaceError).toHaveBeenCalledWith(t("output.savePdfNoFile")));
    expect(savePreviewAsPdf).not.toHaveBeenCalled();
    expect(outputMock.buildPreviewOutputHtml).not.toHaveBeenCalled();
  });

  it("Main側の保存失敗を利用者へ返す", async () => {
    const savePreviewAsPdf = vi.fn<SavePreviewAsPdf>().mockResolvedValue({
      error: { code: "OUTPUT_PDF_FAILED", message: "PDFを保存できませんでした" },
      ok: false
    });
    installApi(savePreviewAsPdf);
    const setWorkspaceError = vi.fn();
    const { result } = renderHook(() => useAppPreviewOutputActions({
      activeFileTab,
      setWorkspaceError,
      showToast: vi.fn(),
      t: createTranslator("ja")
    }));

    act(() => result.current.handleSavePreviewAsPdf());

    await waitFor(() => {
      expect(setWorkspaceError).toHaveBeenCalledWith("PDFを保存できませんでした");
    });
  });

  it("出力HTML生成の例外を利用者へ返す", async () => {
    outputMock.buildPreviewOutputHtml.mockRejectedValue(new Error("diagram render failed"));
    const savePreviewAsPdf = vi.fn<SavePreviewAsPdf>();
    installApi(savePreviewAsPdf);
    const setWorkspaceError = vi.fn();
    const { result } = renderHook(() => useAppPreviewOutputActions({
      activeFileTab,
      setWorkspaceError,
      showToast: vi.fn(),
      t: createTranslator("en")
    }));

    act(() => result.current.handleSavePreviewAsPdf());

    await waitFor(() => expect(setWorkspaceError).toHaveBeenCalledWith("diagram render failed"));
    expect(savePreviewAsPdf).not.toHaveBeenCalled();
  });
});

function installApi(savePreviewAsPdf: SavePreviewAsPdf): void {
  const api = makeRelicApi({ savePreviewAsPdf });
  restores.push(installRelicClientProvider(() => api));
}
