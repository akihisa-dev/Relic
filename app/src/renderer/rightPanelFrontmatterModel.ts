import * as yaml from "js-yaml";

import type { UserDefinedField } from "../shared/ipc";
import { serializeData, serializeDataPreservingYaml, type FrontmatterBlock } from "./editorFrontmatterModel";

export interface ParsedFrontmatterContent {
  block: FrontmatterBlock | null;
  data: Record<string, unknown>;
  error: boolean;
}

interface FrontmatterContentBlock {
  bodyFrom: number;
  endLine: number;
  from: number;
  startLine: number;
  to: number;
  yamlText: string;
}

export function parseFrontmatterContent(content: string): ParsedFrontmatterContent {
  const block = findFrontmatterContentBlock(content);
  if (!block) return { block: null, data: {}, error: hasUnclosedFrontmatterOpening(content) };

  try {
    const parsed = yaml.load(block.yamlText);
    if (parsed === null || parsed === undefined) {
      return { block: { ...block, data: {} }, data: {}, error: false };
    }
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return { block: null, data: {}, error: true };
    }

    const data = parsed as Record<string, unknown>;
    return { block: { ...block, data }, data, error: false };
  } catch {
    return { block: null, data: {}, error: true };
  }
}

export function updateFrontmatterContent(
  content: string,
  nextData: Record<string, unknown>,
  userDefinedFields: UserDefinedField[]
): string | null {
  const parsed = parseFrontmatterContent(content);
  if (parsed.error) return null;

  const nextYaml = parsed.block
    ? serializeDataPreservingYaml(parsed.block, nextData, userDefinedFields).trimEnd()
    : serializeData(nextData, userDefinedFields).trimEnd();
  const nextBlock = Object.keys(nextData).length > 0 ? `---\n${nextYaml}\n---` : "";

  if (!parsed.block) {
    return nextBlock ? `${nextBlock}\n${content}` : content;
  }

  return `${content.slice(0, parsed.block.from)}${nextBlock}${content.slice(parsed.block.to)}`;
}

function findFrontmatterContentBlock(content: string): FrontmatterContentBlock | null {
  const lines = content.split("\n");
  if (lines.length < 2 || lines[0]?.trim() !== "---") return null;

  let offset = 0;
  const lineStarts = lines.map((line) => {
    const start = offset;
    offset += line.length + 1;
    return start;
  });

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() !== "---") continue;

    const yamlFrom = lineStarts[1] ?? 4;
    const closeFrom = lineStarts[index] ?? content.length;
    const closeTo = closeFrom + (lines[index]?.length ?? 0);

    return {
      bodyFrom: closeTo + 1,
      endLine: index + 1,
      from: 0,
      startLine: 1,
      to: closeTo,
      yamlText: content.slice(yamlFrom, closeFrom).replace(/\r\n/g, "\n")
    };
  }

  return null;
}

function hasUnclosedFrontmatterOpening(content: string): boolean {
  const lines = content.split("\n");
  return lines.length > 0 && lines[0]?.trim() === "---";
}
