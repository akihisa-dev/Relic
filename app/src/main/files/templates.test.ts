import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { listMarkdownTemplates, readMarkdownTemplate } from "./templates";

describe("templates", () => {
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

  it("templates フォルダ内のMarkdownテンプレートを一覧にする", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-templates-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "templates"));
    await writeFile(path.join(workspacePath, "templates", "日記.md"), "", "utf8");
    await writeFile(path.join(workspacePath, "templates", "readme.txt"), "", "utf8");

    await expect(listMarkdownTemplates(workspacePath)).resolves.toEqual({
      ok: true,
      value: [{ name: "日記", path: "templates/日記.md" }]
    });
  });

  it("templates フォルダ外のテンプレート読み込みを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-templates-"));
    temporaryPaths.push(workspacePath);

    await expect(readMarkdownTemplate(workspacePath, "../secret.md")).resolves.toMatchObject({
      ok: false
    });
  });
});
