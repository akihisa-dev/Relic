import fs from "node:fs";
import path from "node:path";

import git from "isomorphic-git";

import type {
  GitConflict,
  ResolveGitConflictInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readGitStatus } from "./gitStatus";

const CONFLICT_START_RE = /^<<<<<<< /m;

function resolveConflictSide(content: string, side: "ours" | "theirs"): string {
  return content.replace(
    /<<<<<<< [^\n]*\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]*\n?/g,
    (_match, ours: string, theirs: string) => side === "ours" ? ours : theirs
  );
}

export async function readGitConflicts(workspacePath: string): Promise<RelicResult<GitConflict[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return ok([]);
    }

    const matrix = await git.statusMatrix({ dir: workspacePath, fs });
    const conflicts: GitConflict[] = [];

    for (const [filePath, head, workdir] of matrix) {
      if (head === 0 || workdir === 0) {
        continue;
      }

      const fullPath = path.join(workspacePath, filePath);

      try {
        const content = await fs.promises.readFile(fullPath, "utf8");

        if (!CONFLICT_START_RE.test(content)) {
          continue;
        }

        conflicts.push({
          ours: resolveConflictSide(content, "ours"),
          path: filePath,
          theirs: resolveConflictSide(content, "theirs")
        });
      } catch {
        // skip unreadable files
      }
    }

    return ok(conflicts);
  } catch (error) {
    return fail(
      "GIT_CONFLICTS_FAILED",
      "コンフリクトファイルを確認できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function resolveGitConflict(
  workspacePath: string,
  input: ResolveGitConflictInput
): Promise<RelicResult<GitConflict[]>> {
  try {
    const filePath = path.join(workspacePath, input.path);
    const content = await fs.promises.readFile(filePath, "utf8");
    const resolved = resolveConflictSide(content, input.resolution);
    await fs.promises.writeFile(filePath, resolved, "utf8");

    return readGitConflicts(workspacePath);
  } catch (error) {
    return fail(
      "GIT_CONFLICT_RESOLVE_FAILED",
      "コンフリクトを解決できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}
