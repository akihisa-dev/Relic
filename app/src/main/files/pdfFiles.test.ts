import { mkdtemp, rm, stat, symlink, truncate, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { maxPdfReadBytes } from "../../shared/ipc/files";
import { readPdfFile } from "./pdfFiles";

describe("readPdfFile", () => {
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

  it("ワークスペース内のPDFをdata URLとして返す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-pdf-workspace-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "document.pdf"), "pdf-data");

    const result = await readPdfFile(workspacePath, "document.pdf");

    expect(result).toEqual({
      ok: true,
      value: { dataUrl: `data:application/pdf;base64,${Buffer.from("pdf-data").toString("base64")}` }
    });
  });

  it("読み取り直前にワークスペース外へ差し替えられたPDFは読まない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-pdf-workspace-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-pdf-outside-"));
    temporaryPaths.push(workspacePath, outsidePath);
    const pdfPath = path.join(workspacePath, "document.pdf");
    const outsidePdfPath = path.join(outsidePath, "outside.pdf");
    await writeFile(pdfPath, "pdf-data");
    await writeFile(outsidePdfPath, "outside");

    const swapToOutsideAfterStat = (async (targetPath) => {
        const fileStat = await stat(targetPath);
        await unlink(targetPath);
        await symlink(outsidePdfPath, targetPath);
        return fileStat;
      }) as typeof stat;

    const result = await readPdfFile(workspacePath, "document.pdf", {
      stat: swapToOutsideAfterStat
    });

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
  });

  it("上限を超えるPDFはreadFileせず拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-pdf-workspace-"));
    temporaryPaths.push(workspacePath);
    const pdfPath = path.join(workspacePath, "large.pdf");
    await writeFile(pdfPath, "x");
    await truncate(pdfPath, maxPdfReadBytes + 1);
    const read = async () => {
      throw new Error("readFile must not be called");
    };

    await expect(readPdfFile(workspacePath, "large.pdf", { readFile: read })).resolves.toMatchObject({
      error: { code: "PDF_READ_TOO_LARGE" },
      ok: false
    });
  });

  it("stat後に本文が上限を超えたPDFはdata URLを作らない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-pdf-workspace-"));
    temporaryPaths.push(workspacePath);
    const pdfPath = path.join(workspacePath, "grown.pdf");
    await writeFile(pdfPath, "x");

    const result = await readPdfFile(workspacePath, "grown.pdf", {
      readFile: async () => Buffer.alloc(maxPdfReadBytes + 1) as never
    });

    expect(result).toMatchObject({
      error: { code: "PDF_READ_TOO_LARGE" },
      ok: false
    });
  });

  it("読み込み中の実体差替えをread後のidentity再確認で拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-pdf-workspace-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-pdf-outside-"));
    temporaryPaths.push(workspacePath, outsidePath);
    const pdfPath = path.join(workspacePath, "document.pdf");
    const outsidePdfPath = path.join(outsidePath, "outside.pdf");
    await writeFile(pdfPath, "pdf-data");
    await writeFile(outsidePdfPath, "outside");

    let swapped = false;
    const readRealpath = vi.fn(async (targetPath: string) => {
      if (targetPath === workspacePath) return workspacePath;
      return swapped ? outsidePdfPath : pdfPath;
    });
    const read = vi.fn(async () => {
      swapped = true;
      return Buffer.from("pdf-data");
    });

    await expect(readPdfFile(workspacePath, "document.pdf", {
      readFile: read as never,
      realpath: readRealpath
    })).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    expect(read).toHaveBeenCalledTimes(1);
  });
});
