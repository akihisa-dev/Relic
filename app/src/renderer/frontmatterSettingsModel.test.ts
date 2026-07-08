import { describe, expect, it } from "vitest";

import {
  FIXED_FIELDS,
  parseChoiceInput,
  uniqueChoices
} from "./frontmatterSettingsModel";

describe("frontmatterSettingsModel", () => {
  it("parses and deduplicates choice input", () => {
    expect(parseChoiceInput("draft, review\n done ,,")).toEqual(["draft", "review", "done"]);
    expect(uniqueChoices(["draft", "draft", "done"])).toEqual(["draft", "done"]);
  });

  it("keeps all fixed properties visible in a stable order", () => {
    expect(FIXED_FIELDS.map((field) => field.name)).toEqual(["aliases", "tags", "category", "chronicle"]);
  });
});
