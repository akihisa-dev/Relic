import { describe, expect, it } from "vitest";

import type { UpdateChartEntryInput } from "../shared/ipc";
import { normalizeWorkspaceCharts, updateChartFrontmatter } from "./chartData";

const day = (value: string): number =>
  Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 86_400_000);

function dateEditInput(overrides: Partial<UpdateChartEntryInput> = {}): UpdateChartEntryInput {
  return {
    dateKind: "planned",
    endValue: day("2026-05-06"),
    kind: "move",
    originalEndValue: day("2026-05-05"),
    originalStartValue: day("2026-05-01"),
    path: "tasks/implementation.md",
    source: "date",
    startValue: day("2026-05-02"),
    ...overrides
  };
}

function chronicleEditInput(overrides: Partial<UpdateChartEntryInput> = {}): UpdateChartEntryInput {
  return {
    endValue: 2026,
    kind: "move",
    originalEndValue: 2025,
    originalStartValue: 2025,
    path: "tasks/implementation.md",
    source: "chronicle",
    startValue: 2026,
    ...overrides
  };
}

describe("chartData", () => {
  it("現行形式のチャート配列を chronicle/date の固定順で正規化する", () => {
    const charts = normalizeWorkspaceCharts([
      {
        entries: [{
          endLabel: "2026-05-05",
          endValue: day("2026-05-05"),
          fileName: "実装タスク",
          path: "tasks/implementation.md",
          startLabel: "2026-05-01",
          startValue: day("2026-05-01")
        }],
        filePaths: [],
        id: "date",
        name: "date",
        source: "date"
      },
      {
        entries: [{
          endLabel: "1333",
          endValue: 1332,
          fileName: "鎌倉時代",
          path: "history/kamakura.md",
          startLabel: "1185",
          startValue: 1184
        }],
        filePaths: ["history/kamakura.md"],
        id: "chronicle",
        name: "chronicle",
        source: "chronicle"
      }
    ]);

    expect(charts).toEqual([
      {
        entries: [{
          endLabel: "1333",
          endValue: 1332,
          fileName: "鎌倉時代",
          path: "history/kamakura.md",
          startLabel: "1185",
          startValue: 1184
        }],
        filePaths: ["history/kamakura.md"],
        id: "chronicle",
        name: "chronicle",
        source: "chronicle"
      },
      {
        entries: [{
          endLabel: "2026-05-05",
          endValue: day("2026-05-05"),
          fileName: "実装タスク",
          path: "tasks/implementation.md",
          startLabel: "2026-05-01",
          startValue: day("2026-05-01")
        }],
        filePaths: [],
        id: "date",
        name: "date",
        source: "date"
      }
    ]);
  });

  it("現行形式外の値は現状保持できるチャートとして扱わず、空のチャートを返す", () => {
    const charts = normalizeWorkspaceCharts([{ endYear: 1333, fileName: "鎌倉時代", path: "history/kamakura.md", startYear: 1185 }] as unknown[]);

    expect(charts).toEqual([
      {
        entries: [],
        filePaths: [],
        id: "chronicle",
        name: "chronicle",
        source: "chronicle"
      },
      {
        entries: [],
        filePaths: [],
        id: "date",
        name: "date",
        source: "date"
      }
    ]);
  });

  it("dateバー更新ではplannedDateだけを既存文字列形式で更新する", () => {
    expect(updateChartFrontmatter(
      "---\nchronicle0: [2026]\nplannedDate: [2026-05-01, 2026-05-05]\n---\n# 実装タスク",
      dateEditInput()
    )).toBe(
      "---\nchronicle0: [2026]\nplannedDate: [2026-05-02, 2026-05-06]\n---\n# 実装タスク"
    );
  });

  it("chronicleバー更新では date 系フィールドを年差分で連動更新する", () => {
    expect(updateChartFrontmatter(
      "---\nchronicle0: [2026]\nplannedDate: [2026-02-28]\nactualDate: [2026-03-01, 2026-03-02]\n---\n# 実装タスク",
      chronicleEditInput()
    )).toBe(
      "---\nchronicle0: [2027]\nplannedDate: [2027-02-28]\nactualDate: [2027-03-01, 2027-03-02]\n---\n# 実装タスク"
    );
  });

  it("チャート更新では対象外フィールド、コメント、並びを保持する", () => {
    expect(updateChartFrontmatter(
      [
        "---",
        "# keep comment",
        "custom:",
        "  - value",
        "chronicle0: [2026] # keep year note",
        "plannedDate: [2026-05-01, 2026-05-05] # keep date note",
        "---",
        "# 実装タスク"
      ].join("\n"),
      dateEditInput()
    )).toBe([
      "---",
      "# keep comment",
      "custom:",
      "  - value",
      "chronicle0: [2026] # keep year note",
      "plannedDate: [2026-05-02, 2026-05-06] # keep date note",
      "---",
      "# 実装タスク"
    ].join("\n"));
  });

  it("frontmatter がないファイルには chart frontmatter を追加しない", () => {
    expect(() => updateChartFrontmatter("# 実装タスク", dateEditInput())).toThrow(
      "チャート対象のフロントマターが見つからないため、変更を保存できませんでした。"
    );
  });
});
