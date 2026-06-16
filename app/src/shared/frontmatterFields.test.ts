import { describe, expect, it } from "vitest";

import {
  isReservedFrontmatterFieldName,
  reservedFrontmatterFieldNames
} from "./frontmatterFields";

describe("frontmatterFields", () => {
  it("defines reserved frontmatter field names in one place", () => {
    expect(reservedFrontmatterFieldNames).toEqual([
      "aliases",
      "tags",
      "status",
      "chronicle0",
      "chronicle1",
      "chronicle2",
      "chronicle3",
      "chronicle4",
      "chronicle5",
      "chronicle6",
      "chronicle7",
      "chronicle8",
      "chronicle9",
      "plannedDate",
      "actualDate"
    ]);
  });

  it("detects reserved frontmatter names", () => {
    expect(isReservedFrontmatterFieldName("status")).toBe(true);
    expect(isReservedFrontmatterFieldName("plannedDate")).toBe(true);
    expect(isReservedFrontmatterFieldName("custom")).toBe(false);
  });
});
