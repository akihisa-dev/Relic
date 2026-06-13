import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readRelicMapFile, writeRelicMapFile } from "./mapFiles";

describe("mapFiles", () => {
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

  it("Map用MDを実ファイルから読み込む", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "world.md"), [
      "type: map",
      "",
      "nodes:",
      "  - id: node-1",
      "    file: characters/alice.md",
      "    x: 120",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "lines: []",
      ""
    ].join("\n"), "utf8");

    await expect(readRelicMapFile(workspacePath, "world.md")).resolves.toMatchObject({
      ok: true,
      value: {
        name: "world",
        path: "world.md",
        map: {
          nodes: [
            {
              file: "characters/alice.md",
              id: "node-1"
            }
          ],
          lines: []
        }
      }
    });
  });

  it("NodeとLineをMap用MDへ書き戻す", async () => {
    const workspacePath = await createWorkspace();
    const original = "type: map\n\nnodes: []\nlines: []\n";
    await writeFile(path.join(workspacePath, "world.md"), original, "utf8");

    const result = await writeRelicMapFile(workspacePath, "world.md", {
      type: "map",
      nodes: [
        {
          file: "characters/alice.md",
          height: 80,
          id: "node-1",
          width: 180,
          x: 120,
          y: 80
        },
        {
          file: "characters/bob.md",
          height: 80,
          id: "node-2",
          width: 180,
          x: 380,
          y: 80
        }
      ],
      lines: [
        {
          from: "node-1",
          id: "line-1",
          label: "幼なじみ",
          to: "node-2"
        }
      ]
    }, original);

    expect(result.ok).toBe(true);
    await expect(readFile(path.join(workspacePath, "world.md"), "utf8")).resolves.toContain("label: 幼なじみ");
  });

  it("壊れたMap用MDと外部変更を保存対象にしない", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "broken.md"), "type: map\n\nnotes: body", "utf8");
    await writeFile(path.join(workspacePath, "changed.md"), "type: map\n\nnodes: []\nlines: []\n", "utf8");

    await expect(writeRelicMapFile(workspacePath, "broken.md", {
      type: "map",
      nodes: [],
      lines: []
    })).resolves.toMatchObject({ ok: false });
    await expect(writeRelicMapFile(workspacePath, "changed.md", {
      type: "map",
      nodes: [],
      lines: []
    }, "old")).resolves.toMatchObject({
      ok: false,
      error: {
        code: "MAP_FILE_WRITE_CONFLICT"
      }
    });
  });

  async function createWorkspace(): Promise<string> {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-map-file-"));
    temporaryPaths.push(workspacePath);
    return workspacePath;
  }
});
