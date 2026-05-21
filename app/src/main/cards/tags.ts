import { readFile } from "node:fs/promises";

import type { CardbookTagSummary } from "../../shared/ipc";
import { parseMarkdownTags } from "../../shared/tags";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownCardPaths } from "../../shared/cardbookTree";
import { readCardbookCardTree } from "./cardTree";
import { resolveCardbookRelativePath } from "./paths";

export async function readCardbookTags(
  cardbookPath: string
): Promise<RelicResult<CardbookTagSummary[]>> {
  try {
    const cardTree = await readCardbookCardTree(cardbookPath);
    const tagCounts = new Map<string, number>();

    for (const relativePath of collectMarkdownCardPaths(cardTree)) {
      const absolutePath = resolveCardbookRelativePath(cardbookPath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");

      for (const tag of parseMarkdownTags(content).tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    return ok(
      [...tagCounts.entries()]
        .map(([tag, count]) => ({ count, tag }))
        .sort((a, b) => a.tag.localeCompare(b.tag, "ja"))
    );
  } catch (error) {
    return fail(
      "TAGS_READ_FAILED",
      "タグを読み込めませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}
