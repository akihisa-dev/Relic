import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceCard } from "../../shared/ipc";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { resetWorkspaceCardsCache } from "../cards/workspaceCardsLoader";
import { I18nProvider } from "../i18n";
import { CardView } from "./CardView";

afterEach(() => {
  cleanup();
  resetWorkspaceCardsCache();
  vi.clearAllMocks();
});

const cards: WorkspaceCard[] = [
  { imagePath: "./images/moon.webp", name: "Moon", path: "notes/moon.md" },
  { imagePath: "./images/sun.webp", name: "Sun", path: "notes/sun.md" }
];

function StatefulCardView({
  currentPath = null,
  initialPath = null,
  onOpenFile
}: {
  currentPath?: string | null;
  initialPath?: string | null;
  onOpenFile: (path: string) => void;
}): ReactElement {
  const [selectedPath, setSelectedPath] = useState(initialPath);
  return (
    <CardView
      currentPath={currentPath}
      onOpenFile={onOpenFile}
      onSelectPath={setSelectedPath}
      refreshRevision={0}
      selectedPath={selectedPath}
      workspaceId="workspace-1"
    />
  );
}

describe("CardView", () => {
  it("一覧選択とファイルを開く操作を分離し、選択中の画像だけを読み込む", async () => {
    const onOpenFile = vi.fn();
    const readImageFile = vi.fn().mockImplementation(({ path }: { path: string }) => Promise.resolve({
      ok: true,
      value: { dataUrl: `data:image/webp;base64,${path.includes("moon") ? "bW9vbg==" : "c3Vu"}` }
    }));
    window.relic = makeRelicApi({
      getWorkspaceCards: vi.fn().mockResolvedValue({ ok: true, value: cards }),
      readImageFile
    });

    const view = render(
      <I18nProvider language="ja">
        <StatefulCardView initialPath="notes/moon.md" onOpenFile={onOpenFile} />
      </I18nProvider>
    );

    const cardButton = await screen.findByRole("button", { name: "Moonを開く" });
    expect(cardButton).toBeInTheDocument();
    expect(cardButton.parentElement).toHaveClass("card-view-body");
    expect(screen.queryByText("カード")).not.toBeInTheDocument();
    expect(screen.queryByText("カードビュー")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Moon" })).toHaveAttribute("aria-current", "true");
    await waitFor(() => expect(readImageFile).toHaveBeenCalledTimes(1));
    expect(readImageFile).toHaveBeenLastCalledWith({ path: "notes/images/moon.webp" });

    fireEvent.click(screen.getByRole("button", { name: "Sun" }));
    expect(onOpenFile).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Sunを開く" })).toBeInTheDocument();
    await waitFor(() => expect(readImageFile).toHaveBeenCalledTimes(2));
    expect(readImageFile).toHaveBeenLastCalledWith({ path: "notes/images/sun.webp" });
    expect(view.container.querySelectorAll("img")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Sunを開く" }));
    expect(onOpenFile).toHaveBeenCalledWith("notes/sun.md");
  });

  it("前回選択がなければ現在のファイルを選び、どちらもなければ先頭を選ぶ", async () => {
    const onSelectPath = vi.fn();
    const readImageFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { dataUrl: "data:image/webp;base64,c3Vu" }
    });
    window.relic = makeRelicApi({
      getWorkspaceCards: vi.fn().mockResolvedValue({ ok: true, value: cards }),
      readImageFile
    });

    const { rerender } = render(
      <I18nProvider language="ja">
        <CardView
          currentPath="notes/sun.md"
          onOpenFile={vi.fn()}
          onSelectPath={onSelectPath}
          refreshRevision={0}
          selectedPath="removed.md"
          workspaceId="workspace-1"
        />
      </I18nProvider>
    );

    expect(await screen.findByRole("button", { name: "Sunを開く" })).toBeInTheDocument();
    await waitFor(() => expect(onSelectPath).toHaveBeenCalledWith("notes/sun.md"));

    onSelectPath.mockClear();
    rerender(
      <I18nProvider language="ja">
        <CardView
          onOpenFile={vi.fn()}
          onSelectPath={onSelectPath}
          refreshRevision={0}
          selectedPath="removed.md"
          workspaceId="workspace-1"
        />
      </I18nProvider>
    );

    expect(await screen.findByRole("button", { name: "Moonを開く" })).toBeInTheDocument();
    await waitFor(() => expect(onSelectPath).toHaveBeenCalledWith("notes/moon.md"));
  });

  it("切替前の画像読込が遅れて完了しても現在のカードへ混入させない", async () => {
    type ImageResult = { ok: true; value: { dataUrl: string } };
    let resolveMoon: ((result: ImageResult) => void) | null = null;
    const readImageFile = vi.fn().mockImplementation(({ path }: { path: string }) => {
      if (path.includes("moon")) {
        return new Promise<ImageResult>((resolve) => {
          resolveMoon = resolve;
        });
      }
      return Promise.resolve<ImageResult>({
        ok: true,
        value: { dataUrl: "data:image/webp;base64,c3Vu" }
      });
    });
    window.relic = makeRelicApi({
      getWorkspaceCards: vi.fn().mockResolvedValue({ ok: true, value: cards }),
      readImageFile
    });

    const view = render(
      <I18nProvider language="ja">
        <StatefulCardView initialPath="notes/moon.md" onOpenFile={vi.fn()} />
      </I18nProvider>
    );

    await screen.findByRole("button", { name: "Moonを開く" });
    await waitFor(() => expect(readImageFile).toHaveBeenCalledWith({ path: "notes/images/moon.webp" }));
    const imageFrame = view.container.querySelector<HTMLElement>(".card-view-image-frame");
    const loadingImage = view.container.querySelector<HTMLElement>('.card-view-image[data-image-state="loading"]');
    expect(imageFrame).toContainElement(loadingImage);
    expect(loadingImage?.querySelector(".card-view-image-placeholder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sun" }));
    await waitFor(() => expect(view.container.querySelector("img")).toHaveAttribute("src", "data:image/webp;base64,c3Vu"));
    expect(view.container.querySelector(".card-view-image-frame")).toBe(imageFrame);

    act(() => {
      resolveMoon?.({ ok: true, value: { dataUrl: "data:image/webp;base64,bW9vbg==" } });
    });
    await waitFor(() => expect(view.container.querySelector("img")).toHaveAttribute("src", "data:image/webp;base64,c3Vu"));
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

    render(
      <I18nProvider language="ja">
        <CardView
          onOpenFile={vi.fn()}
          onSelectPath={vi.fn()}
          refreshRevision={0}
          workspaceId="workspace-1"
        />
      </I18nProvider>
    );

    expect(await screen.findByText("画像を表示できません")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Brokenを開く" })).toBeInTheDocument();
    expect(readImageFile).not.toHaveBeenCalled();
  });

  it("対象がない場合は表示条件を案内する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceCards: vi.fn().mockResolvedValue({ ok: true, value: [] })
    });

    render(
      <I18nProvider language="ja">
        <CardView
          onOpenFile={vi.fn()}
          onSelectPath={vi.fn()}
          refreshRevision={0}
          workspaceId="workspace-1"
        />
      </I18nProvider>
    );

    expect(await screen.findByRole("heading", { name: "表示できるカードはまだありません" })).toBeInTheDocument();
    expect(screen.getByText(/cardプロパティに/)).toBeInTheDocument();
  });
});
