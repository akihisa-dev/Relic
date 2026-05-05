import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createGitBranch,
  createGitCommit,
  createGitTag,
  deleteGitTag,
  initializeGitRepository,
  readGitCommitDiff,
  readGitBranches,
  readGitCommitHistory,
  readGitStatus,
  readGitTags,
  readGitWorkingChanges,
  switchGitBranch
} from "./git";

describe("git", () => {
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

  it("未初期化ワークスペースでは initialized=false を返す", async () => {
    const workspacePath = await createWorkspace();

    await expect(readGitStatus(workspacePath)).resolves.toEqual({
      ok: true,
      value: {
        currentBranch: null,
        initialized: false
      }
    });
  });

  it("ワークスペースを Git 初期化できる", async () => {
    const workspacePath = await createWorkspace();

    await expect(initializeGitRepository(workspacePath)).resolves.toEqual({
      ok: true,
      value: {
        currentBranch: "main",
        initialized: true
      }
    });
  });

  it("すでに初期化済みなら再初期化しない", async () => {
    const workspacePath = await createWorkspace();

    await initializeGitRepository(workspacePath);

    await expect(initializeGitRepository(workspacePath)).resolves.toMatchObject({
      ok: false,
      error: { code: "GIT_ALREADY_INITIALIZED" }
    });
  });

  it("未追跡と変更済みファイルを変更一覧として返す", async () => {
    const workspacePath = await createWorkspace();
    await initializeGitRepository(workspacePath);
    await writeFile(path.join(workspacePath, "note.md"), "first", "utf8");

    await expect(readGitWorkingChanges(workspacePath)).resolves.toEqual({
      ok: true,
      value: [{ path: "note.md", status: "untracked" }]
    });
  });

  it("ローカルコミットを作成して履歴を読める", async () => {
    const workspacePath = await createWorkspace();
    await initializeGitRepository(workspacePath);
    await writeFile(path.join(workspacePath, "note.md"), "hello", "utf8");

    const commitResult = await createGitCommit(workspacePath, {
      authorEmail: "test@example.com",
      authorName: "Test User",
      message: "Initial commit"
    });

    expect(commitResult).toMatchObject({
      ok: true,
      value: {
        author: "Test User",
        changedFiles: ["note.md"],
        message: "Initial commit"
      }
    });

    const history = await readGitCommitHistory(workspacePath);

    expect(history).toMatchObject({
      ok: true,
      value: [
        {
          author: "Test User",
          message: "Initial commit"
        }
      ]
    });
  });

  it("削除ファイルもコミットできる", async () => {
    const workspacePath = await createWorkspace();
    await initializeGitRepository(workspacePath);
    const notePath = path.join(workspacePath, "note.md");
    await writeFile(notePath, "hello", "utf8");
    await createGitCommit(workspacePath, {
      authorEmail: "test@example.com",
      authorName: "Test User",
      message: "Initial commit"
    });

    await unlink(notePath);

    const deleteCommit = await createGitCommit(workspacePath, {
      authorEmail: "test@example.com",
      authorName: "Test User",
      message: "Delete note"
    });

    expect(deleteCommit).toMatchObject({
      ok: true,
      value: {
        changedFiles: ["note.md"],
        message: "Delete note"
      }
    });

    await expect(readFile(notePath, "utf8")).rejects.toBeTruthy();
  });

  it("コミット差分で before / after を返す", async () => {
    const workspacePath = await createWorkspace();
    await initializeGitRepository(workspacePath);
    const notePath = path.join(workspacePath, "note.md");
    await writeFile(notePath, "v1", "utf8");
    await createGitCommit(workspacePath, {
      authorEmail: "test@example.com",
      authorName: "Test User",
      message: "Initial commit"
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await writeFile(notePath, "v2", "utf8");

    const secondCommit = await createGitCommit(workspacePath, {
      authorEmail: "test@example.com",
      authorName: "Test User",
      message: "Update note"
    });

    if (!secondCommit.ok) {
      throw new Error("second commit failed");
    }

    const diff = await readGitCommitDiff(workspacePath, secondCommit.value.hash);

    expect(diff).toMatchObject({
      ok: true,
      value: {
        commit: {
          message: "Update note"
        },
        entries: [
          {
            after: "v2",
            before: "v1",
            path: "note.md",
            status: "modified"
          }
        ]
      }
    });
  });

  it("ブランチを作成して一覧に出せる", async () => {
    const workspacePath = await createWorkspace();
    await initializeGitRepository(workspacePath);
    await writeFile(path.join(workspacePath, "note.md"), "hello", "utf8");
    await createGitCommit(workspacePath, {
      authorEmail: "test@example.com",
      authorName: "Test User",
      message: "Initial commit"
    });

    const result = await createGitBranch(workspacePath, { name: "feature/test" });

    expect(result).toMatchObject({
      ok: true,
      value: [
        { isCurrent: false, name: "feature/test" },
        { isCurrent: true, name: "main" }
      ]
    });
  });

  it("未コミット変更があると切り替え確認を要求する", async () => {
    const workspacePath = await createWorkspace();
    await initializeGitRepository(workspacePath);
    await writeFile(path.join(workspacePath, "note.md"), "hello", "utf8");
    await createGitCommit(workspacePath, {
      authorEmail: "test@example.com",
      authorName: "Test User",
      message: "Initial commit"
    });
    await createGitBranch(workspacePath, { name: "feature/test" });
    await writeFile(path.join(workspacePath, "note.md"), "draft", "utf8");

    await expect(switchGitBranch(workspacePath, { name: "feature/test" })).resolves.toMatchObject({
      ok: false,
      error: { code: "GIT_BRANCH_SWITCH_DIRTY" }
    });
  });

  it("allowDirty=true なら変更を残したまま切り替えを試みる", async () => {
    const workspacePath = await createWorkspace();
    await initializeGitRepository(workspacePath);
    await writeFile(path.join(workspacePath, "note.md"), "hello", "utf8");
    await createGitCommit(workspacePath, {
      authorEmail: "test@example.com",
      authorName: "Test User",
      message: "Initial commit"
    });
    await createGitBranch(workspacePath, { name: "feature/test" });
    await writeFile(path.join(workspacePath, "note.md"), "draft", "utf8");

    const switched = await switchGitBranch(workspacePath, {
      allowDirty: true,
      name: "feature/test"
    });

    expect(switched).toMatchObject({
      ok: true
    });

    const branches = await readGitBranches(workspacePath);

    expect(branches).toMatchObject({
      ok: true,
      value: expect.arrayContaining([{ isCurrent: true, name: "feature/test" }])
    });
  });

  it("軽量タグを作成して一覧できる", async () => {
    const workspacePath = await createWorkspace();
    await initializeGitRepository(workspacePath);
    await writeFile(path.join(workspacePath, "note.md"), "hello", "utf8");

    const commit = await createGitCommit(workspacePath, {
      authorEmail: "test@example.com",
      authorName: "Test User",
      message: "Initial commit"
    });

    if (!commit.ok) {
      throw new Error("commit failed");
    }

    const tagged = await createGitTag(workspacePath, {
      hash: commit.value.hash,
      name: "v0.1.0"
    });

    expect(tagged).toMatchObject({
      ok: true,
      value: [
        {
          annotated: false,
          message: null,
          name: "v0.1.0",
          targetHash: commit.value.hash,
          targetMessage: "Initial commit"
        }
      ]
    });
  });

  it("メモ付きの注釈タグを作成できる", async () => {
    const workspacePath = await createWorkspace();
    await initializeGitRepository(workspacePath);
    await writeFile(path.join(workspacePath, "note.md"), "hello", "utf8");

    const commit = await createGitCommit(workspacePath, {
      authorEmail: "test@example.com",
      authorName: "Test User",
      message: "Initial commit"
    });

    if (!commit.ok) {
      throw new Error("commit failed");
    }

    const tagged = await createGitTag(workspacePath, {
      hash: commit.value.hash,
      message: "first release",
      name: "v1.0.0",
      taggerEmail: "test@example.com",
      taggerName: "Test User"
    });

    expect(tagged).toMatchObject({
      ok: true,
      value: [
        {
          annotated: true,
          message: "first release",
          name: "v1.0.0",
          targetHash: commit.value.hash,
          targetMessage: "Initial commit"
        }
      ]
    });
  });

  it("タグを削除できる", async () => {
    const workspacePath = await createWorkspace();
    await initializeGitRepository(workspacePath);
    await writeFile(path.join(workspacePath, "note.md"), "hello", "utf8");
    await createGitCommit(workspacePath, {
      authorEmail: "test@example.com",
      authorName: "Test User",
      message: "Initial commit"
    });
    await createGitTag(workspacePath, { name: "v0.1.0" });

    const deleted = await deleteGitTag(workspacePath, { name: "v0.1.0" });

    expect(deleted).toEqual({ ok: true, value: [] });
    await expect(readGitTags(workspacePath)).resolves.toEqual({ ok: true, value: [] });
  });

  async function createWorkspace(): Promise<string> {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-git-"));
    temporaryPaths.push(workspacePath);

    return workspacePath;
  }
});
