import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readLinkUpdateImpact, updateLinksForFileRename, updateLinksForFolderRename } from "./linkUpdater";

describe("updateLinksForFileRename", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((p) => rm(p, { force: true, recursive: true }))
    );
  });

  it("同フォルダ内ファイルの basename-only リンクを更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "source.md"), "[[old]]", "utf8");
    await writeFile(path.join(ws, "new.md"), "# new", "utf8");

    await updateLinksForFileRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[new]]");
  });

  it("パス付きリンクを更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "folder"));

    await writeFile(path.join(ws, "source.md"), "[[folder/old]]", "utf8");
    await writeFile(path.join(ws, "folder", "new.md"), "", "utf8");

    await updateLinksForFileRename(ws, "folder/old.md", "folder/new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[folder/new]]");
  });

  it("別フォルダへ移動したファイルへの basename-only リンクはパス付きリンクへ更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "archive"));

    await writeFile(path.join(ws, "source.md"), "[[note]]", "utf8");
    await writeFile(path.join(ws, "archive", "note.md"), "", "utf8");

    await updateLinksForFileRename(ws, "note.md", "archive/note.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[archive/note]]");
  });

  it("同じフォルダ内で変更した basename-only リンクはファイル名だけを更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "folder"));

    await writeFile(path.join(ws, "folder", "source.md"), "[[old]]", "utf8");
    await writeFile(path.join(ws, "folder", "new.md"), "", "utf8");

    await updateLinksForFileRename(ws, "folder/old.md", "folder/new.md");

    await expect(readFile(path.join(ws, "folder", "source.md"), "utf8")).resolves.toBe("[[new]]");
  });

  it("フロントマター内のファイルリンクも更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "source.md"), "---\nrelated: [[old]]\n---\n# source", "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    await updateLinksForFileRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe(
      "---\nrelated: [[new]]\n---\n# source"
    );
  });

  it("エイリアスを保持したままターゲットを更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "source.md"), "[[old|表示名]]", "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    await updateLinksForFileRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[new|表示名]]");
  });

  it("見出しリンクを保持したままターゲットを更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "source.md"), "[[old#見出し1]]", "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    await updateLinksForFileRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[new#見出し1]]");
  });

  it("コードブロック内のリンクは更新しない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    const original = "```\n[[old]]\n```";
    await writeFile(path.join(ws, "source.md"), original, "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    await updateLinksForFileRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe(original);
  });

  it("リンク更新の影響件数はコードブロック内リンクを数えない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "source.md"), "[[old]]\n```\n[[old]]\n```", "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    await expect(readLinkUpdateImpact(ws, "file", "old.md", "new.md")).resolves.toEqual({
      ok: true,
      value: {
        fileCount: 1,
        linkCount: 1
      }
    });
  });

  it("埋め込みリンク ![[...]] も更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "source.md"), "![[old]]", "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    await updateLinksForFileRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("![[new]]");
  });

  it("別のファイルへのリンクは更新しない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "source.md"), "[[other]]", "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");
    await writeFile(path.join(ws, "other.md"), "", "utf8");

    await updateLinksForFileRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[other]]");
  });
});

describe("updateLinksForFolderRename", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((p) => rm(p, { force: true, recursive: true }))
    );
  });

  it("パス付きリンクのフォルダ部分を更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "new-folder"));

    await writeFile(path.join(ws, "source.md"), "[[old-folder/note]]", "utf8");
    await writeFile(path.join(ws, "new-folder", "note.md"), "", "utf8");

    await updateLinksForFolderRename(ws, "old-folder", "new-folder");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[new-folder/note]]");
  });

  it("basename-only リンクは更新しない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "new-folder"));

    await writeFile(path.join(ws, "source.md"), "[[note]]", "utf8");
    await writeFile(path.join(ws, "new-folder", "note.md"), "", "utf8");

    await updateLinksForFolderRename(ws, "old-folder", "new-folder");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[note]]");
  });

  it("コードブロック内のリンクは更新しない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "new-folder"));

    const original = "```\n[[old-folder/note]]\n```";
    await writeFile(path.join(ws, "source.md"), original, "utf8");
    await writeFile(path.join(ws, "new-folder", "note.md"), "", "utf8");

    await updateLinksForFolderRename(ws, "old-folder", "new-folder");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe(original);
  });

  it("フロントマター内のフォルダ付きリンクも更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "new-folder"));

    await writeFile(path.join(ws, "source.md"), "---\nrelated: [[old-folder/note]]\n---\n# source", "utf8");
    await writeFile(path.join(ws, "new-folder", "note.md"), "", "utf8");

    await updateLinksForFolderRename(ws, "old-folder", "new-folder");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe(
      "---\nrelated: [[new-folder/note]]\n---\n# source"
    );
  });
});
