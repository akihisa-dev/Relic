import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../test/rendererTestUtils";
import {
  droppedImageSourcePaths,
  importDroppedImagesAsMarkdown,
  insertMarkdownImageBlock,
  workspaceFolderForMarkdownFile
} from "./editorImageDrop";

describe("editorImageDrop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.relic = undefined;
    document.body.innerHTML = "";
  });

  it("ドロップされた対応画像パスだけを抽出する", () => {
    const files = [new File([""], "diagram.png"), new File([""], "note.txt")];
    const event = {
      dataTransfer: { files }
    } as unknown as DragEvent;

    expect(droppedImageSourcePaths(event, (file) => `/tmp/${file.name}`)).toEqual(["/tmp/diagram.png"]);
  });

  it("Markdownファイルの親フォルダを返す", () => {
    expect(workspaceFolderForMarkdownFile("notes/entry.md")).toBe("notes");
    expect(workspaceFolderForMarkdownFile("entry.md")).toBe("");
  });

  it("画像記法をブロックとして挿入する", () => {
    const parent = document.body.appendChild(document.createElement("div"));
    const view = new EditorView({
      state: EditorState.create({ doc: "前後" }),
      parent
    });

    insertMarkdownImageBlock(view, 1, "![diagram](assets/diagram.png)");

    expect(view.state.doc.toString()).toBe("前\n![diagram](assets/diagram.png)\n後");
    view.destroy();
  });

  it("画像を取り込んでMarkdown画像記法を挿入する", async () => {
    const importImageFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { path: "notes/diagram.png" }
    });
    window.relic = makeRelicApi({ importImageFile });
    const parent = document.body.appendChild(document.createElement("div"));
    const view = new EditorView({
      state: EditorState.create({ doc: "" }),
      parent
    });
    vi.spyOn(view, "posAtCoords").mockReturnValue(0);

    await importDroppedImagesAsMarkdown(
      view,
      { clientX: 0, clientY: 0 } as DragEvent,
      "notes/entry.md",
      ["/tmp/diagram.png"]
    );

    expect(importImageFile).toHaveBeenCalledWith({
      destinationFolder: "notes",
      sourcePath: "/tmp/diagram.png"
    });
    expect(view.state.doc.toString()).toBe("![diagram](notes/diagram.png)");
    view.destroy();
  });
});
