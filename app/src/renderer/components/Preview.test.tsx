import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import { normalizeEmbedTarget } from "../previewMarkdown";
import { Preview } from "./Preview";

const settings = { ...defaultEditorSettings, language: "ja" as const };

describe("Preview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.relic = undefined;
  });

  it("Markdownを見出しとしてレンダリングする", () => {
    render(<Preview content="# タイトル" settings={settings} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("タイトル");
  });

  it("チェックボックスをクリックすると onChange が呼ばれる", () => {
    const onChange = vi.fn();

    render(
      <Preview
        content="- [ ] タスク"
        onChange={onChange}
        settings={settings}
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith("- [x] タスク");
  });

  it("チェック済みをクリックすると未チェックに戻る", () => {
    const onChange = vi.fn();

    render(
      <Preview
        content="- [x] 完了"
        onChange={onChange}
        settings={settings}
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith("- [ ] 完了");
  });

  it("複数チェックボックスで正しいインデックスのみ切り替わる", () => {
    const onChange = vi.fn();
    const content = "- [ ] 一\n- [ ] 二\n- [ ] 三";

    render(<Preview content={content} onChange={onChange} settings={settings} />);

    const checkboxes = screen.getAllByRole("checkbox");

    fireEvent.click(checkboxes[1]);

    expect(onChange).toHaveBeenCalledWith("- [ ] 一\n- [x] 二\n- [ ] 三");
  });

  it("内部リンクをクリックするとリンク先ターゲットを通知する", () => {
    const onOpenWikiLink = vi.fn();

    render(
      <Preview
        content="[[参照先|表示名]]"
        onOpenWikiLink={onOpenWikiLink}
        settings={settings}
      />
    );

    fireEvent.click(screen.getByText("表示名"));

    expect(onOpenWikiLink).toHaveBeenCalledWith("参照先");
  });

  it("本文中の#記法をタグUIとして扱わない", () => {
    render(<Preview content="本文 #資料" settings={settings} />);

    expect(screen.getByText("本文 #資料")).toBeInTheDocument();
    expect(document.querySelector(".hashtag")).toBeNull();
  });

  it("Markdown画像を画像として表示しない", () => {
    render(
      <Preview
        content="![図](attachments/diagram.png)"
        settings={settings}
        workspacePath="/tmp/relic workspace"
      />
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("図")).toBeInTheDocument();
  });

  it("Obsidian形式の画像埋め込みをファイル埋め込みとして扱わない", () => {
    window.relic = makeRelicApi({
      readMarkdownFile: vi.fn()
    });

    render(
      <Preview
        content="![[diagram.png]]"
        settings={settings}
        workspacePath="/tmp/relic workspace"
      />
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("![[diagram.png]]")).toBeInTheDocument();
    expect(window.relic!.readMarkdownFile).not.toHaveBeenCalled();
  });

  it("外部URL画像は初期対象外として画像表示しない", () => {
    render(
      <Preview
        content="![外部](https://example.com/image.png)"
        settings={settings}
        workspacePath="/tmp/relic"
      />
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("外部")).toBeInTheDocument();
  });

  it("ファイル埋め込みを一段階だけ読み込んで表示する", async () => {
    window.relic = makeRelicApi({
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "# 埋め込み先\n\n本文\n\n![[さらに奥]]",
          name: "埋め込み先",
          path: "埋め込み先.md"
        }
      })
    });

    render(<Preview content="前\n\n![[埋め込み先]]\n\n後" settings={settings} />);

    expect(window.relic!.readMarkdownFile).toHaveBeenCalledWith({ path: "埋め込み先.md" });
    expect(await screen.findByRole("heading", { level: 1, name: "埋め込み先" })).toBeInTheDocument();
    expect(screen.getByText("本文")).toBeInTheDocument();
    expect(window.relic!.readMarkdownFile).toHaveBeenCalledTimes(1);
  });

  it("大きすぎる埋め込みファイルは全文表示しない", async () => {
    window.relic = makeRelicApi({
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "a".repeat(20_001), name: "巨大ノート", path: "巨大ノート.md" }
      })
    });

    render(
      <I18nProvider language="ja">
        <Preview content="![[巨大ノート]]" settings={settings} />
      </I18nProvider>
    );

    expect(await screen.findByText("巨大ノート は大きいため全文表示しません")).toBeInTheDocument();
  });
});

describe("normalizeEmbedTarget", () => {
  it("Markdownファイルとして読める埋め込み先へ正規化する", () => {
    expect(normalizeEmbedTarget("Folder/Note")).toBe("Folder/Note.md");
    expect(normalizeEmbedTarget("Folder/Note.md#見出し")).toBe("Folder/Note.md");
    expect(normalizeEmbedTarget("Folder/image.png")).toBeNull();
    expect(normalizeEmbedTarget("../secret")).toBeNull();
    expect(normalizeEmbedTarget("https://example.com/note.md")).toBeNull();
  });
});
