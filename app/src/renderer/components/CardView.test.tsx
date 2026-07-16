import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { resetWorkspaceCardsCache } from "../cards/workspaceCardsLoader";
import { I18nProvider } from "../i18n";
import { CardView } from "./CardView";

let intersectionCallback: IntersectionObserverCallback | null = null;

class IntersectionObserverMock {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = "";
  thresholds = [];
}

afterEach(() => {
  cleanup();
  resetWorkspaceCardsCache();
  intersectionCallback = null;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CardView", () => {
  it("索引の対象だけを表示し、画面付近へ来た画像だけを読み込んで元ファイルを開く", async () => {
    const onOpenFile = vi.fn();
    const readImageFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { dataUrl: "data:image/webp;base64,Y2FyZA==" }
    });
    window.relic = makeRelicApi({
      getWorkspaceCards: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ imagePath: "./images/moon.webp", name: "Moon", path: "notes/moon.md" }]
      }),
      readImageFile
    });
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

    const view = render(
      <I18nProvider language="ja">
        <CardView onOpenFile={onOpenFile} refreshRevision={0} workspaceId="workspace-1" />
      </I18nProvider>
    );

    expect(await screen.findByRole("button", { name: "Moonを開く" })).toBeInTheDocument();
    expect(readImageFile).not.toHaveBeenCalled();

    act(() => {
      intersectionCallback?.([
        { isIntersecting: true } as IntersectionObserverEntry
      ], {} as IntersectionObserver);
    });

    await waitFor(() => expect(readImageFile).toHaveBeenCalledWith({ path: "notes/images/moon.webp" }));
    await waitFor(() => expect(view.container.querySelector("img")).toHaveAttribute("src", "data:image/webp;base64,Y2FyZA=="));

    fireEvent.click(screen.getByRole("button", { name: "Moonを開く" }));
    expect(onOpenFile).toHaveBeenCalledWith("notes/moon.md");
  });

  it("無効な画像パスでもカード名と操作を残して代替表示にする", async () => {
    const readImageFile = vi.fn();
    window.relic = makeRelicApi({
      getWorkspaceCards: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ imagePath: "../../outside.webp", name: "Broken", path: "broken.md" }]
      }),
      readImageFile
    });
    vi.stubGlobal("IntersectionObserver", undefined);

    render(
      <I18nProvider language="ja">
        <CardView onOpenFile={vi.fn()} refreshRevision={0} workspaceId="workspace-1" />
      </I18nProvider>
    );

    expect(await screen.findByText("画像を表示できません")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Brokenを開く" })).toBeInTheDocument();
    expect(readImageFile).not.toHaveBeenCalled();
  });
});
