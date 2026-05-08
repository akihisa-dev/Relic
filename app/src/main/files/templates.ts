import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { MarkdownTemplateSummary } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { templatesDirectoryName } from "../../shared/workspace";
import { resolveWorkspaceRelativePath } from "./paths";

export async function listMarkdownTemplates(
  workspacePath: string
): Promise<RelicResult<MarkdownTemplateSummary[]>> {
  const templatesPath = path.join(workspacePath, templatesDirectoryName);

  try {
    const entries = await readdir(templatesPath, { withFileTypes: true });
    const templates = entries
      .filter((entry) => entry.isFile() && path.extname(entry.name) === ".md")
      .map((entry) => ({
        name: path.basename(entry.name, ".md"),
        path: `${templatesDirectoryName}/${entry.name}`
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));

    return ok(templates);
  } catch (error) {
    return fail(
      "TEMPLATE_LIST_FAILED",
      "テンプレートを読み込めませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function readMarkdownTemplate(
  workspacePath: string,
  templatePath: string
): Promise<RelicResult<string>> {
  const normalizedPath = templatePath.replace(/\\/g, "/");

  if (
    !normalizedPath.startsWith(`${templatesDirectoryName}/`) ||
    path.extname(normalizedPath) !== ".md"
  ) {
    return fail("TEMPLATE_INVALID", "テンプレートを選択してください。");
  }

  const absoluteTemplatePath = resolveWorkspaceRelativePath(workspacePath, normalizedPath);

  if (!absoluteTemplatePath.ok) {
    return absoluteTemplatePath;
  }

  try {
    return ok(await readFile(absoluteTemplatePath.value, "utf8"));
  } catch (error) {
    return fail(
      "TEMPLATE_READ_FAILED",
      "テンプレートを読み込めませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}
