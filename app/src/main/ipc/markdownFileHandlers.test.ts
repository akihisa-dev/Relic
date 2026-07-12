import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  getAppPath: vi.fn(),
  getPath: vi.fn(),
  handle: vi.fn(),
  isEmpty: vi.fn(),
  on: vi.fn(),
  createFromDataURL: vi.fn(),
  createFromPath: vi.fn(),
  showItemInFolder: vi.fn(),
  trashItem: vi.fn()
}));

vi.mock("electron", () => ({
  app: {
    getAppPath: electronMock.getAppPath,
    getPath: electronMock.getPath
  },
  ipcMain: {
    handle: electronMock.handle,
    on: electronMock.on
  },
  nativeImage: {
    createFromDataURL: electronMock.createFromDataURL,
    createFromPath: electronMock.createFromPath
  },
  shell: {
    showItemInFolder: electronMock.showItemInFolder,
    trashItem: electronMock.trashItem
  }
}));

import {
  createLinkedMarkdownFileChannel,
  createFolderChannel,
  createMarkdownFileChannel,
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  duplicateMarkdownFileChannel,
  getLinkUpdateImpactChannel,
  importImageFileChannel,
  importMarkdownFilesChannel,
  moveItemToTrashChannel,
  moveFolderChannel,
  moveMarkdownFileChannel,
  readImageFileChannel,
  readPdfFileChannel,
  renameFolderChannel,
  renameMarkdownFileChannel,
  revealWorkspaceItemChannel,
  startWorkspaceFileDragChannel
} from "../../shared/ipc";
import { workspaceDerivedDataSession } from "../files/workspaceDerivedDataSession";
import { writeAppSettings } from "../settings/appSettings";
import { addOrActivateWorkspace, createWorkspaceSummary } from "../workspace/workspaceService";
import { registerFolderItemHandlers } from "./folderItemHandlers";
import { registerMarkdownFileHandlers } from "./markdownFileHandlers";

describe("markdownFileHandlers", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    workspaceDerivedDataSession.invalidate();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  beforeEach(() => {
    const icon = { isEmpty: electronMock.isEmpty };
    electronMock.createFromDataURL.mockReturnValue(icon);
    electronMock.createFromPath.mockReturnValue(icon);
    electronMock.getAppPath.mockReturnValue("/tmp/relic-app");
    electronMock.isEmpty.mockReturnValue(false);
    electronMock.trashItem.mockResolvedValue(undefined);
  });

  it("場所表示ではワークスペース外を指すシンボリックリンクを開かない", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-"));
    temporaryPaths.push(userDataPath, workspacePath, outsidePath);

    await mkdir(path.join(workspacePath, "links"));
    await writeFile(path.join(outsidePath, "secret.md"), "# Outside\n", "utf8");
    await symlink(path.join(outsidePath, "secret.md"), path.join(workspacePath, "links", "secret.md"));

    const workspace = createWorkspaceSummary(workspacePath);
    const settings = addOrActivateWorkspace(
      {
        editorSettings: defaultEditorSettings,
        featureToggles: defaultFeatureToggles,
        frontmatterTemplates: defaultFrontmatterTemplates,
        lastWorkspaceId: null,
        userDefinedFields: [],
        workspaces: []
      },
      workspace
    );
    await writeAppSettings(userDataPath, settings);

    electronMock.getPath.mockReturnValue(userDataPath);
    registerMarkdownFileHandlers();
    const revealHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === revealWorkspaceItemChannel
    )?.[1];

    if (!revealHandler) throw new Error("reveal workspace item handler was not registered");

    const result = await revealHandler(undefined, { path: "links/secret.md" });

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    expect(electronMock.showItemInFolder).not.toHaveBeenCalled();
  });

  it("画像読み込みではワークスペース内の対応画像を返す", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    temporaryPaths.push(userDataPath, workspacePath);

    await mkdir(path.join(workspacePath, "assets"));
    await writeFile(path.join(workspacePath, "assets", "image.png"), "png-data");

    const workspace = createWorkspaceSummary(workspacePath);
    const settings = addOrActivateWorkspace(
      {
        editorSettings: defaultEditorSettings,
        featureToggles: defaultFeatureToggles,
        frontmatterTemplates: defaultFrontmatterTemplates,
        lastWorkspaceId: null,
        userDefinedFields: [],
        workspaces: []
      },
      workspace
    );
    await writeAppSettings(userDataPath, settings);

    electronMock.getPath.mockReturnValue(userDataPath);
    registerMarkdownFileHandlers();
    const readHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === readImageFileChannel
    )?.[1];

    if (!readHandler) throw new Error("read image file handler was not registered");

    const result = await readHandler(undefined, { path: "assets/image.png" });

    expect(result).toEqual({
      ok: true,
      value: { dataUrl: `data:image/png;base64,${Buffer.from("png-data").toString("base64")}` }
    });
  });

  it("PDF読み込みではワークスペース内のPDFを返す", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    temporaryPaths.push(userDataPath, workspacePath);

    await mkdir(path.join(workspacePath, "assets"));
    await writeFile(path.join(workspacePath, "assets", "reference.pdf"), "%PDF-1.7");

    const workspace = createWorkspaceSummary(workspacePath);
    const settings = addOrActivateWorkspace(
      {
        editorSettings: defaultEditorSettings,
        featureToggles: defaultFeatureToggles,
        frontmatterTemplates: defaultFrontmatterTemplates,
        lastWorkspaceId: null,
        userDefinedFields: [],
        workspaces: []
      },
      workspace
    );
    await writeAppSettings(userDataPath, settings);

    electronMock.getPath.mockReturnValue(userDataPath);
    registerMarkdownFileHandlers();
    const readHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === readPdfFileChannel
    )?.[1];

    if (!readHandler) throw new Error("read PDF file handler was not registered");

    const result = await readHandler(undefined, { path: "assets/reference.pdf" });

    expect(result).toEqual({
      ok: true,
      value: { dataUrl: `data:application/pdf;base64,${Buffer.from("%PDF-1.7").toString("base64")}` }
    });
  });

  it("Markdownの作成・リンク先作成・複製・名前変更・移動を順に反映する", async () => {
    const { workspace, workspacePath } = await createActiveWorkspace({
      "Original.md": "# Original",
      "Source.md": "[[Original]]"
    }, ["archive"]);
    const invalidateSpy = vi.spyOn(workspaceDerivedDataSession, "invalidate");
    registerMarkdownFileHandlers();

    const impactResult = await handlerFor(getLinkUpdateImpactChannel)(undefined, {
      kind: "file",
      newPath: "Renamed.md",
      oldPath: "Original.md"
    });
    expect(impactResult).toMatchObject({ ok: true, value: { fileCount: 1, linkCount: 1 } });

    const createResult = await handlerFor(createMarkdownFileChannel)(undefined, { name: "Created" });
    expect(createResult).toMatchObject({ ok: true, value: { activeWorkspace: workspace } });
    await expect(readFile(path.join(workspacePath, "Created.md"), "utf8")).resolves.toBe("");

    const linkedResult = await handlerFor(createLinkedMarkdownFileChannel)(undefined, { path: "nested/Linked.md" });
    expect(linkedResult).toMatchObject({
      ok: true,
      value: { file: { content: "", path: "nested/Linked.md" } }
    });

    const duplicateResult = await handlerFor(duplicateMarkdownFileChannel)(undefined, { path: "Created.md" });
    const duplicatedPath = resultFilePath(duplicateResult);
    await expect(readFile(path.join(workspacePath, duplicatedPath), "utf8")).resolves.toBe("");

    const renameResult = await handlerFor(renameMarkdownFileChannel)(undefined, {
      newName: "Renamed",
      path: duplicatedPath
    });
    expect(renameResult).toMatchObject({ ok: true, value: { file: { path: "Renamed.md" } } });

    const moveResult = await handlerFor(moveMarkdownFileChannel)(undefined, {
      destinationFolder: "archive",
      path: "Renamed.md"
    });
    expect(moveResult).toMatchObject({ ok: true, value: { file: { path: "archive/Renamed.md" } } });
    await expect(readFile(path.join(workspacePath, "archive", "Renamed.md"), "utf8")).resolves.toBe("");
    expect(invalidateSpy).toHaveBeenCalledTimes(5);
    expect(invalidateSpy).toHaveBeenCalledWith(workspace.id, undefined);
  });

  it("Markdownと画像を外部ファイルから追加し、追加後の画像を読み込む", async () => {
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-source-"));
    temporaryPaths.push(outsidePath);
    const markdownSource = path.join(outsidePath, "Imported.md");
    const imageSource = path.join(outsidePath, "picture.png");
    await writeFile(markdownSource, "# Imported", "utf8");
    await writeFile(imageSource, "png-data", "utf8");
    const { workspace, workspacePath } = await createActiveWorkspace({}, ["imports"]);
    const invalidateSpy = vi.spyOn(workspaceDerivedDataSession, "invalidate");
    registerMarkdownFileHandlers();

    const markdownResult = await handlerFor(importMarkdownFilesChannel)(undefined, {
      destinationFolder: "imports",
      sourcePaths: [markdownSource]
    });
    expect(markdownResult).toMatchObject({ ok: true, value: { activeWorkspace: workspace } });
    await expect(readFile(path.join(workspacePath, "imports", "Imported.md"), "utf8")).resolves.toBe("# Imported");

    const imageResult = await handlerFor(importImageFileChannel)(undefined, {
      destinationFolder: "imports",
      sourcePath: imageSource
    });
    expect(imageResult).toEqual({ ok: true, value: { path: "imports/picture.png" } });

    const readResult = await handlerFor(readImageFileChannel)(undefined, { path: "imports/picture.png" });
    expect(readResult).toEqual({
      ok: true,
      value: { dataUrl: `data:image/png;base64,${Buffer.from("png-data").toString("base64")}` }
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, workspace.id, undefined);
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, workspace.id, undefined);
  });

  it("外部ファイル追加の重複・種類・存在を検査し、ワークスペース内画像はそのまま返す", async () => {
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-source-"));
    temporaryPaths.push(outsidePath);
    const markdownSource = path.join(outsidePath, "Duplicate.md");
    const markdownDirectory = path.join(outsidePath, "Folder.md");
    const imageDirectory = path.join(outsidePath, "Folder.png");
    await writeFile(markdownSource, "# Duplicate", "utf8");
    await mkdir(markdownDirectory);
    await mkdir(imageDirectory);

    const { workspace, workspacePath } = await createActiveWorkspace(
      { "assets/inside.png": "inside-image" },
      ["assets/image-directory.png", "assets/pdf-directory.pdf"]
    );
    const invalidateSpy = vi.spyOn(workspaceDerivedDataSession, "invalidate");
    registerMarkdownFileHandlers();

    const duplicateImport = await handlerFor(importMarkdownFilesChannel)(undefined, {
      destinationFolder: "",
      sourcePaths: [markdownSource, markdownSource]
    });
    const directoryImport = await handlerFor(importMarkdownFilesChannel)(undefined, {
      destinationFolder: "",
      sourcePaths: [markdownDirectory]
    });
    const missingImport = await handlerFor(importMarkdownFilesChannel)(undefined, {
      destinationFolder: "",
      sourcePaths: [path.join(outsidePath, "Missing.md")]
    });
    const imageDirectoryImport = await handlerFor(importImageFileChannel)(undefined, {
      destinationFolder: "",
      sourcePath: imageDirectory
    });
    const existingImageImport = await handlerFor(importImageFileChannel)(undefined, {
      destinationFolder: "",
      sourcePath: path.join(workspacePath, "assets", "inside.png")
    });
    const imageDirectoryRead = await handlerFor(readImageFileChannel)(undefined, {
      path: "assets/image-directory.png"
    });
    const pdfDirectoryRead = await handlerFor(readPdfFileChannel)(undefined, {
      path: "assets/pdf-directory.pdf"
    });

    expect(duplicateImport).toMatchObject({ error: { code: "FILE_ALREADY_EXISTS" }, ok: false });
    expect(directoryImport).toMatchObject({ error: { code: "FILE_IMPORT_SOURCE_INVALID" }, ok: false });
    expect(missingImport).toMatchObject({ error: { code: "FILE_IMPORT_FAILED" }, ok: false });
    expect(imageDirectoryImport).toMatchObject({ error: { code: "IMAGE_IMPORT_SOURCE_INVALID" }, ok: false });
    expect(existingImageImport).toEqual({ ok: true, value: { path: "assets/inside.png" } });
    expect(imageDirectoryRead).toMatchObject({ error: { code: "IMAGE_READ_INVALID_FILE" }, ok: false });
    expect(pdfDirectoryRead).toMatchObject({ error: { code: "PDF_READ_INVALID_FILE" }, ok: false });
    expect(invalidateSpy).toHaveBeenCalledOnce();
    expect(invalidateSpy).toHaveBeenCalledWith(workspace.id, undefined);
  });

  it("安全なファイルだけをOSドラッグと場所表示へ渡す", async () => {
    const { workspace, workspacePath } = await createActiveWorkspace({ "Note.md": "# Note" }, ["Folder"]);
    const startDrag = vi.fn();
    registerMarkdownFileHandlers();

    await eventHandlerFor(startWorkspaceFileDragChannel)({ sender: { startDrag } }, { paths: ["Note.md"] });

    expect(startDrag).toHaveBeenCalledWith({
      file: path.join(workspacePath, "Note.md"),
      files: [path.join(workspacePath, "Note.md")],
      icon: expect.anything()
    });

    electronMock.isEmpty.mockReturnValue(true);
    await eventHandlerFor(startWorkspaceFileDragChannel)({ sender: { startDrag } }, { paths: ["Note.md"] });
    expect(electronMock.createFromDataURL).toHaveBeenCalledOnce();

    await eventHandlerFor(startWorkspaceFileDragChannel)({ sender: { startDrag } }, { paths: [] });
    await eventHandlerFor(startWorkspaceFileDragChannel)({ sender: { startDrag } }, { paths: ["Missing.md"] });
    await eventHandlerFor(startWorkspaceFileDragChannel)({ sender: { startDrag } }, { paths: ["Folder"] });
    expect(startDrag).toHaveBeenCalledTimes(2);

    const revealResult = await handlerFor(revealWorkspaceItemChannel)(undefined, { path: "Note.md" });
    expect(revealResult).toEqual({ ok: true, value: undefined });
    expect(electronMock.showItemInFolder).toHaveBeenCalledWith(path.join(workspacePath, "Note.md"));

    const registeredWorkspaceResult = await handlerFor(revealWorkspaceItemChannel)(undefined, {
      path: "",
      workspaceId: workspace.id
    });
    expect(registeredWorkspaceResult).toEqual({ ok: true, value: undefined });

    const missingWorkspaceResult = await handlerFor(revealWorkspaceItemChannel)(undefined, {
      path: "",
      workspaceId: "missing"
    });
    expect(missingWorkspaceResult).toMatchObject({ error: { code: "WORKSPACE_NOT_FOUND" }, ok: false });
  });

  it("Markdownファイルをゴミ箱へ渡し、成功後だけ派生データを無効化する", async () => {
    const { workspace, workspacePath } = await createActiveWorkspace({ "Trash.md": "# Trash" });
    const invalidateSpy = vi.spyOn(workspaceDerivedDataSession, "invalidate");
    electronMock.trashItem.mockImplementation((absolutePath: string) => rm(absolutePath, { force: true }));
    registerFolderItemHandlers();

    const result = await handlerFor(moveItemToTrashChannel)(undefined, { path: "Trash.md", type: "file" });

    expect(result).toMatchObject({
      ok: true,
      value: { activeWorkspace: workspace, fileTree: [] }
    });
    expect(electronMock.trashItem).toHaveBeenCalledWith(path.join(workspacePath, "Trash.md"));
    expect(invalidateSpy).toHaveBeenCalledOnce();
    expect(invalidateSpy).toHaveBeenCalledWith(workspace.id, undefined);
  });

  it("フォルダの作成・名前変更・移動・ゴミ箱移動を順に反映する", async () => {
    const { workspace, workspacePath } = await createActiveWorkspace({}, ["Destination"]);
    const invalidateSpy = vi.spyOn(workspaceDerivedDataSession, "invalidate");
    electronMock.trashItem.mockImplementation((absolutePath: string) => rm(absolutePath, { force: true, recursive: true }));
    registerFolderItemHandlers();

    const createResult = await handlerFor(createFolderChannel)(undefined, {
      name: "Folder",
      parentFolder: "Destination"
    });
    expect(createResult).toMatchObject({ ok: true, value: { activeWorkspace: workspace } });

    const renameResult = await handlerFor(renameFolderChannel)(undefined, {
      newName: "Renamed",
      path: "Destination/Folder"
    });
    expect(renameResult).toMatchObject({ ok: true });

    const moveResult = await handlerFor(moveFolderChannel)(undefined, {
      destinationFolder: "",
      path: "Destination/Renamed"
    });
    expect(moveResult).toMatchObject({ ok: true });

    const trashResult = await handlerFor(moveItemToTrashChannel)(undefined, {
      path: "Renamed",
      type: "folder"
    });
    expect(trashResult).toMatchObject({ ok: true });
    expect(electronMock.trashItem).toHaveBeenCalledWith(path.join(workspacePath, "Renamed"));
    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenLastCalledWith(workspace.id, undefined);
  });

  it.each([
    [getLinkUpdateImpactChannel, { kind: "invalid", newPath: "B.md", oldPath: "A.md" }, "LINK_UPDATE_IMPACT_INVALID_INPUT"],
    [createMarkdownFileChannel, null, "FILE_CREATE_INVALID_INPUT"],
    [importMarkdownFilesChannel, { destinationFolder: "../outside", sourcePaths: ["/tmp/A.md"] }, "FILE_IMPORT_INVALID_INPUT"],
    [importImageFileChannel, { destinationFolder: "../outside", sourcePath: "/tmp/image.png" }, "IMAGE_IMPORT_INVALID_INPUT"],
    [readImageFileChannel, { path: "../outside.png" }, "IMAGE_READ_INVALID_INPUT"],
    [readPdfFileChannel, { path: "../outside.pdf" }, "PDF_READ_INVALID_INPUT"],
    [createLinkedMarkdownFileChannel, { path: "../outside.md" }, "FILE_CREATE_INVALID_INPUT"],
    [duplicateMarkdownFileChannel, { path: "../outside.md" }, "FILE_DUPLICATE_INVALID_INPUT"],
    [renameMarkdownFileChannel, { newName: "Renamed", path: "../outside.md" }, "FILE_RENAME_INVALID_INPUT"],
    [moveMarkdownFileChannel, { destinationFolder: "../outside", path: "Note.md" }, "FILE_MOVE_INVALID_INPUT"],
    [revealWorkspaceItemChannel, { path: "../outside.md" }, "REVEAL_INVALID_INPUT"]
  ])("入力境界で不正なパスを拒否する: %s", async (channel, input, code) => {
    registerMarkdownFileHandlers();

    const result = await handlerFor(channel)(undefined, input);

    expect(result).toMatchObject({ error: { code }, ok: false });
    expect(electronMock.getPath).not.toHaveBeenCalled();
  });

  it.each([
    [createFolderChannel, null, "FOLDER_CREATE_INVALID_INPUT"],
    [createFolderChannel, { name: "Folder", parentFolder: "../outside" }, "FOLDER_CREATE_INVALID_INPUT"],
    [moveFolderChannel, { destinationFolder: "", path: "../outside" }, "FOLDER_MOVE_INVALID_INPUT"],
    [moveFolderChannel, { destinationFolder: "../outside", path: "Folder" }, "FOLDER_MOVE_INVALID_INPUT"],
    [renameFolderChannel, { newName: "Renamed", path: "../outside" }, "FOLDER_RENAME_INVALID_INPUT"],
    [renameFolderChannel, { path: "Folder" }, "FOLDER_RENAME_INVALID_INPUT"],
    [moveItemToTrashChannel, { path: "../outside.md", type: "file" }, "TRASH_MOVE_INVALID_INPUT"],
    [moveItemToTrashChannel, { path: "Note.md", type: "unknown" }, "TRASH_MOVE_INVALID_INPUT"]
  ])("フォルダ操作の不正入力をIPC境界で拒否する: %s", async (channel, input, code) => {
    registerFolderItemHandlers();

    const result = await handlerFor(channel)(undefined, input);

    expect(result).toMatchObject({ error: { code }, ok: false });
    expect(electronMock.getPath).not.toHaveBeenCalled();
  });

  it("active workspaceがなければ有効な作成要求も拒否する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
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
    registerMarkdownFileHandlers();
    registerFolderItemHandlers();

    const requests: Array<[string, unknown]> = [
      [getLinkUpdateImpactChannel, { kind: "file", newPath: "B.md", oldPath: "A.md" }],
      [createMarkdownFileChannel, { name: "Note" }],
      [importMarkdownFilesChannel, { destinationFolder: "", sourcePaths: ["/tmp/A.md"] }],
      [importImageFileChannel, { destinationFolder: "", sourcePath: "/tmp/image.png" }],
      [readImageFileChannel, { path: "image.png" }],
      [readPdfFileChannel, { path: "document.pdf" }],
      [createLinkedMarkdownFileChannel, { path: "A.md" }],
      [duplicateMarkdownFileChannel, { path: "A.md" }],
      [renameMarkdownFileChannel, { newName: "B", path: "A.md" }],
      [moveMarkdownFileChannel, { destinationFolder: "", path: "A.md" }],
      [revealWorkspaceItemChannel, { path: "" }],
      [createFolderChannel, { name: "Folder" }],
      [moveFolderChannel, { destinationFolder: "", path: "Folder" }],
      [renameFolderChannel, { newName: "Renamed", path: "Folder" }],
      [moveItemToTrashChannel, { path: "Folder", type: "folder" }]
    ];

    for (const [channel, input] of requests) {
      const result = await handlerFor(channel)(undefined, input);
      expect(result).toMatchObject({ error: { code: "WORKSPACE_NOT_SELECTED" }, ok: false });
    }
  });

  it("domain失敗時は派生データを無効化しない", async () => {
    await createActiveWorkspace({ "Existing.md": "# Existing" }, ["ExistingFolder"]);
    const invalidateSpy = vi.spyOn(workspaceDerivedDataSession, "invalidate");
    registerMarkdownFileHandlers();
    registerFolderItemHandlers();

    const createResult = await handlerFor(createMarkdownFileChannel)(undefined, { name: "Existing" });
    const duplicateResult = await handlerFor(duplicateMarkdownFileChannel)(undefined, { path: "Missing.md" });
    const imageResult = await handlerFor(importImageFileChannel)(undefined, {
      destinationFolder: "",
      sourcePath: "/tmp/unsupported.txt"
    });
    const importResult = await handlerFor(importMarkdownFilesChannel)(undefined, {
      destinationFolder: "",
      sourcePaths: ["/tmp/unsupported.txt"]
    });
    const linkedResult = await handlerFor(createLinkedMarkdownFileChannel)(undefined, { path: "unsupported.txt" });
    const renameResult = await handlerFor(renameMarkdownFileChannel)(undefined, {
      newName: "Renamed",
      path: "Missing.md"
    });
    const moveResult = await handlerFor(moveMarkdownFileChannel)(undefined, {
      destinationFolder: "",
      path: "Missing.md"
    });
    const createFolderResult = await handlerFor(createFolderChannel)(undefined, { name: "ExistingFolder" });
    const moveFolderResult = await handlerFor(moveFolderChannel)(undefined, {
      destinationFolder: "",
      path: "MissingFolder"
    });
    const renameFolderResult = await handlerFor(renameFolderChannel)(undefined, {
      newName: "Renamed",
      path: "MissingFolder"
    });
    const trashResult = await handlerFor(moveItemToTrashChannel)(undefined, {
      path: "Existing.md",
      type: "folder"
    });

    expect(createResult).toMatchObject({ error: { code: "FILE_ALREADY_EXISTS" }, ok: false });
    expect(duplicateResult).toMatchObject({ ok: false });
    expect(imageResult).toMatchObject({ error: { code: "IMAGE_IMPORT_TYPE_UNSUPPORTED" }, ok: false });
    expect(importResult).toMatchObject({ error: { code: "FILE_TYPE_UNSUPPORTED" }, ok: false });
    expect(linkedResult).toMatchObject({ error: { code: "FILE_TYPE_UNSUPPORTED" }, ok: false });
    expect(renameResult).toMatchObject({ ok: false });
    expect(moveResult).toMatchObject({ ok: false });
    expect(createFolderResult).toMatchObject({ error: { code: "FOLDER_ALREADY_EXISTS" }, ok: false });
    expect(moveFolderResult).toMatchObject({ ok: false });
    expect(renameFolderResult).toMatchObject({ ok: false });
    expect(trashResult).toMatchObject({ error: { code: "TRASH_NOT_FOLDER" }, ok: false });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("予期しない例外を伏せ字付きIPC失敗へ変換する", async () => {
    electronMock.getPath.mockImplementation(() => {
      throw new Error("settings failed SERVICE_API_KEY=secret-value");
    });
    registerMarkdownFileHandlers();

    const result = await handlerFor(createMarkdownFileChannel)(undefined, { name: "Note" });

    expect(result).toEqual({
      error: {
        code: "FILE_CREATE_FAILED",
        details: "settings failed SERVICE_API_KEY=[redacted]",
        message: "ファイルを作成できませんでした。"
      },
      ok: false
    });
  });

  it.each([
    [getLinkUpdateImpactChannel, { kind: "file", newPath: "B.md", oldPath: "A.md" }, "LINK_UPDATE_IMPACT_FAILED"],
    [createMarkdownFileChannel, { name: "Note" }, "FILE_CREATE_FAILED"],
    [importMarkdownFilesChannel, { destinationFolder: "", sourcePaths: ["/tmp/A.md"] }, "FILE_IMPORT_FAILED"],
    [importImageFileChannel, { destinationFolder: "", sourcePath: "/tmp/image.png" }, "IMAGE_IMPORT_FAILED"],
    [readImageFileChannel, { path: "image.png" }, "IMAGE_READ_FAILED"],
    [readPdfFileChannel, { path: "document.pdf" }, "PDF_READ_FAILED"],
    [createLinkedMarkdownFileChannel, { path: "A.md" }, "FILE_CREATE_FAILED"],
    [duplicateMarkdownFileChannel, { path: "A.md" }, "FILE_DUPLICATE_FAILED"],
    [renameMarkdownFileChannel, { newName: "B", path: "A.md" }, "FILE_RENAME_FAILED"],
    [moveMarkdownFileChannel, { destinationFolder: "", path: "A.md" }, "FILE_MOVE_FAILED"],
    [revealWorkspaceItemChannel, { path: "" }, "REVEAL_FAILED"],
    [createFolderChannel, { name: "Folder" }, "FOLDER_CREATE_FAILED"],
    [moveFolderChannel, { destinationFolder: "", path: "Folder" }, "FOLDER_MOVE_FAILED"],
    [renameFolderChannel, { newName: "Renamed", path: "Folder" }, "FOLDER_RENAME_FAILED"],
    [moveItemToTrashChannel, { path: "Folder", type: "folder" }, "TRASH_MOVE_FAILED"]
  ])("予期しないworkspace取得例外を各IPCの失敗へ変換する: %s", async (channel, input, code) => {
    electronMock.getPath.mockImplementation(() => {
      throw new Error("settings failed SERVICE_API_KEY=secret-value");
    });
    registerMarkdownFileHandlers();
    registerFolderItemHandlers();

    const result = await handlerFor(channel)(undefined, input);

    expect(result).toMatchObject({
      error: {
        code,
        details: "settings failed SERVICE_API_KEY=[redacted]"
      },
      ok: false
    });
  });

  function handlerFor(channel: string): (event: unknown, input: unknown) => Promise<unknown> {
    const handler = electronMock.handle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1];
    if (!handler) throw new Error(`Handler not registered: ${channel}`);
    return handler;
  }

  function eventHandlerFor(channel: string): (event: unknown, input: unknown) => Promise<void> {
    const handler = electronMock.on.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1];
    if (!handler) throw new Error(`Event handler not registered: ${channel}`);
    return handler;
  }

  async function createActiveWorkspace(
    files: Record<string, string>,
    directories: string[] = []
  ): Promise<{
    userDataPath: string;
    workspace: ReturnType<typeof createWorkspaceSummary>;
    workspacePath: string;
  }> {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    temporaryPaths.push(userDataPath, workspacePath);

    for (const directory of directories) {
      await mkdir(path.join(workspacePath, directory), { recursive: true });
    }
    for (const [relativePath, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(workspacePath, relativePath)), { recursive: true });
      await writeFile(path.join(workspacePath, relativePath), content, "utf8");
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
    return { userDataPath, workspace, workspacePath };
  }
});

function resultFilePath(result: unknown): string {
  if (
    typeof result !== "object" ||
    result === null ||
    !("ok" in result) ||
    result.ok !== true ||
    !("value" in result) ||
    typeof result.value !== "object" ||
    result.value === null ||
    !("file" in result.value) ||
    typeof result.value.file !== "object" ||
    result.value.file === null ||
    !("path" in result.value.file) ||
    typeof result.value.file.path !== "string"
  ) {
    throw new Error("Expected file result");
  }

  return result.value.file.path;
}
