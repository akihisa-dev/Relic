import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { updateLinksForCardRename, updateLinksForCardFolderRename } from "./linkUpdater";

describe("updateLinksForCardRename", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((p) => rm(p, { force: true, recursive: true }))
    );
  });

  it("同カードフォルダ内カードの basename-only リンクを更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "source.md"), "[[old]]", "utf8");
    await writeFile(path.join(ws, "new.md"), "# new", "utf8");

    await updateLinksForCardRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[new]]");
  });

  it("パス付きリンクを更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "cardFolder"));

    await writeFile(path.join(ws, "source.md"), "[[cardFolder/old]]", "utf8");
    await writeFile(path.join(ws, "cardFolder", "new.md"), "", "utf8");

    await updateLinksForCardRename(ws, "cardFolder/old.md", "cardFolder/new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[cardFolder/new]]");
  });

  it("エイリアスを保持したままターゲットを更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "source.md"), "[[old|表示名]]", "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    await updateLinksForCardRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[new|表示名]]");
  });

  it("見出しリンクを保持したままターゲットを更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "source.md"), "[[old#見出し1]]", "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    await updateLinksForCardRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[new#見出し1]]");
  });

  it("コードブロック内のリンクは更新しない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    const original = "```\n[[old]]\n```";
    await writeFile(path.join(ws, "source.md"), original, "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    await updateLinksForCardRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe(original);
  });

  it("埋め込みリンク ![[...]] も更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "source.md"), "![[old]]", "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    await updateLinksForCardRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("![[new]]");
  });

  it("別のカードへのリンクは更新しない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "source.md"), "[[other]]", "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");
    await writeFile(path.join(ws, "other.md"), "", "utf8");

    await updateLinksForCardRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[other]]");
  });
});

describe("updateLinksForCardFolderRename", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((p) => rm(p, { force: true, recursive: true }))
    );
  });

  it("パス付きリンクのカードフォルダ部分を更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "new-cardFolder"));

    await writeFile(path.join(ws, "source.md"), "[[old-cardFolder/note]]", "utf8");
    await writeFile(path.join(ws, "new-cardFolder", "note.md"), "", "utf8");

    await updateLinksForCardFolderRename(ws, "old-cardFolder", "new-cardFolder");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[new-cardFolder/note]]");
  });

  it("basename-only リンクは更新しない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "new-cardFolder"));

    await writeFile(path.join(ws, "source.md"), "[[note]]", "utf8");
    await writeFile(path.join(ws, "new-cardFolder", "note.md"), "", "utf8");

    await updateLinksForCardFolderRename(ws, "old-cardFolder", "new-cardFolder");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[note]]");
  });

  it("コードブロック内のリンクは更新しない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "new-cardFolder"));

    const original = "```\n[[old-cardFolder/note]]\n```";
    await writeFile(path.join(ws, "source.md"), original, "utf8");
    await writeFile(path.join(ws, "new-cardFolder", "note.md"), "", "utf8");

    await updateLinksForCardFolderRename(ws, "old-cardFolder", "new-cardFolder");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe(original);
  });
});
