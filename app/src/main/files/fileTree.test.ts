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

  it("フォルダ、Markdownファイル、対応画像ファイル、PDFファイルをワークスペース相対パスで返す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-tree-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "notes"));
    await writeFile(path.join(workspacePath, "index.md"), "# Index", "utf8");
    await writeFile(path.join(workspacePath, "notes", "idea.md"), "# Idea", "utf8");
    await writeFile(path.join(workspacePath, "notes", "image.webp"), "", "utf8");
    await writeFile(path.join(workspacePath, "notes", "reference.pdf"), "%PDF-1.7");
    await writeFile(path.join(workspacePath, "notes", "ignored.txt"), "", "utf8");

    await expect(readWorkspaceFileTree(workspacePath)).resolves.toEqual([
      {
        children: [
          {
            name: "idea",
            path: "notes/idea.md",
            type: "file"
          },
          {
            kind: "image",
            name: "image.webp",
            path: "notes/image.webp",
            type: "file"
          },
          {
            kind: "pdf",
            name: "reference.pdf",
            path: "notes/reference.pdf",
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

  it("既定除外ディレクトリ配下のMarkdownは返さない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-tree-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "notes"));
    await mkdir(path.join(workspacePath, "node_modules"));
    await mkdir(path.join(workspacePath, "out"));
    await mkdir(path.join(workspacePath, "dist"));
    await mkdir(path.join(workspacePath, "build"));
    await writeFile(path.join(workspacePath, "notes", "keep.md"), "# Keep", "utf8");
    await writeFile(path.join(workspacePath, "node_modules", "skip.md"), "# Skip", "utf8");
    await writeFile(path.join(workspacePath, "out", "skip.md"), "# Skip", "utf8");
    await writeFile(path.join(workspacePath, "dist", "skip.md"), "# Skip", "utf8");
    await writeFile(path.join(workspacePath, "build", "skip.md"), "# Skip", "utf8");

    await expect(readWorkspaceFileTree(workspacePath)).resolves.toEqual([
      {
        children: [
          {
            name: "keep",
            path: "notes/keep.md",
            type: "file"
          }
        ],
        name: "notes",
        path: "notes",
        type: "folder"
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
