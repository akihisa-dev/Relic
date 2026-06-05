import { type Text } from "@codemirror/state";

export interface SourceRevealRange {
  from: number;
  to: number;
}

export interface InlineMatch {
  content?: string;
  from: number;
  to: number;
  contentFrom: number;
  contentTo: number;
  className: string;
  hideRanges: Array<{ from: number; to: number }>;
}

export interface ClickableLinkAtPosition {
  href?: string;
  heading?: string;
  target?: string;
  type: "markdown" | "wiki";
}

export function overlaps(from: number, to: number, ranges: Array<{ from: number; to: number }>): boolean {
  return ranges.some((range) => from < range.to && to > range.from);
}

function isStyleMatch(match: InlineMatch): boolean {
  return match.className === "cm-live-bold" || match.className === "cm-live-italic";
}

function canOverlapAcceptedMatch(match: InlineMatch, accepted: InlineMatch[]): boolean {
  const overlappingMatches = accepted.filter((acceptedMatch) => (
    match.from < acceptedMatch.to && match.to > acceptedMatch.from
  ));

  if (overlappingMatches.length === 0) return true;
  if (!isStyleMatch(match) || !overlappingMatches.every(isStyleMatch)) return false;

  return !overlappingMatches.some((acceptedMatch) => (
    match.hideRanges.some((hideRange) => overlaps(hideRange.from, hideRange.to, acceptedMatch.hideRanges))
  ));
}

function containedInRanges(from: number, to: number, ranges: Array<{ from: number; to: number }>): boolean {
  return ranges.some((range) => from >= range.from && to <= range.to);
}

function collectRegexMatches(
  text: string,
  regex: RegExp,
  createMatch: (match: RegExpExecArray) => InlineMatch | null
): InlineMatch[] {
  const matches: InlineMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const inlineMatch = createMatch(match);
    if (inlineMatch) matches.push(inlineMatch);
    if (match[0].length === 0) regex.lastIndex += 1;
  }

  return matches;
}

interface MarkdownLinkMatch {
  from: number;
  to: number;
  textFrom: number;
  textTo: number;
  href: string;
}

interface InlineCodeMatch {
  from: number;
  to: number;
  contentFrom: number;
  contentTo: number;
}

function countBacktickRun(text: string, from: number): number {
  let length = 0;
  while (text[from + length] === "`") length += 1;
  return length;
}

function findInlineCodeMatches(text: string): InlineCodeMatch[] {
  const matches: InlineCodeMatch[] = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const from = text.indexOf("`", searchFrom);
    if (from < 0) break;

    const markerLength = countBacktickRun(text, from);
    const marker = "`".repeat(markerLength);
    const contentFrom = from + markerLength;
    const closeFrom = text.indexOf(marker, contentFrom);
    if (closeFrom < 0 || closeFrom === contentFrom || text.slice(contentFrom, closeFrom).includes("\n")) {
      searchFrom = contentFrom;
      continue;
    }

    matches.push({
      from,
      to: closeFrom + markerLength,
      contentFrom,
      contentTo: closeFrom
    });
    searchFrom = closeFrom + markerLength;
  }

  return matches;
}

function findHtmlTagRanges(text: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const from = text.indexOf("<", searchFrom);
    if (from < 0) break;

    let quote: '"' | "'" | null = null;
    let to = -1;
    for (let index = from + 1; index < text.length; index += 1) {
      const char = text[index];
      if (char === "\n") break;
      if (quote) {
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === ">") {
        to = index + 1;
        break;
      }
    }

    if (to < 0) {
      searchFrom = from + 1;
      continue;
    }

    ranges.push({ from, to });
    searchFrom = to;
  }

  return ranges;
}

function findMarkdownLinkMatches(text: string): MarkdownLinkMatch[] {
  const matches: MarkdownLinkMatch[] = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const from = text.indexOf("[", searchFrom);
    if (from < 0) break;

    const textTo = text.indexOf("]", from + 1);
    if (textTo < 0 || text.slice(from + 1, textTo).includes("\n")) {
      searchFrom = from + 1;
      continue;
    }

    const hrefOpen = textTo + 1;
    const hrefFrom = hrefOpen + 1;
    if (text[hrefOpen] !== "(" || hrefFrom >= text.length) {
      searchFrom = from + 1;
      continue;
    }

    let parenDepth = 0;
    let hrefClose = -1;
    for (let index = hrefFrom; index < text.length; index += 1) {
      const char = text[index];
      if (char === "\n") break;
      if (char === "\\") {
        index += 1;
        continue;
      }
      if (char === "(") {
        parenDepth += 1;
        continue;
      }
      if (char !== ")") continue;
      if (parenDepth === 0) {
        hrefClose = index;
        break;
      }
      parenDepth -= 1;
    }

    if (hrefClose < 0 || hrefClose === hrefFrom) {
      searchFrom = from + 1;
      continue;
    }

    matches.push({
      from,
      to: hrefClose + 1,
      textFrom: from + 1,
      textTo,
      href: text.slice(hrefFrom, hrefClose)
    });
    searchFrom = hrefClose + 1;
  }

  return matches;
}

export function collectInlineMatches(lineFrom: number, text: string): InlineMatch[] {
  const occupied: Array<{ from: number; to: number }> = [];
  const htmlTagRanges = findHtmlTagRanges(text).map((range) => ({
    from: lineFrom + range.from,
    to: lineFrom + range.to
  }));
  const matches: InlineMatch[] = [];

  matches.push(...findInlineCodeMatches(text).map((match) => {
    const from = lineFrom + match.from;
    const to = lineFrom + match.to;
    const contentFrom = lineFrom + match.contentFrom;
    const contentTo = lineFrom + match.contentTo;
    return {
      from,
      to,
      contentFrom,
      contentTo,
      className: "cm-live-code",
      hideRanges: [{ from, to: contentFrom }, { from: contentTo, to }]
    };
  }));

  matches.push(...findMarkdownLinkMatches(text).map((match) => {
    const from = lineFrom + match.from;
    const textFrom = lineFrom + match.textFrom;
    const textTo = lineFrom + match.textTo;
    const to = lineFrom + match.to;
    return {
      from,
      to,
      contentFrom: textFrom,
      contentTo: textTo,
      className: "cm-live-link",
      hideRanges: [{ from, to: from + 1 }, { from: textTo, to }]
    };
  }));

  matches.push(...collectRegexMatches(text, /\[\[([^\]\n]+)\]\]/g, (match) => {
    const from = lineFrom + match.index;
    const to = from + match[0].length;
    const separatorIndex = match[1].lastIndexOf("|");
    const contentOffset = separatorIndex >= 0 ? 2 + separatorIndex + 1 : 2;
    const contentLength = separatorIndex >= 0 ? match[1].length - separatorIndex - 1 : match[1].length;
    const contentFrom = from + contentOffset;
    const contentTo = contentFrom + contentLength;
    const hideRanges = separatorIndex >= 0
      ? [{ from, to: contentFrom }, { from: to - 2, to }]
      : [{ from, to: from + 2 }, { from: to - 2, to }];
    return {
      from,
      to,
      contentFrom,
      contentTo,
      className: "cm-live-link",
      hideRanges
    };
  }));

  matches.push(...collectRegexMatches(text, /\*\*((?:[^*\n]|\*(?!\*))+\S?)\*\*/g, (match) => {
    const from = lineFrom + match.index;
    const to = from + match[0].length;
    return {
      from,
      to,
      contentFrom: from + 2,
      contentTo: to - 2,
      className: "cm-live-bold",
      hideRanges: [{ from, to: from + 2 }, { from: to - 2, to }]
    };
  }));

  matches.push(...collectRegexMatches(text, /__([^_\n]+)__/g, (match) => {
    const from = lineFrom + match.index;
    const to = from + match[0].length;
    return {
      from,
      to,
      contentFrom: from + 2,
      contentTo: to - 2,
      className: "cm-live-bold",
      hideRanges: [{ from, to: from + 2 }, { from: to - 2, to }]
    };
  }));

  matches.push(...collectRegexMatches(text, /~~([^~\n]+)~~/g, (match) => {
    const from = lineFrom + match.index;
    const to = from + match[0].length;
    return {
      from,
      to,
      contentFrom: from + 2,
      contentTo: to - 2,
      className: "cm-live-strike",
      hideRanges: [{ from, to: from + 2 }, { from: to - 2, to }]
    };
  }));

  matches.push(...collectRegexMatches(text, /==([^=\n]+)==/g, (match) => {
    const from = lineFrom + match.index;
    const to = from + match[0].length;
    return {
      from,
      to,
      contentFrom: from + 2,
      contentTo: to - 2,
      className: "cm-live-highlight",
      hideRanges: [{ from, to: from + 2 }, { from: to - 2, to }]
    };
  }));

  matches.push(...collectRegexMatches(text, /<u>([^<\n]+)<\/u>/g, (match) => {
    const from = lineFrom + match.index;
    const to = from + match[0].length;
    return {
      from,
      to,
      contentFrom: from + 3,
      contentTo: to - 4,
      className: "cm-live-underline",
      hideRanges: [{ from, to: from + 3 }, { from: to - 4, to }]
    };
  }));

  matches.push(...collectRegexMatches(text, /\[\^([^\]\n]+)\]/g, (match) => {
    const from = lineFrom + match.index;
    const to = from + match[0].length;
    return {
      content: match[1],
      from,
      to,
      contentFrom: from + 2,
      contentTo: to - 1,
      className: "cm-live-footnote-ref",
      hideRanges: [{ from, to: from + 2 }, { from: to - 1, to }]
    };
  }));

  matches.push(...collectRegexMatches(text, /(^|[^\$\\])\$([^$\n]+)\$(?!\$)/g, (match) => {
    const markerOffset = match[1].length;
    const from = lineFrom + match.index + markerOffset;
    const to = from + match[0].length - markerOffset;
    return {
      content: match[2],
      from,
      to,
      contentFrom: from + 1,
      contentTo: to - 1,
      className: "cm-live-math-inline",
      hideRanges: [{ from, to: from + 1 }, { from: to - 1, to }]
    };
  }));

  matches.push(...collectRegexMatches(text, /(^|[^\*])\*([^*\n]+)\*(?!\*)/g, (match) => {
    const markerOffset = match[1].length;
    const from = lineFrom + match.index + markerOffset;
    const to = from + match[0].length - markerOffset;
    return {
      from,
      to,
      contentFrom: from + 1,
      contentTo: to - 1,
      className: "cm-live-italic",
      hideRanges: [{ from, to: from + 1 }, { from: to - 1, to }]
    };
  }));

  matches.push(...collectRegexMatches(text, /(^|[^A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])/g, (match) => {
    const markerOffset = match[1].length;
    const from = lineFrom + match.index + markerOffset;
    const to = from + match[0].length - markerOffset;
    return {
      from,
      to,
      contentFrom: from + 1,
      contentTo: to - 1,
      className: "cm-live-italic",
      hideRanges: [{ from, to: from + 1 }, { from: to - 1, to }]
    };
  }));

  matches.sort((a, b) => a.from - b.from || b.to - a.to);

  const accepted: InlineMatch[] = [];

  return matches.filter((match) => {
    if (containedInRanges(match.from, match.to, htmlTagRanges)) return false;
    if (overlaps(match.from, match.to, occupied) && !canOverlapAcceptedMatch(match, accepted)) return false;
    occupied.push({ from: match.from, to: match.to });
    accepted.push(match);
    return true;
  });
}

export function tagNameForInlineMatch(className: string): "span" | "strong" | "em" | "code" | "a" | "u" | "sup" {
  if (className === "cm-live-bold") return "strong";
  if (className === "cm-live-italic") return "em";
  if (className === "cm-live-code") return "code";
  if (className === "cm-live-underline") return "u";
  if (className === "cm-live-footnote-ref") return "sup";
  return "span";
}

export function findClickableLinkAtPosition(
  doc: Text,
  position: number
): ClickableLinkAtPosition | null {
  const line = doc.lineAt(position);
  const offset = position - line.from;

  for (const match of findMarkdownLinkMatches(line.text)) {
    if (offset >= match.from && offset <= match.to) {
      return { href: match.href, type: "markdown" };
    }
  }

  for (const match of line.text.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const body = match[1];
    const start = match.index ?? 0;
    const end = start + match[0].length;

    if (offset < start || offset > end) continue;

    const [targetPart] = body.split("|", 2);
    const blockParts = targetPart.trim().split("^", 2);
    const headingParts = blockParts[0].split("#", 2);
    const target = headingParts[0].trim();

    if (!target) return null;

    return { heading: headingParts[1]?.trim() || undefined, target, type: "wiki" };
  }

  return null;
}
