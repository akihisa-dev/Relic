import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import { PagePreviewPopover } from "./PagePreviewPopover";

const originalPointerEventDescriptor = Object.getOwnPropertyDescriptor(window, "PointerEvent");

beforeAll(() => {
  if (typeof window.PointerEvent === "undefined") {
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      value: window.MouseEvent
    });
  }
});

afterAll(() => {
  if (originalPointerEventDescriptor) {
    Object.defineProperty(window, "PointerEvent", originalPointerEventDescriptor);
  } else {
    Reflect.deleteProperty(window, "PointerEvent");
  }
});

function renderPopover(
  existingMarkdownPaths: string[] = [],
  loadMarkdownRenderer?: ComponentProps<typeof PagePreviewPopover>["loadMarkdownRenderer"]
): HTMLSpanElement {
  const link = document.createElement("span");
  link.dataset.previewSourcePath = "Source.md";
  link.dataset.previewTarget = "Target";
  link.textContent = "Target";
  document.body.append(link);

  render(
    <I18nProvider language="ja">
      <PagePreviewPopover
        aliasesByPath={{}}
        existingMarkdownPaths={existingMarkdownPaths}
        loadMarkdownRenderer={loadMarkdownRenderer}
      />
    </I18nProvider>
  );

  return link;
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  window.relic = undefined;
  vi.useRealTimers();
});

describe("PagePreviewPopover", () => {
  it("リンクを離れたポインタ移動で表示を閉じる", () => {
    vi.useFakeTimers();
    const link = renderPopover();

    fireEvent.pointerOver(link, { clientX: 40, clientY: 50 });
    act(() => vi.advanceTimersByTime(240));
    const popover = screen.getByRole("complementary", { name: "ページプレビュー" });
    expect(popover).toBeInTheDocument();
    expect(popover).toHaveStyle({ left: "54px", top: "64px" });
    expect(Number.isFinite(Number.parseFloat(popover.style.left))).toBe(true);
    expect(Number.isFinite(Number.parseFloat(popover.style.top))).toBe(true);

    fireEvent.pointerMove(document.body, { clientX: 200, clientY: 200 });

    expect(screen.queryByRole("complementary", { name: "ページプレビュー" })).toBeNull();
  });

  it("別のリンクへ移ったときに前のプレビューを残さない", () => {
    vi.useFakeTimers();
    const firstLink = renderPopover();
    const secondLink = document.createElement("span");
    secondLink.dataset.previewSourcePath = "Source.md";
    secondLink.dataset.previewTarget = "Another";
    secondLink.textContent = "Another";
    document.body.append(secondLink);

    fireEvent.pointerOver(firstLink, { clientX: 40, clientY: 50 });
    act(() => vi.advanceTimersByTime(240));
    expect(screen.getByRole("complementary", { name: "ページプレビュー" })).toBeInTheDocument();

    fireEvent.pointerOver(secondLink, { clientX: 80, clientY: 90 });

    expect(screen.queryByRole("complementary", { name: "ページプレビュー" })).toBeNull();
  });

  it("hoverが確定してからMarkdown変換を読み込み、安全化した本文を表示する", async () => {
    vi.useFakeTimers();
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "# Target\n\n本文", encoding: "utf8", path: "Target.md" }
    });
    const renderMarkdown = vi.fn(() => [
      "<h1>Target</h1>",
      "<p>本文</p>",
      "<script>window.previewWasUnsafe = true</script>"
    ].join(""));
    const loadMarkdownRenderer = vi.fn().mockResolvedValue({ renderMarkdown });
    window.relic = makeRelicApi({ readMarkdownFile });
    const link = renderPopover(["Target.md"], loadMarkdownRenderer);

    fireEvent.pointerOver(link, { clientX: 40, clientY: 50 });
    expect(readMarkdownFile).not.toHaveBeenCalled();
    expect(loadMarkdownRenderer).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(239));
    expect(readMarkdownFile).not.toHaveBeenCalled();
    expect(loadMarkdownRenderer).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(screen.getByText("本文")).toBeInTheDocument();
    expect(readMarkdownFile).toHaveBeenCalledWith({ path: "Target.md" });
    expect(loadMarkdownRenderer).toHaveBeenCalledOnce();
    expect(renderMarkdown).toHaveBeenCalledWith("# Target\n\n本文", null, new Map(), false, expect.any(Function));
    expect(screen.getByRole("heading", { name: "Target" })).toBeInTheDocument();
    expect(document.querySelector(".page-preview-body script")).toBeNull();
  });

  it("ワークスペース由来のpath集合が変わった後は旧要求の完了を表示しない", async () => {
    vi.useFakeTimers();
    let resolveRead!: (value: {
      ok: true;
      value: { content: string; encoding: "utf8"; path: string };
    }) => void;
    const readMarkdownFile = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveRead = resolve;
    }));
    const loadMarkdownRenderer = vi.fn().mockResolvedValue({ renderMarkdown: vi.fn(() => "<p>old</p>") });
    window.relic = makeRelicApi({ readMarkdownFile });
    const link = document.createElement("span");
    link.dataset.previewSourcePath = "Source.md";
    link.dataset.previewTarget = "Target";
    document.body.append(link);
    const view = render(
      <I18nProvider language="ja">
        <PagePreviewPopover
          aliasesByPath={{}}
          existingMarkdownPaths={["Target.md"]}
          loadMarkdownRenderer={loadMarkdownRenderer}
        />
      </I18nProvider>
    );

    fireEvent.pointerOver(link, { clientX: 40, clientY: 50 });
    act(() => vi.advanceTimersByTime(240));
    expect(readMarkdownFile).toHaveBeenCalledWith({ path: "Target.md" });

    view.rerender(
      <I18nProvider language="ja">
        <PagePreviewPopover
          aliasesByPath={{}}
          existingMarkdownPaths={["Other.md"]}
          loadMarkdownRenderer={loadMarkdownRenderer}
        />
      </I18nProvider>
    );
    expect(screen.queryByRole("complementary", { name: "ページプレビュー" })).toBeNull();

    await act(async () => resolveRead({
      ok: true,
      value: { content: "# Old workspace", encoding: "utf8", path: "Target.md" }
    }));
    expect(screen.queryByRole("complementary", { name: "ページプレビュー" })).toBeNull();
    expect(loadMarkdownRenderer).not.toHaveBeenCalled();
  });
});
