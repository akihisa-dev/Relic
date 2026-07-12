import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { PagePreviewPopover } from "./PagePreviewPopover";

function renderPopover(): HTMLSpanElement {
  const link = document.createElement("span");
  link.dataset.previewSourcePath = "Source.md";
  link.dataset.previewTarget = "Target";
  link.textContent = "Target";
  document.body.append(link);

  render(
    <I18nProvider language="ja">
      <PagePreviewPopover aliasesByPath={{}} existingMarkdownPaths={[]} />
    </I18nProvider>
  );

  return link;
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
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
});
