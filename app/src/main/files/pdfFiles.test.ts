import { mkdtemp, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

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
});
