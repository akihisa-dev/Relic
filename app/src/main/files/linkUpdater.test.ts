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

  it("Windows風の区切りが混ざった更新元パスでもパス付きリンクを更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "folder"));

    await writeFile(path.join(ws, "source.md"), "[[folder/old]]", "utf8");
    await writeFile(path.join(ws, "folder", "new.md"), "", "utf8");

    await updateLinksForFileRename(ws, "folder\\old.md", "folder\\new.md");

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

  it("inline code、tilde fence、字下げコード内のファイルリンクは更新しない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    const original = [
      "[[old]]",
      "`[[old]]` は記法例",
      "~~~md",
      "[[old]]",
      "~~~",
      "    [[old]]"
    ].join("\n");
    await writeFile(path.join(ws, "source.md"), original, "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    await updateLinksForFileRename(ws, "old.md", "new.md");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe([
      "[[new]]",
      "`[[old]]` は記法例",
      "~~~md",
      "[[old]]",
      "~~~",
      "    [[old]]"
    ].join("\n"));
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
        linkCount: 1,
        unreadableFileCount: 0
      }
    });
  });

  it("影響確認では読めないMarkdownファイルをスキップして件数を返す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "blocked.md"), "[[old]]", "utf8");
    await writeFile(path.join(ws, "visible.md"), "[[old]]", "utf8");

    await expect(
      readLinkUpdateImpact(ws, "file", "old.md", "new.md", {
        async readFile(filePath, encoding) {
          if (path.basename(filePath) === "blocked.md") {
            throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
          }

          return readFile(filePath, encoding);
        }
      })
    ).resolves.toEqual({
      ok: true,
      value: {
        fileCount: 1,
        linkCount: 1,
        unreadableFileCount: 1
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

  it("type: mapはDiagramとして扱わずNode参照更新で上書きしない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-map-invalid-"));
    temporaryPaths.push(ws);

    const original = "type: map\n\nnotes: body";
    await writeFile(path.join(ws, "map.md"), original, "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    const result = await updateLinksForFileRename(ws, "old.md", "new.md");

    expect(result.ok).toBe(true);
    await expect(readFile(path.join(ws, "map.md"), "utf8")).resolves.toBe(original);
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

  it("リンク更新対象が読み込み後に外部変更された場合は上書きしない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-conflict-"));
    temporaryPaths.push(ws);
    const sourcePath = path.join(ws, "source.md");

    await writeFile(sourcePath, "[[old]]", "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    let sourceReadCount = 0;
    const result = await updateLinksForFileRename(ws, "old.md", "new.md", {
      async readFile(filePath, encoding) {
        const content = await readFile(filePath, encoding);
        if (filePath === sourcePath) {
          sourceReadCount += 1;
        }
        if (filePath === sourcePath && sourceReadCount === 1) {
          await writeFile(sourcePath, "外部変更 [[old]]", "utf8");
        }
        return content;
      },
      async writeTextFile(filePath, content) {
        await writeFile(filePath, content, "utf8");
      }
    });

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "LINK_UPDATE_CONFLICT" }),
      ok: false
    });
    await expect(readFile(sourcePath, "utf8")).resolves.toBe("外部変更 [[old]]");
  });

  it("複数ファイルのリンク更新中に競合した場合は適用済みファイルを元に戻す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-conflict-rollback-"));
    temporaryPaths.push(ws);
    const alphaPath = path.join(ws, "alpha.md");
    const betaPath = path.join(ws, "beta.md");

    await writeFile(alphaPath, "[[old]]", "utf8");
    await writeFile(betaPath, "[[old]]", "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    const result = await updateLinksForFileRename(ws, "old.md", "new.md", {
      readFile,
      async writeTextFile(filePath, content) {
        await writeFile(filePath, content, "utf8");
        if (filePath === alphaPath) {
          await writeFile(betaPath, "外部変更 [[old]]", "utf8");
        }
      }
    });

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "LINK_UPDATE_CONFLICT" }),
      ok: false
    });
    await expect(readFile(alphaPath, "utf8")).resolves.toBe("[[old]]");
    await expect(readFile(betaPath, "utf8")).resolves.toBe("外部変更 [[old]]");
  });

  it("ロールバック対象が外部変更済みの場合は古い内容で上書きしない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-rollback-conflict-"));
    temporaryPaths.push(ws);
    const firstPath = path.join(ws, "first.md");
    const secondPath = path.join(ws, "second.md");

    await writeFile(firstPath, "[[old]]", "utf8");
    await writeFile(secondPath, "[[old]]", "utf8");
    await writeFile(path.join(ws, "new.md"), "", "utf8");

    let writeCount = 0;
    const result = await updateLinksForFileRename(ws, "old.md", "new.md", {
      readFile,
      async writeTextFile(filePath, content) {
        writeCount += 1;
        if (writeCount === 2) throw new Error("disk full");

        await writeFile(filePath, content, "utf8");
        await writeFile(filePath, "外部変更 [[new]]", "utf8");
      }
    });

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "LINK_UPDATE_WRITE_FAILED" }),
      ok: false
    });
    await expect(readFile(firstPath, "utf8")).resolves.toBe("外部変更 [[new]]");
    await expect(readFile(secondPath, "utf8")).resolves.toBe("[[old]]");
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

  it("Windows風の区切りが混ざったフォルダパスでもリンクをスラッシュ区切りで更新する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "new-folder"));

    await writeFile(path.join(ws, "source.md"), "[[old-folder/note]]", "utf8");
    await writeFile(path.join(ws, "new-folder", "note.md"), "", "utf8");

    await updateLinksForFolderRename(ws, "old-folder", "new-folder\\child");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe("[[new-folder/child/note]]");
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

  it("inline code、tilde fence、字下げコード内のフォルダリンクは更新しない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "new-folder"));

    const original = [
      "[[old-folder/note]]",
      "`[[old-folder/note]]` は記法例",
      "~~~md",
      "[[old-folder/note]]",
      "~~~",
      "    [[old-folder/note]]"
    ].join("\n");
    await writeFile(path.join(ws, "source.md"), original, "utf8");
    await writeFile(path.join(ws, "new-folder", "note.md"), "", "utf8");

    await updateLinksForFolderRename(ws, "old-folder", "new-folder");

    await expect(readFile(path.join(ws, "source.md"), "utf8")).resolves.toBe([
      "[[new-folder/note]]",
      "`[[old-folder/note]]` は記法例",
      "~~~md",
      "[[old-folder/note]]",
      "~~~",
      "    [[old-folder/note]]"
    ].join("\n"));
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

  it("複数ファイルのフォルダリンク更新中に競合した場合は適用済みファイルを元に戻す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-link-updater-folder-conflict-rollback-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "new-folder"));
    const alphaPath = path.join(ws, "alpha.md");
    const betaPath = path.join(ws, "beta.md");

    await writeFile(alphaPath, "[[old-folder/note]]", "utf8");
    await writeFile(betaPath, "[[old-folder/note]]", "utf8");
    await writeFile(path.join(ws, "new-folder", "note.md"), "", "utf8");

    const result = await updateLinksForFolderRename(ws, "old-folder", "new-folder", {
      readFile,
      async writeTextFile(filePath, content) {
        await writeFile(filePath, content, "utf8");
        if (filePath === alphaPath) {
          await writeFile(betaPath, "外部変更 [[old-folder/note]]", "utf8");
        }
      }
    });

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "LINK_UPDATE_CONFLICT" }),
      ok: false
    });
    await expect(readFile(alphaPath, "utf8")).resolves.toBe("[[old-folder/note]]");
    await expect(readFile(betaPath, "utf8")).resolves.toBe("外部変更 [[old-folder/note]]");
  });
});
