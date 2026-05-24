import { describe, expect, it, vi } from "vitest";

import type { UpdateGanttChartEntryInput, WorkspaceTreeNode } from "../shared/ipc";
import {
  normalizeWorkspaceGanttCharts,
  normalizeWorkspaceGanttChartsWithFiles,
  readDateChartEntriesFromFiles,
  updateChartFrontmatter,
  updateGanttChartEntryFallback
} from "./ganttChartData";

const day = (value: string): number =>
  Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 86_400_000);

function dateEditInput(overrides: Partial<UpdateGanttChartEntryInput> = {}): UpdateGanttChartEntryInput {
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

function chronicleEditInput(overrides: Partial<UpdateGanttChartEntryInput> = {}): UpdateGanttChartEntryInput {
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

describe("ganttChartData", () => {
  it("旧形式 chronicle 配列を現行チャートへ正規化する", () => {
    const charts = normalizeWorkspaceGanttCharts([
      { endYear: 1333, fileName: "鎌倉時代", path: "history/kamakura.md", startYear: 1185 }
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
        entries: [],
        filePaths: [],
        id: "date",
        name: "date",
        source: "date"
      }
    ]);
  });

  it("Markdown frontmatter から plannedDate と actualDate を date チャートへ補完する", async () => {
    const fileTree: WorkspaceTreeNode[] = [{
      children: [{ name: "実装タスク", path: "tasks/implementation.md", type: "file" }],
      name: "tasks",
      path: "tasks",
      type: "folder"
    }];
    const readMarkdownFile = vi.fn(async ({ path }: { path: string }) => ({
      ok: true as const,
      value: {
        content: "---\nstatus: [進行中]\nplannedDate: [2026-05-01, 2026-05-05]\nactualDate: [2026-05-03, 2026-05-06]\n---\n# 実装タスク",
        name: "実装タスク",
        path
      }
    }));

    const charts = await normalizeWorkspaceGanttChartsWithFiles(
      [{ entries: [], filePaths: [], id: "date", name: "date", source: "date" }],
      fileTree,
      readMarkdownFile
    );

    expect(charts[1].entries).toEqual([
      {
        dateKind: "planned",
        endLabel: "2026-05-05",
        endValue: day("2026-05-05"),
        fileName: "実装タスク",
        path: "tasks/implementation.md",
        startLabel: "2026-05-01",
        startValue: day("2026-05-01"),
        statuses: ["進行中"]
      },
      {
        dateKind: "actual",
        endLabel: "2026-05-06",
        endValue: day("2026-05-06"),
        fileName: "実装タスク",
        path: "tasks/implementation.md",
        startLabel: "2026-05-03",
        startValue: day("2026-05-03"),
        statuses: ["進行中"]
      }
    ]);
  });

  it("旧dateだけではplannedとして読まない", async () => {
    const fileTree: WorkspaceTreeNode[] = [{ name: "legacy-date", path: "tasks/legacy-date.md", type: "file" }];
    const readMarkdownFile = vi.fn(async ({ path }: { path: string }) => ({
      ok: true as const,
      value: {
        content: "---\ndate: [2026-06-01]\n---\n# legacy-date",
        name: "",
        path
      }
    }));

    await expect(readDateChartEntriesFromFiles(fileTree, readMarkdownFile)).resolves.toEqual([]);
  });

  it("read失敗、frontmatterなし、不正日付、逆順日付は補完対象から除外する", async () => {
    const fileTree: WorkspaceTreeNode[] = [
      { name: "valid", path: "tasks/valid.md", type: "file" },
      { name: "failed", path: "tasks/failed.md", type: "file" },
      { name: "plain", path: "tasks/plain.md", type: "file" },
      { name: "invalid", path: "tasks/invalid.md", type: "file" },
      { name: "reversed", path: "tasks/reversed.md", type: "file" }
    ];
    const contents: Record<string, string> = {
      "tasks/invalid.md": "---\nplannedDate: [2026-13-01]\n---\n# invalid",
      "tasks/plain.md": "# plain",
      "tasks/reversed.md": "---\nplannedDate: [2026-05-05, 2026-05-01]\n---\n# reversed",
      "tasks/valid.md": "---\nactualDate: [2026-05-03]\n---\n# valid"
    };
    const readMarkdownFile = vi.fn(async ({ path }: { path: string }) => {
      if (path === "tasks/failed.md") {
        return { error: { code: "READ_FAILED", message: "読めませんでした。" }, ok: false as const };
      }

      return {
        ok: true as const,
        value: { content: contents[path], name: "", path }
      };
    });

    await expect(readDateChartEntriesFromFiles(fileTree, readMarkdownFile)).resolves.toEqual([{
      dateKind: "actual",
      endLabel: "2026-05-03",
      endValue: day("2026-05-03"),
      fileName: "valid",
      path: "tasks/valid.md",
      startLabel: "2026-05-03",
      startValue: day("2026-05-03"),
      statuses: []
    }]);
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

  it("frontmatter がないファイルにも既存形式の chart frontmatter を追加する", () => {
    expect(updateChartFrontmatter("# 実装タスク", dateEditInput())).toBe(
      "---\nchronicle0: [2026]\nplannedDate: [2026-05-02, 2026-05-06]\n---\n# 実装タスク"
    );
  });

  it("チャート更新IPCがない場合のfallbackは読み書き後に最新チャートを返す", async () => {
    const charts = [{
      entries: [],
      filePaths: [],
      id: "date",
      name: "date",
      source: "date" as const
    }];
    const readMarkdownFile = vi.fn(async ({ path }: { path: string }) => ({
      ok: true as const,
      value: {
        content: "---\nchronicle: [2026]\nplannedDate: [2026-05-01, 2026-05-05]\n---\n# 実装タスク",
        name: "実装タスク",
        path
      }
    }));
    const writeMarkdownFile = vi.fn(async () => ({ ok: true as const, value: undefined }));
    const getWorkspaceChronicle = vi.fn(async () => ({ ok: true as const, value: charts }));

    await expect(updateGanttChartEntryFallback(dateEditInput(), {
      getWorkspaceChronicle,
      readMarkdownFile,
      writeMarkdownFile
    })).resolves.toEqual({ ok: true, value: charts });
    expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: "---\nchronicle: [2026]\nplannedDate: [2026-05-02, 2026-05-06]\nchronicle0: [2026]\n---\n# 実装タスク",
      path: "tasks/implementation.md"
    });
  });
});
