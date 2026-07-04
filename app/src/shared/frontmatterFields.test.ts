import { describe, expect, it } from "vitest";

import {
  isUserDefinedFieldType,
  isReservedFrontmatterFieldName,
  isValidUserDefinedFieldName,
  reservedFrontmatterFieldNames,
  userDefinedFieldTypes,
  userDefinedFieldTypeNeedsChoices
} from "./frontmatterFields";

describe("frontmatterFields", () => {
  it("defines reserved frontmatter field names in one place", () => {
    expect(reservedFrontmatterFieldNames).toEqual([
      "aliases",
      "category",
      "tags",
      "chronicle"
    ]);
  });

  it("detects reserved frontmatter names", () => {
    expect(isReservedFrontmatterFieldName("status")).toBe(false);
    expect(isReservedFrontmatterFieldName("plannedDate")).toBe(false);
    expect(isReservedFrontmatterFieldName("actualDate")).toBe(false);
    expect(isReservedFrontmatterFieldName("category")).toBe(true);
    expect(isReservedFrontmatterFieldName("chronicle")).toBe(true);
    expect(isReservedFrontmatterFieldName("chronicle0")).toBe(false);
    expect(isReservedFrontmatterFieldName("custom")).toBe(false);
  });

  it("defines user-defined field types and choice-capable types in one place", () => {
    expect(userDefinedFieldTypes).toEqual([
      "text",
      "number",
      "date",
      "datetime",
      "time",
      "boolean",
      "select",
      "multi-select",
      "url"
    ]);
    expect(isUserDefinedFieldType("select")).toBe(true);
    expect(isUserDefinedFieldType("unknown")).toBe(false);
    expect(userDefinedFieldTypeNeedsChoices("select")).toBe(true);
    expect(userDefinedFieldTypeNeedsChoices("multi-select")).toBe(true);
    expect(userDefinedFieldTypeNeedsChoices("text")).toBe(false);
  });

  it("validates user-defined field names with reserved names", () => {
    expect(isValidUserDefinedFieldName("project")).toBe(true);
    expect(isValidUserDefinedFieldName("status")).toBe(true);
    expect(isValidUserDefinedFieldName("category")).toBe(false);
    expect(isValidUserDefinedFieldName(" planned")).toBe(false);
    expect(isValidUserDefinedFieldName("bad:name")).toBe(false);
  });
});
