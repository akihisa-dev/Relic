import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { createTranslator } from "../i18nModel";
import { installRelicClientProvider } from "../relicClient";
import { useFileToolActions } from "./useFileToolActions";

const restores: Array<() => void> = [];

afterEach(() => restores.splice(0).reverse().forEach((restore) => restore()));

function useRelicApi(api: ReturnType<typeof makeRelicApi>): void {
  restores.push(installRelicClientProvider(() => api));
}

describe("useFileToolActions", () => {
  it("成功を通知して生成ファイルを開く", async () => {
    const generateTitleList = vi.fn().mockResolvedValue({ ok: true, value: "Titles.md" });
    useRelicApi(makeRelicApi({ generateTitleList }));
    const onOpenFile = vi.fn();
    const onShowToast = vi.fn();
    const { result } = renderHook(() => useFileToolActions({ onOpenFile, onShowToast, t: createTranslator("en") }));

    act(() => result.current.onRunFileTool("titleList", { kind: "workspace" }));

    await waitFor(() => expect(onOpenFile).toHaveBeenCalledWith("Titles.md"));
    expect(onShowToast).toHaveBeenCalledWith("Created Titles.md.", "info");
    expect(generateTitleList).toHaveBeenCalledWith(expect.objectContaining({ target: { kind: "workspace" } }));
  });

  it("実行中は同じ操作を重複開始しない", async () => {
    let complete!: (value: { ok: true; value: string }) => void;
    const mergeFiles = vi.fn().mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    useRelicApi(makeRelicApi({ mergeFiles }));
    const { result } = renderHook(() => useFileToolActions({
      onOpenFile: vi.fn(),
      onShowToast: vi.fn(),
      t: createTranslator("en")
    }));

    act(() => {
      result.current.onRunFileTool("mergeFiles", { kind: "workspace" });
      result.current.onRunFileTool("mergeFiles", { kind: "workspace" });
    });
    expect(mergeFiles).toHaveBeenCalledTimes(1);
    complete({ ok: true, value: "Merged.md" });
    await waitFor(() => expect(result.current.runningFileTool).toBeNull());
  });

  it("失敗理由をエラー通知する", async () => {
    useRelicApi(makeRelicApi({
      generateTagIndex: vi.fn().mockResolvedValue({ ok: false, error: { code: "TOOL_TARGET_EMPTY", message: "No files" } })
    }));
    const onShowToast = vi.fn();
    const { result } = renderHook(() => useFileToolActions({
      onOpenFile: vi.fn(),
      onShowToast,
      t: createTranslator("en")
    }));
    act(() => result.current.onRunFileTool("tagIndex", { kind: "folder", path: "empty" }));
    await waitFor(() => expect(onShowToast).toHaveBeenCalledWith("No files", "error"));
  });
});
