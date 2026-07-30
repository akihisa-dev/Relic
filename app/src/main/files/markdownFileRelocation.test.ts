import { link, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createTranslator } from "../../shared/i18n";

import {
  duplicateMarkdownFile,
  moveMarkdownFile,
  renameMarkdownFile
} from "./markdownFileRelocation";
import { createCopyNameFormatter } from "./markdownFilePaths";
import { createRealpathRaceOperations } from "./test/markdownFileTestUtils";

describe("renameMarkdownFile", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("隠しMarkdown名へのリネームを副作用なく拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    temporaryPaths.push(workspacePath);
    const beforePath = path.join(workspacePath, "before.md");
    await writeFile(beforePath, "content", "utf8");

    await expect(renameMarkdownFile(workspacePath, "before.md", ".note.md")).resolves.toMatchObject({
      error: { code: "FILE_NAME_HIDDEN" },
      ok: false
    });
    await expect(readFile(beforePath, "utf8")).resolves.toBe("content");
    await expect(readFile(path.join(workspacePath, ".note.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("Markdownファイル名を変更する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "before.md"), "# Before", "utf8");

    await expect(renameMarkdownFile(workspacePath, "before.md", "after")).resolves.toEqual({
      ok: true,
      value: {
        file: {
          content: "# Before",
          name: "after",
          path: "after.md"
        },
        status: "completed"
      }
    });
    await expect(readFile(path.join(workspacePath, "after.md"), "utf8")).resolves.toBe("# Before");
  });

  it("リネーム時に内部リンクも更新する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "before.md"), "# Before", "utf8");
    await writeFile(path.join(workspacePath, "source.md"), "[[before]]", "utf8");

    await expect(renameMarkdownFile(workspacePath, "before.md", "after")).resolves.toMatchObject({
      ok: true
    });
    await expect(readFile(path.join(workspacePath, "source.md"), "utf8")).resolves.toBe("[[after]]");
  });

  it("移動先が同じ実体を指す場合は一時名を経由してMarkdownファイル名を変更する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "before.md"), "# Before", "utf8");
    await link(path.join(workspacePath, "before.md"), path.join(workspacePath, "after.md"));

    await expect(renameMarkdownFile(workspacePath, "before.md", "after")).resolves.toEqual({
      ok: true,
      value: {
        file: {
          content: "# Before",
          name: "after",
          path: "after.md"
        },
        status: "completed"
      }
    });
    await expect(readFile(path.join(workspacePath, "after.md"), "utf8")).resolves.toBe("# Before");
    await expect(readFile(path.join(workspacePath, "before.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("同名ファイルがある場合は上書きしない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "before.md"), "before", "utf8");
    await writeFile(path.join(workspacePath, "after.md"), "after", "utf8");

    const result = await renameMarkdownFile(workspacePath, "before.md", "after");

    expect(result.ok).toBe(false);
    await expect(readFile(path.join(workspacePath, "before.md"), "utf8")).resolves.toBe("before");
    await expect(readFile(path.join(workspacePath, "after.md"), "utf8")).resolves.toBe("after");
  });

  it("Markdown以外とワークスペース外への参照を拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    temporaryPaths.push(workspacePath);

    await expect(renameMarkdownFile(workspacePath, "image.png", "image2")).resolves.toMatchObject({
      ok: false
    });
    await expect(renameMarkdownFile(workspacePath, "../outside.md", "inside")).resolves.toMatchObject({
      ok: false
    });
  });

  it("シンボリックリンク経由で実体がワークスペース外のMarkdownリネームを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);

    await writeFile(path.join(outsidePath, "outside.md"), "outside", "utf8");
    await symlink(path.join(outsidePath, "outside.md"), path.join(workspacePath, "linked.md"));

    await expect(renameMarkdownFile(workspacePath, "linked.md", "renamed")).resolves.toMatchObject({
      ok: false
    });
    await expect(readFile(path.join(outsidePath, "outside.md"), "utf8")).resolves.toBe("outside");
  });

  it("検証後に実体がワークスペース外へ変わったMarkdownリネームを直前再確認で拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);
    const notePath = path.join(workspacePath, "note.md");

    await writeFile(notePath, "# Note", "utf8");

    await expect(renameMarkdownFile(workspacePath, "note.md", "renamed", createRealpathRaceOperations({
      changingPath: notePath,
      safeRealPath: notePath,
      unsafeRealPath: path.join(outsidePath, "note.md"),
      workspacePath
    }))).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readFile(notePath, "utf8")).resolves.toBe("# Note");
  });
});

describe("duplicateMarkdownFile", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("同じフォルダにMarkdownファイルを複製する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-duplicate-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "読書メモ.md"), "# 読書メモ", "utf8");

    await expect(duplicateMarkdownFile(workspacePath, "読書メモ.md")).resolves.toEqual({
      ok: true,
      value: {
        content: "# 読書メモ",
        name: "読書メモ のコピー",
        path: "読書メモ のコピー.md"
      }
    });
    await expect(readFile(path.join(workspacePath, "読書メモ のコピー.md"), "utf8")).resolves.toBe(
      "# 読書メモ"
    );
    expect((await readdir(workspacePath)).sort()).toEqual(["読書メモ のコピー.md", "読書メモ.md"]);
  });

  it("英語UI向けの複製名でも元のファイル名を保持する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-duplicate-file-en-"));
    temporaryPaths.push(workspacePath);
    const t = createTranslator("en");

    await writeFile(path.join(workspacePath, "読書メモ.md"), "# Note", "utf8");

    const result = await duplicateMarkdownFile(
      workspacePath,
      "読書メモ.md",
      {},
      createCopyNameFormatter(t)
    );

    expect(result).toMatchObject({ ok: true, value: { path: "読書メモ copy.md" } });
    await expect(readFile(path.join(workspacePath, "読書メモ copy.md"), "utf8")).resolves.toBe("# Note");
  });

  it("コピー名が既にある場合は連番で複製する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-duplicate-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "読書メモ.md"), "original", "utf8");
    await writeFile(path.join(workspacePath, "読書メモ のコピー.md"), "copy", "utf8");

    await expect(duplicateMarkdownFile(workspacePath, "読書メモ.md")).resolves.toMatchObject({
      ok: true,
      value: {
        path: "読書メモ のコピー 2.md"
      }
    });
  });

  it("Markdown以外とワークスペース外への参照を拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-duplicate-file-"));
    temporaryPaths.push(workspacePath);

    await expect(duplicateMarkdownFile(workspacePath, "image.png")).resolves.toMatchObject({
      ok: false
    });
    await expect(duplicateMarkdownFile(workspacePath, "../outside.md")).resolves.toMatchObject({
      ok: false
    });
  });

  it("検証後に実体がワークスペース外へ変わったMarkdown複製を直前再確認で拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-duplicate-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);
    const notePath = path.join(workspacePath, "note.md");

    await writeFile(notePath, "# Note", "utf8");

    await expect(duplicateMarkdownFile(workspacePath, "note.md", createRealpathRaceOperations({
      changingPath: notePath,
      safeRealPath: notePath,
      unsafeRealPath: path.join(outsidePath, "note.md"),
      workspacePath
    }))).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readdir(workspacePath)).resolves.toEqual(["note.md"]);
  });
});

describe("moveMarkdownFile", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("Markdownファイルを別フォルダへ移動する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "note.md"), "# Note", "utf8");

    await expect(moveMarkdownFile(workspacePath, "note.md", "archive")).resolves.toEqual({
      ok: true,
      value: {
        file: {
          content: "# Note",
          name: "note",
          path: "archive/note.md"
        },
        status: "completed"
      }
    });
    await expect(readFile(path.join(workspacePath, "archive/note.md"), "utf8")).resolves.toBe("# Note");
  });

  it("別フォルダへの移動時に内部リンクをパス付きリンクへ更新する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "note.md"), "# Note", "utf8");
    await writeFile(path.join(workspacePath, "source.md"), "[[note]]", "utf8");

    await expect(moveMarkdownFile(workspacePath, "note.md", "archive")).resolves.toMatchObject({
      ok: true
    });
    await expect(readFile(path.join(workspacePath, "source.md"), "utf8")).resolves.toBe(
      "[[archive/note]]"
    );
  });

  it("別フォルダへ移動したファイル内の basename-only リンクの意味を維持する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "note.md"), "[[target]]", "utf8");
    await writeFile(path.join(workspacePath, "target.md"), "", "utf8");

    await expect(moveMarkdownFile(workspacePath, "note.md", "archive")).resolves.toMatchObject({
      ok: true
    });
    await expect(readFile(path.join(workspacePath, "archive", "note.md"), "utf8")).resolves.toBe("[[../target]]");
  });

  it("リンク更新失敗時にファイルと適用済みリンクを戻し、安全に再試行できる", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-rollback-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "note.md"), "# Note", "utf8");

    const failed = await moveMarkdownFile(workspacePath, "note.md", "archive", {}, {
      prepareLinks: async () => ({
        ok: true,
        value: {
          apply: async () => ({
            error: { code: "LINK_UPDATE_WRITE_FAILED", message: "failed" },
            ok: false,
            recovery: {
              appliedPaths: ["source.md"],
              conflictedPaths: [],
              rolledBackPaths: ["source.md"],
              rollbackFailedPaths: []
            }
          })
        }
      })
    });

    expect(failed).toEqual({
      ok: true,
      value: {
        recovery: {
          currentPath: "note.md",
          fileRollback: "succeeded",
          linkUpdates: {
            appliedPaths: ["source.md"],
            conflictedPaths: [],
            rolledBackPaths: ["source.md"],
            rollbackFailedPaths: []
          },
          newPath: "archive/note.md",
          oldPath: "note.md",
          reasonCode: "LINK_UPDATE_WRITE_FAILED"
        },
        status: "rolled-back"
      }
    });
    await expect(readFile(path.join(workspacePath, "note.md"), "utf8")).resolves.toBe("# Note");
    await expect(readFile(path.join(workspacePath, "archive", "note.md"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });

    await expect(moveMarkdownFile(workspacePath, "note.md", "archive")).resolves.toMatchObject({
      ok: true,
      value: { status: "completed" }
    });
  });

  it("リンク更新計画を確定できない場合はファイル本体を移動しない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-plan-failed-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "note.md"), "# Note", "utf8");

    const result = await moveMarkdownFile(workspacePath, "note.md", "archive", {}, {
      prepareLinks: async () => ({
        error: { code: "LINK_UPDATE_READ_FAILED", message: "failed" },
        ok: false
      })
    });

    expect(result).toMatchObject({
      error: { code: "LINK_UPDATE_READ_FAILED" },
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "note.md"), "utf8")).resolves.toBe("# Note");
    await expect(readFile(path.join(workspacePath, "archive", "note.md"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("リンク更新計画の確定中に対象ファイルが外部変更された場合は移動しない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-plan-conflict-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "archive"));
    const notePath = path.join(workspacePath, "note.md");
    await writeFile(notePath, "# Before", "utf8");

    const result = await moveMarkdownFile(workspacePath, "note.md", "archive", {}, {
      prepareLinks: async () => {
        await writeFile(notePath, "# External", "utf8");
        return {
          ok: true,
          value: { apply: async () => ({ ok: true, value: undefined }) }
        };
      }
    });

    expect(result).toMatchObject({
      error: { code: "FILE_RELOCATION_CONFLICT" },
      ok: false
    });
    await expect(readFile(notePath, "utf8")).resolves.toBe("# External");
    await expect(readFile(path.join(workspacePath, "archive", "note.md"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("ファイル本体を元へ戻せない場合は現在位置と未復旧リンクを返す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-recovery-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "note.md"), "# Note", "utf8");

    const result = await moveMarkdownFile(workspacePath, "note.md", "archive", {}, {
      rollbackFile: async () => {
        throw new Error("rollback failed");
      },
      prepareLinks: async () => ({
        ok: true,
        value: {
          apply: async () => ({
            error: { code: "LINK_UPDATE_WRITE_FAILED", message: "failed" },
            ok: false,
            recovery: {
              appliedPaths: ["source.md"],
              conflictedPaths: [],
              rolledBackPaths: [],
              rollbackFailedPaths: ["source.md"]
            }
          })
        }
      })
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        recovery: {
          currentPath: "archive/note.md",
          fileRollback: "failed",
          linkUpdates: {
            appliedPaths: ["source.md"],
            rollbackFailedPaths: ["source.md"]
          },
          newPath: "archive/note.md",
          oldPath: "note.md"
        },
        status: "recovery-required"
      }
    });
    await expect(readFile(path.join(workspacePath, "archive", "note.md"), "utf8")).resolves.toBe("# Note");
  });

  it("ロールバック前に元パスが外部作成された場合は上書きしない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-rollback-conflict-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "archive"));
    const oldPath = path.join(workspacePath, "note.md");
    const newPath = path.join(workspacePath, "archive", "note.md");
    await writeFile(oldPath, "# Original", "utf8");

    const result = await moveMarkdownFile(workspacePath, "note.md", "archive", {}, {
      prepareLinks: async () => ({
        ok: true,
        value: {
          apply: async () => {
            await writeFile(oldPath, "# External", "utf8");
            return {
              error: { code: "LINK_UPDATE_WRITE_FAILED", message: "failed" },
              ok: false,
              recovery: {
                appliedPaths: [],
                conflictedPaths: [],
                rolledBackPaths: [],
                rollbackFailedPaths: []
              }
            };
          }
        }
      })
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        recovery: {
          currentPath: null,
          fileRollback: "failed"
        },
        status: "recovery-required"
      }
    });
    await expect(readFile(oldPath, "utf8")).resolves.toBe("# External");
    await expect(readFile(newPath, "utf8")).resolves.toBe("# Original");
  });

  it("移動とリンク更新後の最終読み込み失敗を実際の変更失敗として扱わない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-final-read-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "note.md"), "# Note", "utf8");
    await writeFile(path.join(workspacePath, "source.md"), "[[note]]", "utf8");

    const result = await moveMarkdownFile(workspacePath, "note.md", "archive", {}, {
      readFinalFile: async () => ({
        error: { code: "FILE_READ_FAILED", message: "failed" },
        ok: false
      })
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        file: { path: "archive/note.md" },
        status: "completed"
      }
    });
    await expect(readFile(path.join(workspacePath, "source.md"), "utf8"))
      .resolves.toBe("[[archive/note]]");
  });

  it("移動先に同名ファイルがある場合は上書きしない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "note.md"), "source", "utf8");
    await writeFile(path.join(workspacePath, "archive/note.md"), "existing", "utf8");

    await expect(moveMarkdownFile(workspacePath, "note.md", "archive")).resolves.toMatchObject({
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "note.md"), "utf8")).resolves.toBe("source");
    await expect(readFile(path.join(workspacePath, "archive/note.md"), "utf8")).resolves.toBe("existing");
  });

  it("ワークスペース外の移動先フォルダを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "note.md"), "# Note", "utf8");

    await expect(moveMarkdownFile(workspacePath, "note.md", "../outside")).resolves.toMatchObject({
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "note.md"), "utf8")).resolves.toBe("# Note");
  });

  it("シンボリックリンク経由で実体がワークスペース外のMarkdown移動を拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);

    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(outsidePath, "outside.md"), "outside", "utf8");
    await symlink(path.join(outsidePath, "outside.md"), path.join(workspacePath, "linked.md"));

    await expect(moveMarkdownFile(workspacePath, "linked.md", "archive")).resolves.toMatchObject({
      ok: false
    });
    await expect(readFile(path.join(outsidePath, "outside.md"), "utf8")).resolves.toBe("outside");
  });

  it("検証後に実体がワークスペース外へ変わったMarkdown移動を直前再確認で拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);
    const notePath = path.join(workspacePath, "note.md");

    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(notePath, "# Note", "utf8");

    await expect(moveMarkdownFile(workspacePath, "note.md", "archive", createRealpathRaceOperations({
      changingPath: notePath,
      safeRealPath: notePath,
      unsafeRealPath: path.join(outsidePath, "note.md"),
      workspacePath
    }))).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readFile(notePath, "utf8")).resolves.toBe("# Note");
  });
});
