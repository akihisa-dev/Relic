import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildWikiLinkCompletionSource } from "../editorExtensions";
import { renderEditorWithView } from "./editorTestHelpers";

describe("Editor links", () => {
  it("ライブ表示のリンク文字クリックでリンクを開く", async () => {
    const onOpenLink = vi.fn();
    const onOpenWikiLink = vi.fn();

    await renderEditorWithView({
      content: "トップ: [リンク確認用トップ](./00-リンク確認用トップ.md)\nWiki: [[01-企画メモ]]",
      onOpenLink,
      onOpenWikiLink
    });

    fireEvent.click(await screen.findByText("リンク確認用トップ"));
    expect(onOpenLink).toHaveBeenCalledWith("./00-リンク確認用トップ.md");

    fireEvent.click(await screen.findByText("01-企画メモ"));
    expect(onOpenWikiLink).toHaveBeenCalledWith("01-企画メモ", undefined);
  });

  it("[[ 入力時のファイル名補完候補を作る", () => {
    const source = buildWikiLinkCompletionSource([
      "読書メモ.md",
      "folder/読書メモ.md",
      "資料.md"
    ]);
    const result = source({
      explicit: true,
      matchBefore: () => ({ from: 0, text: "[[読" })
    } as never);

    expect(result).toMatchObject({
      from: 2,
      options: [
        { apply: "folder/読書メモ]]", label: "folder/読書メモ" },
        { apply: "読書メモ]]", label: "読書メモ" }
      ]
    });
  });
});
