import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import { PagePreviewPopover } from "./PagePreviewPopover";

function renderPopover(existingMarkdownPaths: string[] = []): HTMLSpanElement {
  const link = document.createElement("span");
  link.dataset.previewSourcePath = "Source.md";
  link.dataset.previewTarget = "Target";
  link.textContent = "Target";
  document.body.append(link);

  render(
    <I18nProvider language="ja">
      <PagePreviewPopover aliasesByPath={{}} existingMarkdownPaths={existingMarkdownPaths} />
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
    expect(screen.getByRole("complementary", { name: "ページプレビュー" })).toBeInTheDocument();

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
    window.relic = makeRelicApi({ readMarkdownFile });
    const link = renderPopover(["Target.md"]);

    fireEvent.pointerOver(link, { clientX: 40, clientY: 50 });
    act(() => vi.advanceTimersByTime(240));
    vi.useRealTimers();

    expect(await screen.findByText("本文")).toBeInTheDocument();
    expect(readMarkdownFile).toHaveBeenCalledWith({ path: "Target.md" });
    expect(screen.getByRole("heading", { name: "Target" })).toBeInTheDocument();
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
    window.relic = makeRelicApi({ readMarkdownFile });
    const link = document.createElement("span");
    link.dataset.previewSourcePath = "Source.md";
    link.dataset.previewTarget = "Target";
    document.body.append(link);
    const view = render(
      <I18nProvider language="ja">
        <PagePreviewPopover aliasesByPath={{}} existingMarkdownPaths={["Target.md"]} />
      </I18nProvider>
    );

    fireEvent.pointerOver(link, { clientX: 40, clientY: 50 });
    act(() => vi.advanceTimersByTime(240));
    expect(readMarkdownFile).toHaveBeenCalledWith({ path: "Target.md" });

    view.rerender(
      <I18nProvider language="ja">
        <PagePreviewPopover aliasesByPath={{}} existingMarkdownPaths={["Other.md"]} />
      </I18nProvider>
    );
    expect(screen.queryByRole("complementary", { name: "ページプレビュー" })).toBeNull();

    await act(async () => resolveRead({
      ok: true,
      value: { content: "# Old workspace", encoding: "utf8", path: "Target.md" }
    }));
    expect(screen.queryByRole("complementary", { name: "ページプレビュー" })).toBeNull();
  });
});
