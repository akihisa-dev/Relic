import * as yaml from "js-yaml";

import type {
  WorkspaceTable,
  WorkspaceTablePreferences,
  WorkspaceTableRow,
  WorkspaceTableValue
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails } from "./fileSystem";
import {
  createWorkspaceDerivedDataCache,
  inspectedFrontmatterForRecord,
  normalizeWorkspaceDerivedDataOptions,
  readWorkspaceDerivedFileIndex,
  type WorkspaceDerivedDataOptions,
  type WorkspaceMarkdownReadOperations
} from "./workspaceDerivedData";

const propertyCollator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });

export async function readWorkspaceTable(
  workspacePath: string,
  preferences: WorkspaceTablePreferences,
  optionsOrOperations: WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations = {}
): Promise<RelicResult<WorkspaceTable>> {
  try {
    const options = normalizeWorkspaceDerivedDataOptions(optionsOrOperations);
    const parseCache = options.parseCache ?? createWorkspaceDerivedDataCache();
    const fileIndex = await readWorkspaceDerivedFileIndex(workspacePath, options);
    const properties = new Set<string>();
    const rows: WorkspaceTableRow[] = fileIndex.records.map((record) => {
      if (record.readStatus !== "ok" || !record.searchable) {
        return {
          frontmatterStatus: "invalid",
          name: record.name,
          path: record.path,
          properties: {}
        };
      }

      const inspected = inspectedFrontmatterForRecord(record, parseCache);
      const rowProperties = Object.fromEntries(
        Object.entries(inspected.data).map(([name, value]) => {
          properties.add(name);
          return [name, tableValueFor(value)];
        })
      );

      return {
        frontmatterStatus: inspected.status,
        name: record.name,
        path: record.path,
        properties: rowProperties
      };
    });
    const availableProperties = Array.from(properties).sort(propertyCollator.compare);
    const availableSet = new Set(availableProperties);

    return ok({
      availableProperties,
      rows,
      preferences: normalizeTablePreferences(preferences, availableSet)
    });
  } catch (error) {
    return fail(
      "WORKSPACE_TABLE_FAILED",
      "テーブルを読み込めませんでした。",
      errorDetails(error)
    );
  }
}

function normalizeTablePreferences(
  preferences: WorkspaceTablePreferences,
  availableProperties: Set<string>
): WorkspaceTablePreferences {
  const selectedProperties = preferences.selectedProperties.filter((property) => availableProperties.has(property));
  const selectedSet = new Set(selectedProperties);
  return {
    columnWidths: preferences.columnWidths.filter((entry) => selectedSet.has(entry.property)),
    fileColumnWidth: preferences.fileColumnWidth,
    filters: preferences.filters.filter((filter) => filter.target !== "property" || (filter.property !== undefined && availableProperties.has(filter.property))),
    selectedProperties,
    sort: preferences.sort.property === null || selectedSet.has(preferences.sort.property)
      ? preferences.sort
      : { direction: "asc", property: null },
    wrappedProperties: preferences.wrappedProperties.filter((property) => selectedSet.has(property))
  };
}

export function tableValueFor(value: unknown): WorkspaceTableValue {
  if (value === null || value === undefined) return { kind: "null", text: "null" };
  if (typeof value === "string") {
    return value.length === 0
      ? { kind: "empty-string", text: "\"\"" }
      : { kind: "string", text: value };
  }
  if (typeof value === "number") {
    return { kind: "number", numberValue: value, text: String(value) };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value, kind: "boolean", text: String(value) };
  }
  if (value instanceof Date) {
    const iso = value.toISOString();
    return { kind: "date", text: iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso };
  }
  if (Array.isArray(value)) {
    return value.length === 0
      ? { kind: "empty-array", text: "[]" }
      : { kind: "array", text: compactYaml(value) };
  }
  if (typeof value === "object") {
    return { kind: "object", text: compactYaml(value) };
  }

  return { kind: "string", text: String(value) };
}

function compactYaml(value: unknown): string {
  return yaml.dump(value, {
    flowLevel: 0,
    forceQuotes: false,
    lineWidth: -1,
    noRefs: true
  }).trim().replace(/\s*\r?\n\s*/g, " ");
}
