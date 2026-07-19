import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import en from "./locales/en.json";
import ja from "./locales/ja.json";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const filePath = path.join(dir, name);
    const stat = statSync(filePath);

    if (stat.isDirectory()) return sourceFiles(filePath);
    if (!/\.(ts|tsx)$/.test(filePath) || /\.test\./.test(filePath)) return [];

    return [filePath];
  });
}

describe("i18n dictionaries", () => {
  it("keeps ja and en keys in sync", () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });

  it("shows the current chronicle frontmatter format in both languages", () => {
    const singleYearExample = "chronicle:\n  calendar: 西暦\n  start: 1185\n  end: 1185";
    const rangeExample = "chronicle:\n  calendar: 西暦\n  start: 1185\n  end: 1333";

    expect(ja["settings.fixedFieldChronicleSingleExample"]).toBe(singleYearExample);
    expect(en["settings.fixedFieldChronicleSingleExample"]).toBe(singleYearExample);
    expect(ja["settings.fixedFieldChronicleRangeExample"]).toBe(rangeExample);
    expect(en["settings.fixedFieldChronicleRangeExample"]).toBe(rangeExample);
  });

  it("does not reference missing literal translation keys", () => {
    const keys = new Set(Object.keys(en));
    const missing: Array<{ filePath: string; key: string }> = [];
    const translationCallPattern = /\bt\(\s*["']([^"']+)["']/g;

    for (const filePath of sourceFiles(path.join(process.cwd(), "src"))) {
      const source = readFileSync(filePath, "utf8");
      let match: RegExpExecArray | null;

      while ((match = translationCallPattern.exec(source))) {
        if (!keys.has(match[1])) missing.push({ filePath, key: match[1] });
      }
    }

    expect(missing).toEqual([]);
  });

  it("does not leave literal natural-language accessibility labels in UI components", () => {
    const untranslated: Array<{ filePath: string; label: string }> = [];
    const literalNaturalLanguageAriaLabelPattern = /aria-label\s*=\s*["']([^"']*[A-Za-zぁ-んァ-ヶ一-龠][^"']*)["']/g;

    for (const filePath of sourceFiles(path.join(process.cwd(), "src", "renderer"))) {
      const source = readFileSync(filePath, "utf8");
      let match: RegExpExecArray | null;

      while ((match = literalNaturalLanguageAriaLabelPattern.exec(source))) {
        untranslated.push({ filePath, label: match[1] });
      }
    }

    expect(untranslated).toEqual([]);
  });

  it("routes main IPC results through the localization boundary", () => {
    const directRegistrations = sourceFiles(path.join(process.cwd(), "src", "main"))
      .filter((filePath) => !filePath.endsWith("localizedIpcHandler.ts"))
      .filter((filePath) => readFileSync(filePath, "utf8").includes("ipcMain.handle"));

    expect(directRegistrations).toEqual([]);
  });
});
