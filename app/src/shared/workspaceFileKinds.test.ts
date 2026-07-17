import { describe, expect, it } from "vitest";

import { isSupportedWorkspaceFilePath, workspaceFileKindForPath } from "./workspaceFileKinds";

describe("workspaceFileKindForPath", () => {
  it.each([
    ["Note.md", "markdown"],
    ["IMAGE.PNG", "image"],
    ["document.PDF", "pdf"]
  ] as const)("%s のファイル種別を %s と判定する", (path, expectedKind) => {
    expect(workspaceFileKindForPath(path)).toBe(expectedKind);
    expect(isSupportedWorkspaceFilePath(path)).toBe(true);
  });

  it("未対応ファイルを対象外にする", () => {
    expect(workspaceFileKindForPath("archive.zip")).toBeNull();
    expect(isSupportedWorkspaceFilePath("archive.zip")).toBe(false);
  });
});
