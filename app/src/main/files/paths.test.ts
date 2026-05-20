import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  resolveWorkspaceRelativePath,
  resolveWorkspaceRelativePathOrRoot,
  toWorkspaceRelativePath
} from "./paths";

describe("resolveWorkspaceRelativePath", () => {
  it("カードブック内の相対パスを絶対パスへ解決する", () => {
    expect(resolveWorkspaceRelativePath("/tmp/relic-notes", "notes/idea.md")).toEqual({
      ok: true,
      value: path.join("/tmp/relic-notes", "notes", "idea.md")
    });
  });

  it("絶対パスとカードブック外への参照を拒否する", () => {
    expect(resolveWorkspaceRelativePath("/tmp/relic-notes", "/tmp/other.md").ok).toBe(false);
    expect(resolveWorkspaceRelativePath("/tmp/relic-notes", "C:\\Users\\test\\note.md").ok).toBe(false);
    expect(resolveWorkspaceRelativePath("/tmp/relic-notes", "\\\\server\\share\\note.md").ok).toBe(false);
    expect(resolveWorkspaceRelativePath("/tmp/relic-notes", "../other.md").ok).toBe(false);
  });
});

describe("resolveWorkspaceRelativePathOrRoot", () => {
  it("空文字とドットをカードブック直下として扱う", () => {
    expect(resolveWorkspaceRelativePathOrRoot("/tmp/relic-notes", "")).toEqual({
      ok: true,
      value: "/tmp/relic-notes"
    });
    expect(resolveWorkspaceRelativePathOrRoot("/tmp/relic-notes", ".")).toEqual({
      ok: true,
      value: "/tmp/relic-notes"
    });
  });

  it("カードブック外への参照は拒否する", () => {
    expect(resolveWorkspaceRelativePathOrRoot("/tmp/relic-notes", "../other").ok).toBe(false);
    expect(resolveWorkspaceRelativePathOrRoot("/tmp/relic-notes", "/tmp/other").ok).toBe(false);
  });
});

describe("toWorkspaceRelativePath", () => {
  it("OS のパス区切りをカードブック相対パスの区切りへ正規化する", () => {
    expect(toWorkspaceRelativePath(path.join("notes", "idea.md"))).toBe("notes/idea.md");
  });
});
