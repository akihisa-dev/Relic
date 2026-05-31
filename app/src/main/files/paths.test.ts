import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  isWorkspaceRelativeInputPath,
  isWorkspaceRelativeInputPathOrRoot,
  normalizeWorkspaceRelativeInputPath,
  resolveNewWorkspacePath,
  resolveWorkspaceRelativePath,
  resolveWorkspaceRelativePathOrRoot,
  toWorkspaceRelativePath
} from "./paths";

describe("workspace relative input paths", () => {
  it("保存済み設定向けにワークスペース相対パスを正規化する", () => {
    expect(normalizeWorkspaceRelativeInputPath(" notes\\idea.md ")).toBe("notes/idea.md");
    expect(normalizeWorkspaceRelativeInputPath("section/../notes/idea.md")).toBe("notes/idea.md");
    expect(normalizeWorkspaceRelativeInputPath("../outside.md")).toBeNull();
    expect(normalizeWorkspaceRelativeInputPath("/tmp/outside.md")).toBeNull();
    expect(normalizeWorkspaceRelativeInputPath("C:\\Users\\test\\outside.md")).toBeNull();
    expect(normalizeWorkspaceRelativeInputPath("note.md\0outside")).toBeNull();
    expect(normalizeWorkspaceRelativeInputPath(".")).toBeNull();
  });

  it("IPC入力向けに正規化済みのワークスペース相対パスだけを許可する", () => {
    expect(isWorkspaceRelativeInputPath("notes/idea.md")).toBe(true);
    expect(isWorkspaceRelativeInputPath("notes\\idea.md")).toBe(false);
    expect(isWorkspaceRelativeInputPath(" notes/idea.md ")).toBe(false);
    expect(isWorkspaceRelativeInputPath("section/../notes/idea.md")).toBe(false);
    expect(isWorkspaceRelativeInputPath("../outside.md")).toBe(false);
    expect(isWorkspaceRelativeInputPath("/tmp/outside.md")).toBe(false);
    expect(isWorkspaceRelativeInputPath("C:\\outside.md")).toBe(false);
    expect(isWorkspaceRelativeInputPath("note.md\0outside")).toBe(false);
  });

  it("ルート指定を許す入力では空文字か正規化済み相対パスだけを許可する", () => {
    expect(isWorkspaceRelativeInputPathOrRoot("")).toBe(true);
    expect(isWorkspaceRelativeInputPathOrRoot("notes")).toBe(true);
    expect(isWorkspaceRelativeInputPathOrRoot(".")).toBe(false);
    expect(isWorkspaceRelativeInputPathOrRoot("../outside")).toBe(false);
    expect(isWorkspaceRelativeInputPathOrRoot(" notes ")).toBe(false);
  });
});

describe("resolveWorkspaceRelativePath", () => {
  it("ワークスペース内の相対パスを絶対パスへ解決する", () => {
    expect(resolveWorkspaceRelativePath("/tmp/relic-notes", "notes/idea.md")).toEqual({
      ok: true,
      value: path.join("/tmp/relic-notes", "notes", "idea.md")
    });
  });

  it("絶対パスとワークスペース外への参照を拒否する", () => {
    expect(resolveWorkspaceRelativePath("/tmp/relic-notes", "/tmp/other.md").ok).toBe(false);
    expect(resolveWorkspaceRelativePath("/tmp/relic-notes", "C:\\Users\\test\\note.md").ok).toBe(false);
    expect(resolveWorkspaceRelativePath("/tmp/relic-notes", "\\\\server\\share\\note.md").ok).toBe(false);
    expect(resolveWorkspaceRelativePath("/tmp/relic-notes", "../other.md").ok).toBe(false);
    expect(resolveWorkspaceRelativePath("/tmp/relic-notes", "note.md\0outside").ok).toBe(false);
  });
});

describe("resolveWorkspaceRelativePathOrRoot", () => {
  it("空文字とドットをワークスペース直下として扱う", () => {
    expect(resolveWorkspaceRelativePathOrRoot("/tmp/relic-notes", "")).toEqual({
      ok: true,
      value: "/tmp/relic-notes"
    });
    expect(resolveWorkspaceRelativePathOrRoot("/tmp/relic-notes", ".")).toEqual({
      ok: true,
      value: "/tmp/relic-notes"
    });
  });

  it("ワークスペース外への参照は拒否する", () => {
    expect(resolveWorkspaceRelativePathOrRoot("/tmp/relic-notes", "../other").ok).toBe(false);
    expect(resolveWorkspaceRelativePathOrRoot("/tmp/relic-notes", "/tmp/other").ok).toBe(false);
  });
});

describe("resolveNewWorkspacePath", () => {
  it("存在しない親フォルダは既存の親までたどって許可する", async () => {
    const workspacePath = path.join("/tmp", "relic-notes");

    await expect(resolveNewWorkspacePath(workspacePath, "missing/note.md", {
      async realpath(filePath) {
        if (filePath === workspacePath) return workspacePath;
        throw Object.assign(new Error("Not found"), { code: "ENOENT" });
      }
    })).resolves.toEqual({
      ok: true,
      value: path.join(workspacePath, "missing", "note.md")
    });
  });

  it("親フォルダの実体確認が権限エラーの場合は安全側で拒否する", async () => {
    const workspacePath = path.join("/tmp", "relic-notes");
    const blockedPath = path.join(workspacePath, "blocked");

    await expect(resolveNewWorkspacePath(workspacePath, "blocked/note.md", {
      async realpath(filePath) {
        if (filePath === workspacePath) return workspacePath;
        if (filePath === blockedPath) {
          throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
        }
        throw Object.assign(new Error("Not found"), { code: "ENOENT" });
      }
    })).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_INVALID" },
      ok: false
    });
  });
});

describe("toWorkspaceRelativePath", () => {
  it("OS のパス区切りをワークスペース相対パスの区切りへ正規化する", () => {
    expect(toWorkspaceRelativePath(path.join("notes", "idea.md"))).toBe("notes/idea.md");
  });
});
