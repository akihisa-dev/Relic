import * as yaml from "js-yaml";

import type { UserDefinedField, WorkspaceTreeNode } from "../shared/ipc";
import { parseWikiLinks } from "../shared/links";
import { parseMarkdownTags } from "../shared/tags";
import type { DashboardFileStats, DashboardStats, LoadedMarkdownFile } from "./dashboardTypes";

const lengthBucketDefs = [
  { label: "0-499", max: 499 },
  { label: "500-1,999", max: 1999 },
  { label: "2,000-5,999", max: 5999 },
  { label: "6,000+", max: Infinity }
];

const chartColors = ["#00628c", "#1c1c1c", "#5e5e5e", "#8a8a8a", "#c6c6c6", "#e0e0e0"];

export function buildDashboardStats(
  files: LoadedMarkdownFile[],
  fileTree: WorkspaceTreeNode[],
  labels: { rootFolder: string } = { rootFolder: "Root" }
): DashboardStats {
  const folderCount = countFolders(fileTree);
  const parsedFiles = files.map((file) => {
    const tags = parseMarkdownTags(file.content).tags;
    const headings = (file.content.match(/^#{1,6}\s+\S.*$/gm) ?? []).length;
    const links = parseWikiLinks(file.content).length;
    const folder = file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : labels.rootFolder;
    const words = file.content.split(/\s+/).filter(Boolean).length;

    return {
      chars: file.content.length,
      folder,
      hasFrontmatter: /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(file.content),
      headings,
      links,
      name: file.name,
      path: file.path,
      properties: parseFrontmatterData(file.content),
      tags,
      words
    };
  });
  const totalChars = parsedFiles.reduce((sum, file) => sum + file.chars, 0);
  const totalWords = parsedFiles.reduce((sum, file) => sum + file.words, 0);
  const totalHeadings = parsedFiles.reduce((sum, file) => sum + file.headings, 0);
  const totalLinks = parsedFiles.reduce((sum, file) => sum + file.links, 0);
  const maxChars = Math.max(0, ...parsedFiles.map((file) => file.chars));

  return {
    averageChars: parsedFiles.length > 0 ? Math.round(totalChars / parsedFiles.length) : 0,
    files: parsedFiles.sort((a, b) => b.chars - a.chars || a.path.localeCompare(b.path, "ja")),
    folderCount,
    folderDistribution: topCounts(parsedFiles.map((file) => file.folder), 8),
    frontmatterFiles: parsedFiles.filter((file) => file.hasFrontmatter).length,
    lengthBuckets: lengthBucketDefs.map((bucket, index) => ({
      count: parsedFiles.filter((file) => (
        file.chars <= bucket.max && (index === 0 || file.chars > lengthBucketDefs[index - 1].max)
      )).length,
      label: bucket.label
    })),
    maxChars,
    tagDistribution: topCounts(parsedFiles.flatMap((file) => file.tags), 12),
    totalChars,
    totalFiles: parsedFiles.length,
    totalHeadings,
    totalLinks,
    totalWords
  };
}

export function buildPropertyDistribution(
  files: DashboardFileStats[],
  field: UserDefinedField | undefined,
  labels: { other: string; unset: string }
): Array<{ color: string; count: number; label: string }> {
  if (!field) return [];

  const counts = new Map<string, number>();

  for (const file of files) {
    const values = normalizePropertyValues(file.properties[field.name]);

    if (values.length === 0) {
      counts.set(labels.unset, (counts.get(labels.unset) ?? 0) + 1);
      continue;
    }

    for (const value of values) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  const sorted = [...counts.entries()]
    .map(([label, count]) => ({ count, label }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja"));
  const visible = sorted.slice(0, 5);
  const otherCount = sorted.slice(5).reduce((sum, item) => sum + item.count, 0);
  const entries = otherCount > 0 ? [...visible, { count: otherCount, label: labels.other }] : visible;

  return entries.map((entry, index) => ({ ...entry, color: chartColors[index % chartColors.length] }));
}

function countFolders(nodes: WorkspaceTreeNode[]): number {
  return nodes.reduce((sum, node) => (
    node.type === "folder" ? sum + 1 + countFolders(node.children) : sum
  ), 0);
}

function parseFrontmatterData(content: string): Record<string, unknown> {
  const openDelimiter = /^---\r?\n/.exec(content);
  if (!openDelimiter) return {};

  const rest = content.slice(openDelimiter[0].length);
  const closeDelimiter = /^---(?:\r?\n|$)/m.exec(rest);
  if (!closeDelimiter || closeDelimiter.index === undefined) return {};

  try {
    const parsed = yaml.load(rest.slice(0, closeDelimiter.index));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function normalizePropertyValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((item) => {
      if (item === null || item === undefined || item === "") return [];
      if (typeof item === "string") return item.trim() ? [item.trim()] : [];
      if (typeof item === "number" || typeof item === "boolean") return [String(item)];
      return [];
    });
}

function topCounts(values: string[], limit: number): Array<{ count: number; label: string }> {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ count, label }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja"))
    .slice(0, limit);
}
