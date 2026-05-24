import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { updateLinksForFileRename, updateLinksForFolderRename } from "./linkUpdater";

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
});
