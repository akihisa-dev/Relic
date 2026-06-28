import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails } from "./fileSystem";
import {
  createWorkspaceDerivedDataCache,
  frontmatterForRecord,
  normalizeWorkspaceDerivedDataOptions,
  readableWorkspaceMarkdownRecords,
  readWorkspaceDerivedFileIndex,
  type WorkspaceDerivedDataOptions,
  type WorkspaceMarkdownReadOperations
} from "./workspaceDerivedData";

export async function readFrontmatterValueCandidates(
  workspacePath: string,
  optionsOrOperations: WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations = {}
): Promise<RelicResult<Record<string, string[]>>> {
  try {
    const options = normalizeWorkspaceDerivedDataOptions(optionsOrOperations);
    const parseCache = options.parseCache ?? createWorkspaceDerivedDataCache();
    const fileIndex = await readWorkspaceDerivedFileIndex(workspacePath, options);
    const valuesByField = new Map<string, Set<string>>();

    for (const record of readableWorkspaceMarkdownRecords(fileIndex)) {
      const { data } = frontmatterForRecord(record, parseCache);

      for (const [fieldName, value] of Object.entries(data)) {
        const fieldValues = valuesByField.get(fieldName) ?? new Set<string>();
        const values = stringifyCandidateValues(value);

        for (const item of values) fieldValues.add(item);
        valuesByField.set(fieldName, fieldValues);
      }
    }

    return ok(Object.fromEntries(
      Array.from(valuesByField.entries())
        .toSorted(([a], [b]) => a.localeCompare(b, "ja"))
        .map(([fieldName, values]) => [
          fieldName,
          Array.from(values).toSorted((a, b) => a.localeCompare(b, "ja"))
        ])
    ));
  } catch (error) {
    return fail(
      "FRONTMATTER_VALUE_CANDIDATES_READ_FAILED",
      "フロントマター候補を読み込めませんでした。",
      errorDetails(error)
    );
  }
}

function stringifyCandidateValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringifyCandidateValues(item));
  }

  if (value instanceof Date) {
    return [value.toISOString().slice(0, 10)];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  return [];
}
