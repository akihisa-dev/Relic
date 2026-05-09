import fs from "node:fs";

import git from "isomorphic-git";

import type {
  CreateGitTagInput,
  DeleteGitTagInput,
  GitTagSummary
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { ensureBranchOperationsAvailable } from "./gitRepositoryChecks";
import { readGitStatus } from "./gitStatus";
import { normalizeTagName, validateTagInput } from "./gitValidation";

export async function readGitTags(
  workspacePath: string
): Promise<RelicResult<GitTagSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return ok([]);
    }

    const tagNames = await git.listTags({
      dir: workspacePath,
      fs
    });

    const tags = await Promise.all(tagNames.map((name) => readGitTagSummary(workspacePath, name)));

    return ok(
      tags
        .sort((a, b) => {
          if (a.date !== b.date) {
            return b.date.localeCompare(a.date);
          }

          return a.name.localeCompare(b.name, "ja");
        })
    );
  } catch (error) {
    return fail(
      "GIT_TAGS_FAILED",
      "Gitタグ一覧を取得できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function createGitTag(
  workspacePath: string,
  input: CreateGitTagInput
): Promise<RelicResult<GitTagSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return fail("GIT_NOT_INITIALIZED", "先にGitを初期化してください。");
    }

    const validated = validateTagInput(input);

    if (!validated.ok) {
      return validated;
    }

    const hasCommits = await ensureBranchOperationsAvailable(workspacePath);

    if (!hasCommits.ok) {
      return fail("GIT_TAG_REQUIRES_COMMIT", "タグ作成は最初のコミット後に使えます。");
    }

    if (validated.value.message) {
      await git.annotatedTag({
        dir: workspacePath,
        fs,
        message: validated.value.message,
        object: validated.value.hash,
        ref: validated.value.name,
        tagger: {
          email: validated.value.taggerEmail,
          name: validated.value.taggerName
        }
      });
    } else {
      await git.tag({
        dir: workspacePath,
        fs,
        object: validated.value.hash,
        ref: validated.value.name
      });
    }

    return readGitTags(workspacePath);
  } catch (error) {
    return fail(
      "GIT_TAG_CREATE_FAILED",
      "Gitタグを作成できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function deleteGitTag(
  workspacePath: string,
  input: DeleteGitTagInput
): Promise<RelicResult<GitTagSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return fail("GIT_NOT_INITIALIZED", "先にGitを初期化してください。");
    }

    const tagName = normalizeTagName(input.name);

    if (!tagName.ok) {
      return tagName;
    }

    await git.deleteTag({
      dir: workspacePath,
      fs,
      ref: tagName.value
    });

    return readGitTags(workspacePath);
  } catch (error) {
    return fail(
      "GIT_TAG_DELETE_FAILED",
      "Gitタグを削除できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function readGitTagSummary(workspacePath: string, name: string): Promise<GitTagSummary> {
  const oid = await git.resolveRef({
    dir: workspacePath,
    fs,
    ref: `refs/tags/${name}`
  });

  try {
    const tag = await git.readTag({
      dir: workspacePath,
      fs,
      oid
    });

    const targetCommit = await git.readCommit({
      dir: workspacePath,
      fs,
      oid: tag.tag.object
    });

    return {
      annotated: true,
      date: new Date(tag.tag.tagger.timestamp * 1000).toISOString(),
      message: tag.tag.message.trim() || null,
      name,
      targetHash: tag.tag.object,
      targetMessage: targetCommit.commit.message.trim() || null
    };
  } catch {
    const commit = await git.readCommit({
      dir: workspacePath,
      fs,
      oid
    });

    return {
      annotated: false,
      date: new Date(commit.commit.author.timestamp * 1000).toISOString(),
      message: null,
      name,
      targetHash: oid,
      targetMessage: commit.commit.message.trim() || null
    };
  }
}
