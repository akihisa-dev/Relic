import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import { usePreviewEmbeds } from "./usePreviewEmbeds";

type ReadMarkdownResult =
  | { ok: true; value: { content: string; name: string; path: string } };

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe("usePreviewEmbeds", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("同時読み込み数を最大2件に制限する", async () => {
    const pending = new Map<string, { promise: Promise<ReadMarkdownResult>; resolve: (value: ReadMarkdownResult) => void }>();
    const inFlightTargets = new Set<string>();
    let maxInFlight = 0;

    const readMarkdownFile = vi.fn(({ path }) => {
      const d = pending.get(path) ?? (() => {
        const entry = deferred<ReadMarkdownResult>();
        pending.set(path, entry);
        return entry;
      })();

      inFlightTargets.add(path);
      maxInFlight = Math.max(maxInFlight, inFlightTargets.size);

      return d.promise.finally(() => {
        inFlightTargets.delete(path);
      }).then((): ReadMarkdownResult => ({
        ok: true,
        value: {
          content: `# ${path}`,
          name: path,
          path
        }
      }));
    });

    window.relic = makeRelicApi({
      readMarkdownFile
    });

    renderHook(() => usePreviewEmbeds("![[A]] ![[B]] ![[C]]", "/tmp/Notes"));

    await waitFor(() => {
      expect(readMarkdownFile).toHaveBeenCalledTimes(2);
    });

    expect(maxInFlight).toBe(2);

    pending.get("A.md")!.resolve({
      ok: true,
      value: { content: "# A", name: "A.md", path: "A.md" }
    });

    pending.get("B.md")!.resolve({
      ok: true,
      value: { content: "# B", name: "B.md", path: "B.md" }
    });

    await waitFor(() => {
      expect(readMarkdownFile).toHaveBeenCalledTimes(3);
    });
  });

  it("埋め込み読込の例外を英語UI向けの文言へ置き換える", async () => {
    window.relic = makeRelicApi({
      readMarkdownFile: vi.fn().mockRejectedValue(new Error("technical details"))
    });
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(I18nProvider, { children, language: "en" });

    const { result } = renderHook(
      () => usePreviewEmbeds("![[A]]", "/tmp/Notes"),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.get("A.md")).toEqual({
        message: "Could not read the embedded file.",
        status: "error"
      });
    });
  });
});
