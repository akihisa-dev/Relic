import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { app, ipcMain } from "electron";

import {
  generateTableOfContentsChannel,
  type GenerateTableOfContentsInput,
  generateTitleListChannel,
  type GenerateTitleListInput,
  mergeFilesChannel,
  type MergeFilesInput,
  splitFileByHeadingChannel,
  type SplitFileByHeadingInput,
  type WorkspaceTreeNode
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { parseMarkdownTags } from "../../shared/tags";
import { readWorkspaceFileTree } from "../files/fileTree";
import { parseFrontmatter } from "../files/frontmatter";
import { readAppSettings } from "../settings/appSettings";
import { toWorkspaceState } from "../workspace/workspaceService";

export function registerToolHandlers(): void {
  ipcMain.handle(
    mergeFilesChannel,
    async (_event, input: MergeFilesInput): Promise<RelicResult<string>> => {
      try {
        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);
        if (!state.activeWorkspace) return fail("NO_WORKSPACE", "ワークスペースが選択されていません。");

        const workspacePath = state.activeWorkspace.path;
        const fileTree = await readWorkspaceFileTree(workspacePath);

        const candidates: { relPath: string; mtime: number; ctime: number }[] = [];

        async function collect(nodes: WorkspaceTreeNode[]) {
          for (const node of nodes) {
            if (node.type === "folder") {
              await collect(node.children);
            } else {
              const absPath = path.join(workspacePath, node.path);
              const s = await stat(absPath);
              candidates.push({ relPath: node.path, mtime: s.mtimeMs, ctime: s.birthtimeMs });
            }
          }
        }
        await collect(fileTree);

        let filtered = candidates;
        if (input.filterType === "folder" && input.filterValue) {
          filtered = candidates.filter((f) =>
            f.relPath.startsWith(input.filterValue + "/") || f.relPath.startsWith(input.filterValue)
          );
        } else if (input.filterType === "tag" && input.filterValue) {
          const tagFiltered: typeof candidates = [];
          const tag = input.filterValue.trim().replace(/^#/, "");
          for (const c of candidates) {
            const content = await readFile(path.join(workspacePath, c.relPath), "utf-8");
            if (parseMarkdownTags(content).tags.includes(tag)) {
              tagFiltered.push(c);
            }
          }
          filtered = tagFiltered;
        } else if (input.filterType === "frontmatter") {
          const frontmatterFiltered: typeof candidates = [];
          const field = input.frontmatterField?.trim() ?? "";
          const value = input.filterValue.trim();

          if (field && value) {
            for (const c of candidates) {
              const content = await readFile(path.join(workspacePath, c.relPath), "utf-8");
              const { data } = parseFrontmatter(content);

              if (matchesFrontmatterField(data[field], value)) {
                frontmatterFiltered.push(c);
              }
            }
          }

          filtered = frontmatterFiltered;
        }

        if (input.sortBy === "mtime") filtered.sort((a, b) => b.mtime - a.mtime);
        else if (input.sortBy === "ctime") filtered.sort((a, b) => b.ctime - a.ctime);
        else filtered.sort((a, b) => a.relPath.localeCompare(b.relPath, "ja"));

        const parts: string[] = [];
        for (const f of filtered) {
          const content = await readFile(path.join(workspacePath, f.relPath), "utf-8");
          const name = f.relPath.split("/").at(-1)?.replace(/\.md$/, "") ?? f.relPath;
          if (input.insertFilenameHeading) {
            parts.push(`# ${name}\n\n${content.trim()}`);
          } else {
            parts.push(content.trim());
          }
        }

        const merged = parts.join("\n\n---\n\n") + "\n";
        const outputDir = path.join(workspacePath, input.outputFolder || ".");
        await mkdir(outputDir, { recursive: true });
        const outputPath = await uniqueFilePath(outputDir, input.outputName || "merged");
        await writeFile(outputPath, merged, "utf-8");

        return ok(path.relative(workspacePath, outputPath));
      } catch (error) {
        return fail("MERGE_FAILED", "ファイルのマージに失敗しました。", error instanceof Error ? error.message : String(error));
      }
    }
  );

  ipcMain.handle(
    splitFileByHeadingChannel,
    async (_event, input: SplitFileByHeadingInput): Promise<RelicResult<string[]>> => {
      try {
        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);
        if (!state.activeWorkspace) return fail("NO_WORKSPACE", "ワークスペースが選択されていません。");

        const workspacePath = state.activeWorkspace.path;
        const absSource = path.join(workspacePath, input.sourcePath);
        const content = await readFile(absSource, "utf-8");
        const lines = content.split("\n");

        const headingPrefix = "#".repeat(input.headingLevel) + " ";
        const sections: { title: string; lines: string[] }[] = [];
        let current: { title: string; lines: string[] } | null = null;

        for (const line of lines) {
          if (line.startsWith(headingPrefix) && !line.startsWith(headingPrefix + "#")) {
            if (current) sections.push(current);
            current = { title: line.slice(headingPrefix.length).trim(), lines: [line] };
          } else {
            if (current) current.lines.push(line);
          }
        }
        if (current) sections.push(current);

        if (sections.length === 0) {
          return fail("SPLIT_NO_HEADINGS", `H${input.headingLevel} の見出しが見つかりませんでした。`);
        }

        const outputDir = path.join(workspacePath, input.outputFolder || ".");
        await mkdir(outputDir, { recursive: true });

        const created: string[] = [];
        for (const section of sections) {
          const safeName = section.title
            .replace(/[/\\:*?"<>|]/g, "_")
            .replace(/\s+/g, " ")
            .trim() || "untitled";
          const outPath = await uniqueFilePath(outputDir, safeName);
          const sectionContent = section.lines.join("\n").trimEnd() + "\n";
          await writeFile(outPath, sectionContent, "utf-8");
          created.push(path.relative(workspacePath, outPath));
        }

        return ok(created);
      } catch (error) {
        return fail("SPLIT_FAILED", "ファイルの分割に失敗しました。", error instanceof Error ? error.message : String(error));
      }
    }
  );

  ipcMain.handle(
    generateTitleListChannel,
    async (_event, input: GenerateTitleListInput): Promise<RelicResult<string>> => {
      try {
        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);
        if (!state.activeWorkspace) return fail("NO_WORKSPACE", "ワークスペースが選択されていません。");

        const workspacePath = state.activeWorkspace.path;
        const fileTree = await readWorkspaceFileTree(workspacePath);

        const collected: { name: string; path: string; mtime: number }[] = [];
        async function collectFiles(nodes: WorkspaceTreeNode[], folderRelPath: string) {
          for (const node of nodes) {
            if (node.type === "folder") {
              if (!input.filterFolder || folderRelPath === input.filterFolder || node.path === input.filterFolder) {
                await collectFiles(node.children, node.path);
              } else if (!input.filterFolder) {
                await collectFiles(node.children, node.path);
              }
            } else {
              if (input.filterFolder && !node.path.startsWith(input.filterFolder + "/") && node.path !== input.filterFolder) continue;
              const absPath = path.join(workspacePath, node.path);
              const s = await stat(absPath);
              collected.push({ name: node.name.replace(/\.md$/, ""), path: node.path, mtime: s.mtimeMs });
            }
          }
        }
        await collectFiles(fileTree, "");

        if (input.sortBy === "mtime") {
          collected.sort((a, b) => b.mtime - a.mtime);
        } else {
          collected.sort((a, b) => a.name.localeCompare(b.name, "ja"));
        }

        const lines = collected.map((f) => `- [[${f.name}]]`);
        const content = lines.join("\n") + "\n";

        const outputDir = path.join(workspacePath, input.outputFolder);
        await mkdir(outputDir, { recursive: true });
        const outputPath = await uniqueFilePath(outputDir, input.outputName);
        await writeFile(outputPath, content, "utf-8");

        return ok(path.relative(workspacePath, outputPath));
      } catch (error) {
        return fail("TITLE_LIST_FAILED", "タイトル一覧の生成に失敗しました。", error instanceof Error ? error.message : String(error));
      }
    }
  );

  ipcMain.handle(
    generateTableOfContentsChannel,
    async (_event, input: GenerateTableOfContentsInput): Promise<RelicResult<string>> => {
      try {
        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);
        if (!state.activeWorkspace) return fail("NO_WORKSPACE", "ワークスペースが選択されていません。");

        const workspacePath = state.activeWorkspace.path;
        const targetAbsPath = path.join(workspacePath, input.targetFolder);
        const lines: string[] = [];

        async function buildToc(dirPath: string, relBase: string, indent: number) {
          const entries = await readdir(dirPath, { withFileTypes: true });
          entries.sort((a, b) => {
            if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
            return a.name.localeCompare(b.name, "ja");
          });
          for (const entry of entries) {
            const prefix = "  ".repeat(indent) + "- ";
            if (entry.isDirectory()) {
              if (input.includeSubfolders) {
                lines.push(`${prefix}**${entry.name}/**`);
                await buildToc(path.join(dirPath, entry.name), path.join(relBase, entry.name), indent + 1);
              }
            } else if (entry.name.endsWith(".md")) {
              const displayName = entry.name.replace(/\.md$/, "");
              lines.push(`${prefix}[[${displayName}]]`);
            }
          }
        }

        await buildToc(targetAbsPath, input.targetFolder, 0);

        const content = lines.join("\n") + "\n";
        const outputDir = path.join(workspacePath, input.outputFolder);
        await mkdir(outputDir, { recursive: true });
        const outputPath = await uniqueFilePath(outputDir, input.outputName);
        await writeFile(outputPath, content, "utf-8");

        return ok(path.relative(workspacePath, outputPath));
      } catch (error) {
        return fail("TOC_FAILED", "目次の生成に失敗しました。", error instanceof Error ? error.message : String(error));
      }
    }
  );
}

function matchesFrontmatterField(value: unknown, query: string): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => String(item).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  }

  if (typeof value === "boolean") {
    const normalizedQuery = query.toLocaleLowerCase();

    if (["true", "1", "yes", "on"].includes(normalizedQuery)) {
      return value === true;
    }

    if (["false", "0", "no", "off"].includes(normalizedQuery)) {
      return value === false;
    }

    return String(value).toLocaleLowerCase() === normalizedQuery;
  }

  return String(value).toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

async function uniqueFilePath(dir: string, name: string): Promise<string> {
  const ext = name.endsWith(".md") ? "" : ".md";
  const base = name.replace(/\.md$/, "");
  let candidate = path.join(dir, `${base}${ext}`);
  let counter = 1;
  while (true) {
    try {
      await stat(candidate);
      candidate = path.join(dir, `${base}-${counter}${ext}`);
      counter++;
    } catch {
      return candidate;
    }
  }
}
