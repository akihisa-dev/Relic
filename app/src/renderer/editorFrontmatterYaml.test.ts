import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";

import {
  findFrontmatterBlock,
  hasInvalidFrontmatterYaml,
  maxFrontmatterYamlAliases,
  maxFrontmatterYamlBytes,
  maxFrontmatterYamlDepth,
  maxFrontmatterYamlLines
} from "./editorFrontmatterYaml";

describe("renderer frontmatter YAML safety", () => {
  it("keeps ordinary unknown fields valid", () => {
    expect(hasInvalidFrontmatterYaml("---\ncustom: value\n---\n本文")).toBe(false);
    expect(findFrontmatterBlock(EditorState.create({ doc: "---\ncustom: value\n---\n本文" }))?.data)
      .toEqual({ custom: "value" });
  });

  it("rejects oversized YAML before parsing", () => {
    const value = `---\nvalue: ${"x".repeat(maxFrontmatterYamlBytes)}\n---\n本文`;
    expect(hasInvalidFrontmatterYaml(value)).toBe(true);
  });

  it("rejects excessive lines, aliases, and indentation depth", () => {
    const manyLines = `---\n${Array.from({ length: maxFrontmatterYamlLines }, (_, index) => `k${index}: v`).join("\n")}\n---\n本文`;
    expect(hasInvalidFrontmatterYaml(manyLines)).toBe(true);

    const aliases = ["base: &base {value: 1}", ...Array.from({ length: maxFrontmatterYamlAliases }, (_, index) => `k${index}: *base`)].join("\n");
    expect(hasInvalidFrontmatterYaml(`---\n${aliases}\n---\n本文`)).toBe(true);

    const punctuatedAliases = ["base: &base.name/path {value: 1}", ...Array.from({ length: maxFrontmatterYamlAliases }, (_, index) => `k${index}: *base.name/path`)].join("\n");
    expect(hasInvalidFrontmatterYaml(`---\n${punctuatedAliases}\n---\n本文`)).toBe(true);

    const deep = `${"  ".repeat(maxFrontmatterYamlDepth + 1)}value: true`;
    expect(hasInvalidFrontmatterYaml(`---\nroot:\n${deep}\n---\n本文`)).toBe(true);
  });

  it("rejects prototype-polluting keys in the renderer parser", () => {
    for (const key of ["__proto__", "prototype", "constructor"]) {
      expect(hasInvalidFrontmatterYaml(`---\n${key}:\n  polluted: true\n---\n本文`)).toBe(true);
      expect(findFrontmatterBlock(EditorState.create({ doc: `---\n${key}:\n  polluted: true\n---\n本文` })))
        .toBeNull();
    }
  });

  it("rejects deeply nested flow YAML before accepting the object", () => {
    const nested = Array.from({ length: 66 }, (_, index) => `[${index}: `).join("") + "value" + "]".repeat(66);
    expect(hasInvalidFrontmatterYaml(`---\nvalue: ${nested}\n---\n本文`)).toBe(true);
  });
});
