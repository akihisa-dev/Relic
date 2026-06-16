import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readWorkspaceFileTree } from "./fileTree";

describe("readWorkspaceFileTree", () => {
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

  it("フォルダとMarkdownファイルだけをワークスペース相対パスで返す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-tree-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "notes"));
    await writeFile(path.join(workspacePath, "index.md"), "# Index", "utf8");
    await writeFile(path.join(workspacePath, "notes", "idea.md"), "# Idea", "utf8");
    await writeFile(path.join(workspacePath, "notes", "image.png"), "", "utf8");

    await expect(readWorkspaceFileTree(workspacePath)).resolves.toEqual([
      {
        children: [
          {
            name: "idea",
            path: "notes/idea.md",
            type: "file"
          }
        ],
        name: "notes",
        path: "notes",
        type: "folder"
      },
      {
        name: "index",
        path: "index.md",
        type: "file"
      }
    ]);
  });

  it("大文字のMarkdown拡張子もMarkdownファイルとして返す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-tree-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "README.MD"), "# README", "utf8");

    await expect(readWorkspaceFileTree(workspacePath)).resolves.toEqual([
      {
        name: "README",
        path: "README.MD",
        type: "file"
      }
    ]);
  });

  it("読めない子フォルダは空フォルダとして扱い、読める項目は返す", async () => {
    const workspacePath = path.join(path.sep, "workspace");
    const lockedPath = path.join(workspacePath, "locked");

    await expect(readWorkspaceFileTree(workspacePath, {
      async readdir(directoryPath) {
        if (directoryPath === workspacePath) {
          return [
            createDirectoryEntry("locked", "folder"),
            createDirectoryEntry("note.md", "file")
          ];
        }

        if (directoryPath === lockedPath) {
          throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
        }

        return [];
      }
    })).resolves.toEqual([
      {
        children: [],
        name: "locked",
        path: "locked",
        type: "folder"
      },
      {
        name: "note",
        path: "note.md",
        type: "file"
      }
    ]);
  });
});

function createDirectoryEntry(name: string, type: "file" | "folder"): Dirent {
  return {
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isDirectory: () => type === "folder",
    isFIFO: () => false,
    isFile: () => type === "file",
    isSocket: () => false,
    isSymbolicLink: () => false,
    name
  } as Dirent;
}
