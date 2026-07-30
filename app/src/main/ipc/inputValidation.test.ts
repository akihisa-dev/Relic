import { describe, expect, it } from "vitest";

import { maxWorkspaceRelativePathLength } from "../../shared/ipc";
import {
  isInputRecord,
  isLimitedWorkspaceRelativeInputPath,
  isLimitedWorkspaceRelativeInputPathOrRoot,
  isNameInput,
  isPathInput,
  isPathOrRootInput,
  isWithinUtf8ByteLength,
  isWorkspaceIdInput
} from "./inputValidation";

describe("inputValidation", () => {
  it("オブジェクト、名前、相対パスの既存入力境界を保つ", () => {
    expect(isInputRecord({})).toBe(true);
    expect(isInputRecord([])).toBe(true);
    expect(isInputRecord(null)).toBe(false);
    expect(isNameInput({ name: "" })).toBe(true);
    expect(isNameInput({ name: 1 })).toBe(false);
    expect(isPathInput({ path: "Notes/Idea.md" })).toBe(true);
    expect(isPathInput({ path: "" })).toBe(false);
    expect(isPathOrRootInput({ path: "" })).toBe(true);
    expect(isPathOrRootInput({ path: "../outside" })).toBe(false);
  });

  it("相対パス長とUTF-8 byte長の上限を境界値で判定する", () => {
    const maximumPath = `${"a".repeat(maxWorkspaceRelativePathLength - 3)}.md`;
    const oversizedPath = `${"a".repeat(maxWorkspaceRelativePathLength - 2)}.md`;

    expect(isLimitedWorkspaceRelativeInputPath(maximumPath)).toBe(true);
    expect(isLimitedWorkspaceRelativeInputPath(oversizedPath)).toBe(false);
    expect(isLimitedWorkspaceRelativeInputPathOrRoot("")).toBe(true);
    expect(isWithinUtf8ByteLength("あ", 3)).toBe(true);
    expect(isWithinUtf8ByteLength("あ", 2)).toBe(false);
  });

  it("workspace IDは空白やパス区切りを含まない既存形式だけを受け付ける", () => {
    expect(isWorkspaceIdInput({ workspaceId: "workspace-1" })).toBe(true);
    expect(isWorkspaceIdInput({ workspaceId: "workspace_1" })).toBe(true);
    expect(isWorkspaceIdInput({ workspaceId: "" })).toBe(false);
    expect(isWorkspaceIdInput({ workspaceId: " workspace-1 " })).toBe(false);
    expect(isWorkspaceIdInput({ workspaceId: "folder/workspace" })).toBe(false);
  });
});
