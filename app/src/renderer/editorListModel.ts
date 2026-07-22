import type { ChangeSet, Text } from "@codemirror/state";

export interface ListLineMatch {
  content: string;
  indent: string;
  marker: string;
  prefix: string;
}

const listMarkerPattern = /^((?:[-+*]\s+(?:\[[ xX]\]\s+)?)|(?:\d+\.\s+))(.*)$/;

export function parseListLine(text: string): ListLineMatch | null {
  const { prefix, rest } = splitQuotePrefix(text);
  const indentMatch = /^([ \t]*)/.exec(rest);
  const indent = indentMatch?.[1] ?? "";
  const match = listMarkerPattern.exec(rest.slice(indent.length));
  if (!match) return null;

  return {
    content: match[2] ?? "",
    indent,
    marker: match[1] ?? "",
    prefix
  };
}

export function nextListMarker(marker: string): string {
  const ordered = marker.match(/^(\d+)\.\s+$/);
  if (ordered) return `${Number(ordered[1]) + 1}. `;

  const checkbox = marker.match(/^([-+*]\s+)\[[ xX]\]\s+$/);
  if (checkbox) return `${checkbox[1]}[ ] `;

  return marker;
}

export function orderedMarkerNumber(marker: string): number | null {
  const match = /^(\d+)\.\s+$/.exec(marker);
  return match ? Number(match[1]) : null;
}

export function continueListMarkersInPastedText(text: string, list: ListLineMatch): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length < 2) return text;

  let marker = list.marker;
  const continued = [lines[0]];

  for (const line of lines.slice(1)) {
    if (line.length === 0 || parseListLine(line)) {
      continued.push(line);
      continue;
    }

    marker = nextListMarker(marker);
    continued.push(`${list.prefix}${list.indent}${marker}${line}`);
  }

  return continued.join("\n");
}

export function lastOrderedMarkerNumber(insert: string, list: ListLineMatch): number | null {
  let number = orderedMarkerNumber(list.marker);
  if (number === null) return null;

  for (const line of insert.replace(/\r\n?/g, "\n").split("\n").slice(1)) {
    const match = parseListLine(line);
    if (match?.prefix === list.prefix && match.indent === list.indent) {
      const next = orderedMarkerNumber(match.marker);
      if (next !== null) number = next;
    }
  }
  return number;
}

export function renumberFollowingOrderedItems(
  doc: Text,
  startLineNumber: number,
  prefix: string,
  indent: string,
  firstNumber: number
): Array<{ from: number; insert: string; to: number }> {
  const changes: Array<{ from: number; insert: string; to: number }> = [];
  let expected = firstNumber;

  for (let lineNumber = startLineNumber; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber);
    if (line.text.trim() === "") break;
    const match = parseListLine(line.text);
    if (!match || match.prefix !== prefix || match.indent !== indent || orderedMarkerNumber(match.marker) === null) break;

    const replacement = `${expected}. `;
    if (match.marker !== replacement) {
      const from = line.from + match.prefix.length + match.indent.length;
      changes.push({ from, insert: replacement, to: from + match.marker.length });
    }
    expected += 1;
  }

  return changes;
}

export function transactionDeletesText(changes: ChangeSet): boolean {
  let deletes = false;
  changes.iterChanges((fromA, toA) => {
    if (toA > fromA) deletes = true;
  });
  return deletes;
}

export function orderedListRenumberChangesNear(
  doc: Text,
  changedRanges: ChangeSet
): Array<{ from: number; insert: string; to: number }> {
  const candidateLines = new Set<number>();
  changedRanges.iterChangedRanges((_fromA, _toA, fromB, toB) => {
    const first = doc.lineAt(Math.min(fromB, doc.length)).number;
    const last = doc.lineAt(Math.min(Math.max(fromB, toB), doc.length)).number;
    for (let lineNumber = Math.max(1, first - 1); lineNumber <= Math.min(doc.lines, last + 1); lineNumber += 1) {
      candidateLines.add(lineNumber);
    }
  });

  const visitedStarts = new Set<number>();
  const changes: Array<{ from: number; insert: string; to: number }> = [];
  for (const candidate of candidateLines) {
    const candidateMatch = parseListLine(doc.line(candidate).text);
    if (!candidateMatch || orderedMarkerNumber(candidateMatch.marker) === null) continue;

    let startLine = candidate;
    while (startLine > 1) {
      const previous = parseListLine(doc.line(startLine - 1).text);
      if (
        !previous ||
        previous.prefix !== candidateMatch.prefix ||
        previous.indent !== candidateMatch.indent ||
        orderedMarkerNumber(previous.marker) === null
      ) break;
      startLine -= 1;
    }
    if (visitedStarts.has(startLine)) continue;
    visitedStarts.add(startLine);

    const firstMatch = parseListLine(doc.line(startLine).text);
    const firstNumber = firstMatch ? orderedMarkerNumber(firstMatch.marker) : null;
    if (firstMatch && firstNumber !== null) {
      changes.push(...renumberFollowingOrderedItems(
        doc,
        startLine,
        firstMatch.prefix,
        firstMatch.indent,
        firstNumber
      ));
    }
  }

  return changes.toSorted((left, right) => left.from - right.from);
}

function splitQuotePrefix(text: string): { prefix: string; rest: string } {
  let offset = 0;
  let foundQuote = false;

  while (offset < text.length) {
    const match = /^[ \t]*>[ \t]?/.exec(text.slice(offset));
    if (!match) break;
    foundQuote = true;
    offset += match[0].length;
  }

  return foundQuote
    ? { prefix: text.slice(0, offset), rest: text.slice(offset) }
    : { prefix: "", rest: text };
}
