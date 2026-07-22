import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  getPath: vi.fn(),
  handle: vi.fn()
}));

vi.mock("electron", () => ({
  app: { getPath: electronMock.getPath },
  ipcMain: { handle: electronMock.handle }
}));

import {
  applySearchAndReplaceChannel,
  applyUnlinkedReferenceChannel,
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  getBacklinksChannel,
  getUnlinkedReferencesChannel,
  readMarkdownFileChannel,
  replaceInFileChannel,
  searchAndReplaceChannel,
  searchWorkspaceChannel,
  type SearchAndReplacePreviewResult
} from "../../shared/ipc";
import { invalidateWorkspaceData } from "../files/workspaceDataInvalidation";
import { workspaceDataProvider } from "../files/workspaceDataProvider";
import { writeAppSettings } from "../settings/appSettings";
import { addOrActivateWorkspace, createWorkspaceSummary } from "../workspace/workspaceService";
import { registerFileSearchHandlers } from "./fileSearchHandlers";
import { setMainTranslator } from "../i18n";

type RegisteredHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

describe("fileSearchHandlers", () => {
  const temporaryPaths: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    setMainTranslator("ja");
    registerFileSearchHandlers();
  });

  afterEach(async () => {
    invalidateWorkspaceData();
    vi.restoreAllMocks();
    await Promise.all(temporaryPaths.splice(0).map((temporaryPath) => rm(temporaryPath, {
      force: true,
      recursive: true
    })));
  });

  it("registered handlers search files and resolve backlinks and unlinked references", async () => {
    const { workspacePath } = await createActiveWorkspace({
      "Source.md": "Target を確認\n[[Target]]\nneedle",
      "Target.md": "# Target\nneedle"
    });

    const searchResult = await handlerFor(searchWorkspaceChannel)(undefined, {
      mode: "fullText",
      query: "needle"
    });
    expect(searchResult).toMatchObject({
      ok: true,
      value: {
        results: [
          { path: "Source.md" },
          { path: "Target.md" }
        ]
      }
    });

    const backlinksResult = await handlerFor(getBacklinksChannel)(undefined, { path: "Target.md" });
    expect(backlinksResult).toEqual({
      ok: true,
      value: [{ count: 1, sourceName: "Source", sourcePath: "Source.md" }]
    });

    const unlinkedResult = await handlerFor(getUnlinkedReferencesChannel)(undefined, { path: "Target.md" });
    expect(unlinkedResult).toMatchObject({
      ok: true,
      value: {
        references: [{
          lineText: "Target を確認",
          matchText: "Target",
          sourcePath: "Source.md",
          targetPath: "Target.md"
        }]
      }
    });

    const fileResult = await handlerFor(readMarkdownFileChannel)(undefined, { path: "Target.md" });
    expect(fileResult).toMatchObject({ ok: true, value: { content: "# Target\nneedle", path: "Target.md" } });
    await expect(readFile(path.join(workspacePath, "Target.md"), "utf8")).resolves.toBe("# Target\nneedle");
  });

  it("links an unlinked reference and invalidates the shared index before reading backlinks", async () => {
    await createActiveWorkspace({
      "Source.md": "Target を確認",
      "Target.md": "# Target"
    });

    const unlinkedResult = await handlerFor(getUnlinkedReferencesChannel)(undefined, { path: "Target.md" });
    expect(unlinkedResult).toMatchObject({ ok: true });
    if (!isSuccessWithValue<{ references: Array<{ from: number; matchText: string; sourcePath: string; targetPath: string; to: number }> }>(unlinkedResult)) {
      throw new Error("Expected unlinked reference result");
    }
    const reference = unlinkedResult.value.references[0];
    if (!reference) throw new Error("Expected an unlinked reference");

    const applyResult = await handlerFor(applyUnlinkedReferenceChannel)(undefined, {
      from: reference.from,
      matchText: reference.matchText,
      sourcePath: reference.sourcePath,
      targetPath: reference.targetPath,
      to: reference.to
    });
    expect(applyResult).toMatchObject({
      ok: true,
      value: { content: "[[Target]] を確認", sourcePath: "Source.md" }
    });

    const backlinksResult = await handlerFor(getBacklinksChannel)(undefined, { path: "Target.md" });
    expect(backlinksResult).toEqual({
      ok: true,
      value: [{ count: 1, sourceName: "Source", sourcePath: "Source.md" }]
    });
  });

  it("previews and applies replacements, invalidating cached search data after each mutation", async () => {
    const { workspacePath } = await createActiveWorkspace({
      "Batch.md": "batch-old",
      "Note.md": "note-old note-old"
    });
    const search = handlerFor(searchWorkspaceChannel);

    await expect(search(undefined, { mode: "fullText", query: "note-old" })).resolves.toMatchObject({
      ok: true,
      value: { results: expect.arrayContaining([expect.objectContaining({ path: "Note.md" })]) }
    });

    const replaceResult = await handlerFor(replaceInFileChannel)(undefined, {
      isRegex: false,
      path: "Note.md",
      replacement: "note-new",
      searchQuery: "note-old"
    });
    expect(replaceResult).toEqual({ ok: true, value: { count: 2 } });
    await expect(search(undefined, { mode: "fullText", query: "note-new" })).resolves.toMatchObject({
      ok: true,
      value: { results: [{ path: "Note.md" }] }
    });

    const previewResult = await handlerFor(searchAndReplaceChannel)(undefined, {
      isRegex: false,
      replacement: "batch-new",
      searchQuery: "batch-old"
    });
    expect(previewResult).toMatchObject({
      ok: true,
      value: {
        fileSnapshots: [{ contentHash: expect.any(String), path: "Batch.md" }],
        matches: [{ path: "Batch.md" }]
      }
    });
    if (!isSuccessWithValue<SearchAndReplacePreviewResult>(previewResult)) {
      throw new Error("Expected replace preview result");
    }

    const applyResult = await handlerFor(applySearchAndReplaceChannel)(undefined, {
      expectedFileSnapshots: previewResult.value.fileSnapshots,
      isRegex: false,
      replacement: "batch-new",
      searchQuery: "batch-old"
    });
    expect(applyResult).toEqual({ ok: true, value: { count: 1, skippedUnreadableFiles: [] } });
    await expect(search(undefined, { mode: "fullText", query: "batch-new" })).resolves.toMatchObject({
      ok: true,
      value: { results: [{ path: "Batch.md" }] }
    });
    await expect(readFile(path.join(workspacePath, "Batch.md"), "utf8")).resolves.toBe("batch-new");
    await expect(readFile(path.join(workspacePath, "Note.md"), "utf8")).resolves.toBe("note-new note-new");
  });

  it.each([
    [searchWorkspaceChannel, null, "SEARCH_INVALID_INPUT"],
    [readMarkdownFileChannel, {}, "FILE_READ_INVALID_INPUT"],
    [getBacklinksChannel, {}, "BACKLINKS_INVALID_INPUT"],
    [getUnlinkedReferencesChannel, {}, "UNLINKED_REFERENCES_INVALID_INPUT"],
    [applyUnlinkedReferenceChannel, {}, "UNLINKED_REFERENCE_INVALID_INPUT"],
    [replaceInFileChannel, {}, "REPLACE_INVALID_INPUT"],
    [searchAndReplaceChannel, {}, "REPLACE_INVALID_INPUT"],
    [applySearchAndReplaceChannel, {}, "REPLACE_INVALID_INPUT"]
  ])("rejects invalid input before accessing the workspace for %s", async (channel, input, code) => {
    const result = await handlerFor(channel)(undefined, input);

    expect(result).toMatchObject({ error: { code }, ok: false });
    expect(electronMock.getPath).not.toHaveBeenCalled();
  });

  it.each([
    "needle",
    ["needle", "fullText"],
    { searchMode: "fullText", searchQuery: "needle" },
    { mode: "全文", query: "needle" }
  ])("rejects a retired search input shape before accessing the workspace", async (input) => {
    const result = await handlerFor(searchWorkspaceChannel)(undefined, input);

    expect(result).toMatchObject({ error: { code: "SEARCH_INVALID_INPUT" }, ok: false });
    expect(electronMock.getPath).not.toHaveBeenCalled();
  });

  it("returns WORKSPACE_NOT_SELECTED when a valid request has no active workspace", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-search-handler-user-"));
    temporaryPaths.push(userDataPath);
    await writeAppSettings(userDataPath, {
      editorSettings: defaultEditorSettings,
      featureToggles: defaultFeatureToggles,
      frontmatterTemplates: defaultFrontmatterTemplates,
      lastWorkspaceId: null,
      userDefinedFields: [],
      workspaces: []
    });
    electronMock.getPath.mockReturnValue(userDataPath);

    const result = await handlerFor(searchWorkspaceChannel)(undefined, {
      mode: "fullText",
      query: "needle"
    });

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_NOT_SELECTED" },
      ok: false
    });
  });

  it("converts provider exceptions to a redacted IPC failure and preserves domain failures", async () => {
    await createActiveWorkspace({ "Note.md": "content" });
    vi.spyOn(workspaceDataProvider, "get").mockRejectedValueOnce(
      new Error("search failed SERVICE_API_KEY=secret-value")
    );

    const searchResult = await handlerFor(searchWorkspaceChannel)(undefined, {
      mode: "fullText",
      query: "content"
    });
    expect(searchResult).toEqual({
      error: {
        code: "SEARCH_FAILED",
        details: "search failed SERVICE_API_KEY=[redacted]",
        message: "検索できませんでした。"
      },
      ok: false
    });

    const replaceResult = await handlerFor(searchAndReplaceChannel)(undefined, {
      isRegex: true,
      replacement: "note-new",
      searchQuery: "["
    });
    expect(replaceResult).toMatchObject({
      error: { code: "REPLACE_REGEX_INVALID" },
      ok: false
    });
  });

  it("returns an empty frontmatter result for fields that are not registered", async () => {
    await createActiveWorkspace({ "Note.md": "---\nstatus: draft\n---\n" });

    const result = await handlerFor(searchWorkspaceChannel)(undefined, {
      frontmatterField: "unknownField",
      mode: "frontmatter",
      query: "draft"
    });

    expect(result).toEqual({
      ok: true,
      value: { results: [], skippedLongLines: 0, skippedLargeFiles: 0, truncated: false }
    });
  });

  function handlerFor(channel: string): RegisteredHandler {
    const handler = electronMock.handle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1];
    if (!handler) throw new Error(`Handler not registered: ${channel}`);
    return handler as RegisteredHandler;
  }

  async function createActiveWorkspace(files: Record<string, string>): Promise<{
    userDataPath: string;
    workspacePath: string;
  }> {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-search-handler-user-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-search-handler-workspace-"));
    temporaryPaths.push(userDataPath, workspacePath);

    for (const [filePath, content] of Object.entries(files)) {
      await writeFile(path.join(workspacePath, filePath), content, "utf8");
    }

    const workspace = createWorkspaceSummary(workspacePath);
    await writeAppSettings(userDataPath, addOrActivateWorkspace({
      editorSettings: defaultEditorSettings,
      featureToggles: defaultFeatureToggles,
      frontmatterTemplates: defaultFrontmatterTemplates,
      lastWorkspaceId: null,
      userDefinedFields: [],
      workspaces: []
    }, workspace));
    electronMock.getPath.mockReturnValue(userDataPath);

    return { userDataPath, workspacePath };
  }
});

function isSuccessWithValue<T>(result: unknown): result is { ok: true; value: T } {
  return typeof result === "object" && result !== null && "ok" in result && result.ok === true && "value" in result;
}
