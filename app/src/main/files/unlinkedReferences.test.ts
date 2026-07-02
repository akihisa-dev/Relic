import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { applyUnlinkedReference, readUnlinkedReferences } from "./unlinkedReferences";

describe("unlinkedReferences", () => {
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

  it("対象ファイル名を含む未リンク参照を一覧にする", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-unlinked-references-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "Target.md"), "# Target", "utf8");
    await writeFile(path.join(workspacePath, "source.md"), "Target を確認\n[[Target]] は既存リンク", "utf8");

    await expect(readUnlinkedReferences(workspacePath, "Target.md")).resolves.toMatchObject({
      ok: true,
      value: {
        references: [
          {
            from: 0,
            lineNumber: 1,
            lineText: "Target を確認",
            linkText: "[[Target]]",
            matchText: "Target",
            sourceName: "source",
            sourcePath: "source.md",
            targetPath: "Target.md",
            to: 6
          }
        ],
        truncated: false
      }
    });
  });

  it("1件の未リンク参照だけをリンク化する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-unlinked-references-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "Target.md"), "# Target", "utf8");
    await writeFile(path.join(workspacePath, "source.md"), "Target と Target", "utf8");

    await expect(applyUnlinkedReference(workspacePath, {
      from: 0,
      matchText: "Target",
      sourcePath: "source.md",
      targetPath: "Target.md",
      to: 6
    })).resolves.toEqual({
      ok: true,
      value: {
        content: "[[Target]] と Target",
        sourcePath: "source.md"
      }
    });
    await expect(readFile(path.join(workspacePath, "source.md"), "utf8")).resolves.toBe("[[Target]] と Target");
  });

  it("同名ファイルがありbasenameリンクで解決できない場合はパス付きリンクにする", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-unlinked-references-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "folder"));
    await mkdir(path.join(workspacePath, "other"));
    await writeFile(path.join(workspacePath, "folder", "Target.md"), "# Target", "utf8");
    await writeFile(path.join(workspacePath, "other", "Target.md"), "# Other", "utf8");
    await writeFile(path.join(workspacePath, "source.md"), "Target", "utf8");

    await expect(applyUnlinkedReference(workspacePath, {
      from: 0,
      matchText: "Target",
      sourcePath: "source.md",
      targetPath: "folder/Target.md",
      to: 6
    })).resolves.toEqual({
      ok: true,
      value: {
        content: "[[folder/Target|Target]]",
        sourcePath: "source.md"
      }
    });
  });

  it("候補位置が更新されている場合はリンク化しない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-unlinked-references-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "Target.md"), "# Target", "utf8");
    await writeFile(path.join(workspacePath, "source.md"), "Changed", "utf8");

    await expect(applyUnlinkedReference(workspacePath, {
      from: 0,
      matchText: "Target",
      sourcePath: "source.md",
      targetPath: "Target.md",
      to: 6
    })).resolves.toMatchObject({
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "source.md"), "utf8")).resolves.toBe("Changed");
  });
});
