import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveWorkspaceRelativePath } from "./paths";

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
  });
});
