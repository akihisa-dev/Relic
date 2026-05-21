import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import en from "./locales/en.json";
import ja from "./locales/ja.json";

function sourceCards(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const cardPath = path.join(dir, name);
    const stat = statSync(cardPath);

    if (stat.isDirectory()) return sourceCards(cardPath);
    if (!/\.(ts|tsx)$/.test(cardPath) || /\.test\./.test(cardPath)) return [];

    return [cardPath];
  });
}

describe("i18n dictionaries", () => {
  it("keeps ja and en keys in sync", () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });

  it("does not reference missing literal translation keys", () => {
    const keys = new Set(Object.keys(en));
    const missing: Array<{ cardPath: string; key: string }> = [];
    const translationCallPattern = /\bt\(\s*["']([^"']+)["']/g;

    for (const cardPath of sourceCards(path.join(process.cwd(), "src"))) {
      const source = readFileSync(cardPath, "utf8");
      let match: RegExpExecArray | null;

      while ((match = translationCallPattern.exec(source))) {
        if (!keys.has(match[1])) missing.push({ cardPath, key: match[1] });
      }
    }

    expect(missing).toEqual([]);
  });
});
