import { mkdir, mkdtemp, rm, symlink, truncate, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { maxToolTargetTotalBytes } from "../../shared/ipc";
import { readWorkspaceFileTree } from "../files/fileTree";
import { resolveToolTargetPaths } from "./toolTargets";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((temporaryPath) => rm(temporaryPath, { force: true, recursive: true })));
});

async function makeTemporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryPaths.push(directory);
  return directory;
}

describe("resolveToolTargetPaths", () => {
  it("ワークスペース対象から隠し項目とMarkdown以外を除外する", async () => {
    const workspacePath = await makeTemporaryDirectory("relic-tool-targets-");
    await mkdir(path.join(workspacePath, "notes"));
    await mkdir(path.join(workspacePath, ".private"));
    await writeFile(path.join(workspacePath, "visible.md"), "visible", "utf8");
    await writeFile(path.join(workspacePath, "notes", "nested.md"), "nested", "utf8");
    await writeFile(path.join(workspacePath, ".hidden.md"), "hidden", "utf8");
    await writeFile(path.join(workspacePath, ".private", "secret.md"), "secret", "utf8");
    await writeFile(path.join(workspacePath, "image.png"), "image", "utf8");

    const tree = await readWorkspaceFileTree(workspacePath);
    const result = await resolveToolTargetPaths(workspacePath, tree, { kind: "workspace" });

    expect(result).toEqual({ ok: true, value: new Set(["notes/nested.md", "visible.md"]) });
  });

  it("明示対象が外部実体のシンボリックリンクなら拒否する", async () => {
    const workspacePath = await makeTemporaryDirectory("relic-tool-targets-");
    const outsidePath = await makeTemporaryDirectory("relic-tool-targets-outside-");
    await writeFile(path.join(outsidePath, "external.md"), "external", "utf8");
    await symlink(path.join(outsidePath, "external.md"), path.join(workspacePath, "linked.md"));

    const result = await resolveToolTargetPaths(
      workspacePath,
      [{ name: "linked", path: "linked.md", type: "file" }],
      { kind: "files", paths: ["linked.md"] }
    );

    expect(result).toMatchObject({ error: { code: "WORKSPACE_PATH_OUTSIDE" }, ok: false });
  });

  it("対象Markdownの合計サイズが上限を超える場合は処理前に拒否する", async () => {
    const workspacePath = await makeTemporaryDirectory("relic-tool-targets-");
    const largeFilePath = path.join(workspacePath, "large.md");
    await writeFile(largeFilePath, "", "utf8");
    await truncate(largeFilePath, maxToolTargetTotalBytes + 1);

    const tree = await readWorkspaceFileTree(workspacePath);
    const result = await resolveToolTargetPaths(workspacePath, tree, { kind: "workspace" });

    expect(result).toMatchObject({ error: { code: "TOOL_TARGET_TOO_LARGE" }, ok: false });
  });
});
