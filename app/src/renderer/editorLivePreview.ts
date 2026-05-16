import { type Text } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";

import { findFrontmatterLineRange } from "./editorFrontmatter";
import { findTableBlocks } from "./editorTables";

interface SourceRevealRange {
  from: number;
  to: number;
}

interface InlineMatch {
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
class ListMarkerWidget extends WidgetType {
  constructor(
    private readonly label: string,
    private readonly className: string
  ) {
    super();
  }

  eq(other: ListMarkerWidget): boolean {
    return this.label === other.label && this.className === other.className;
  }

  toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.className = this.className;
    marker.textContent = this.label;
    return marker;
  }
}

class InlineFormatWidget extends WidgetType {
  constructor(
    private readonly tagName: "span" | "strong" | "em" | "code" | "a" | "u",
    private readonly text: string,
    private readonly className: string,
    private readonly onClick?: () => void
  ) {
    super();
  }

  eq(other: InlineFormatWidget): boolean {
    return this.tagName === other.tagName && this.text === other.text && this.className === other.className;
  }

  toDOM(): HTMLElement {
    const element = document.createElement(this.tagName);
    element.className = this.className;
    element.textContent = this.text;
    if (this.onClick) {
      let opened = false;
      const openLink = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (opened) return;
        opened = true;
        this.onClick?.();
        window.setTimeout(() => {
          opened = false;
        }, 0);
      };
      element.addEventListener("pointerdown", openLink);
      element.addEventListener("mousedown", openLink);
      element.addEventListener("click", openLink);
    }
    if (this.className === "cm-live-bold") {
      element.style.display = "inline-block";
      element.style.fontWeight = "900";
      element.style.paddingInline = "0.015em";
      element.style.textShadow = "0.025em 0 0 currentColor";
    }
    if (this.className === "cm-live-italic") {
      element.style.display = "inline-block";
      element.style.fontStyle = "italic";
      element.style.transform = "skewX(-14deg)";
      element.style.transformOrigin = "baseline";
    }
    return element;
  }

  ignoreEvent(event: Event): boolean {
    return Boolean(this.onClick && ["click", "mousedown", "pointerdown"].includes(event.type));
  }
}

class CheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked;
  }

  toDOM(): HTMLElement {
    const checkbox = document.createElement("input");
    checkbox.className = "cm-live-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.tabIndex = -1;
    return checkbox;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement("hr");
    hr.className = "cm-live-hr";
    return hr;
  }
}
function overlaps(from: number, to: number, ranges: Array<{ from: number; to: number }>): boolean {
  return ranges.some((range) => from < range.to && to > range.from);
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

export function buildLivePreviewDecorations(
  view: EditorView,
  onOpenClickableLink?: (link: ClickableLinkAtPosition) => void
): DecorationSet {
  const { state } = view;
  const doc = state.doc;
  const editorHasFocus = typeof view.hasFocus === "boolean" ? view.hasFocus : true;

  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const tableBlocks = findTableBlocks(state);
  const frontmatterLineRange = findFrontmatterLineRange(doc);
  const sourceRevealRanges: SourceRevealRange[] = [];

  function selectionTouches(from: number, to: number): boolean {
    if (!editorHasFocus) return false;

    return state.selection.ranges.some((range) => {
      if (range.empty) return range.from >= from && range.from <= to;
      return range.from <= to && range.to >= from;
    });
  }

  function addSourceReveal(from: number, to: number) {
    if (from < to && selectionTouches(from, to)) sourceRevealRanges.push({ from, to });
  }

  function shouldRevealSource(from: number, to: number): boolean {
    return sourceRevealRanges.some((range) => from >= range.from && to <= range.to);
  }

  function addReplace(from: number, to: number) {
    if (from < to && !shouldRevealSource(from, to)) ranges.push({ from, to, deco: Decoration.replace({}) });
  }

  function addMark(from: number, to: number, cls: string) {
    if (from < to) {
      const attributes = cls === "cm-live-bold"
        ? { style: "display: inline-block; font-weight: 900; padding-inline: 0.015em; text-shadow: 0.025em 0 0 currentColor;" }
        : cls === "cm-live-italic"
          ? { style: "display: inline-block; font-style: italic; transform: skewX(-14deg); transform-origin: baseline;" }
          : undefined;
      ranges.push({ from, to, deco: Decoration.mark({ attributes, class: cls }) });
    }
  }

  function addWidget(from: number, to: number, widget: WidgetType) {
    if (from < to && !shouldRevealSource(from, to)) {
      ranges.push({ from, to, deco: Decoration.replace({ widget }) });
    }
  }

  function addInlineFormat(lineFrom: number, match: InlineMatch, text: string) {
    if (!selectionTouches(match.from, match.to)) {
      const tagName = match.className === "cm-live-bold"
        ? "strong"
        : match.className === "cm-live-italic"
          ? "em"
          : match.className === "cm-live-code"
            ? "code"
            : match.className === "cm-live-underline"
              ? "u"
              : "span";
      const link = match.className === "cm-live-link"
        ? findClickableLinkAtPosition(state.doc, match.from)
        : null;
      const handleClick = link
        ? () => onOpenClickableLink?.(link)
        : undefined;

      addWidget(
        match.from,
        match.to,
        new InlineFormatWidget(
          tagName,
          text.slice(match.contentFrom - lineFrom, match.contentTo - lineFrom),
          match.className,
          handleClick
        )
      );
      return;
    }

    addSourceReveal(match.from, match.to);
    addMark(match.contentFrom, match.contentTo, match.className);
    for (const hideRange of match.hideRanges) addReplace(hideRange.from, hideRange.to);
  }

  function addInlineDecorations(lineFrom: number, text: string) {
    const occupied: Array<{ from: number; to: number }> = [];
    const matches: InlineMatch[] = [];

    matches.push(...collectRegexMatches(text, /`([^`\n]+)`/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: from + 1,
        contentTo: to - 1,
        className: "cm-live-code",
        hideRanges: [{ from, to: from + 1 }, { from: to - 1, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /\[([^\]\n]+)\]\(([^)\n]+)\)/g, (match) => {
      const from = lineFrom + match.index;
      const textFrom = from + 1;
      const textTo = textFrom + match[1].length;
      const to = from + match[0].length;
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

    matches.push(...collectRegexMatches(text, /\*\*([^*\n]+)\*\*/g, (match) => {
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

    matches.push(...collectRegexMatches(text, /(^|[^_])_([^_\n]+)_(?!_)/g, (match) => {
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

    for (const match of matches) {
      if (overlaps(match.from, match.to, occupied)) continue;
      occupied.push({ from: match.from, to: match.to });
      addInlineFormat(lineFrom, match, text);
    }
  }

  function startsInsideFencedCode(lineNumber: number): boolean {
    let inFencedCode = false;

    for (let currentLine = 1; currentLine < lineNumber; currentLine += 1) {
      if (/^\s*```/.test(doc.line(currentLine).text)) inFencedCode = !inFencedCode;
    }

    return inFencedCode;
  }

  for (const { from: visFrom, to: visTo } of view.visibleRanges) {
    let lineNumber = doc.lineAt(visFrom).number;
    let inFencedCode = startsInsideFencedCode(lineNumber);

    while (lineNumber <= doc.lineAt(visTo).number) {
      const line = doc.line(lineNumber);
      const text = line.text;
      const tableBlock = tableBlocks.find((block) => line.from >= block.from && line.to <= block.to);

      if (
        frontmatterLineRange &&
        lineNumber >= frontmatterLineRange.start &&
        lineNumber <= frontmatterLineRange.end
      ) {
        addMark(line.from, line.to, "cm-live-frontmatter");
        lineNumber += 1;
        continue;
      }

      if (/^\s*```/.test(text)) {
        addSourceReveal(line.from, line.to);
        addReplace(line.from, line.to);
        inFencedCode = !inFencedCode;
        lineNumber += 1;
        continue;
      }

      if (tableBlock) {
        lineNumber += 1;
        continue;
      }

      if (inFencedCode) {
        addMark(line.from, line.to, "cm-live-code-block");
        lineNumber += 1;
        continue;
      }

      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(text);
      if (headingMatch) {
        const markerFrom = line.from;
        const contentFrom = line.from + headingMatch[1].length + 1;
        addSourceReveal(line.from, line.to);
        addMark(contentFrom, line.to, `cm-live-h${headingMatch[1].length}`);
        addReplace(markerFrom, contentFrom);
        addInlineDecorations(contentFrom, text.slice(contentFrom - line.from));
      } else if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(text)) {
        addSourceReveal(line.from, line.to);
        addWidget(line.from, line.to, new HorizontalRuleWidget());
      } else if (/^\s*>\s?/.test(text)) {
        const match = /^(\s*>\s?)(.*)$/.exec(text);
        if (match) {
          const contentFrom = line.from + match[1].length;
          addSourceReveal(line.from, line.to);
          addReplace(line.from, contentFrom);
          addMark(contentFrom, line.to, "cm-live-blockquote");
          addInlineDecorations(contentFrom, match[2]);
        }
      } else if (/^\s*[-*+]\s+\[[ xX]\]\s+/.test(text)) {
        const match = /^(\s*[-*+]\s+\[([ xX])\]\s+)(.*)$/.exec(text);
        if (match) {
          const contentFrom = line.from + match[1].length;
          addSourceReveal(line.from, line.to);
          addWidget(line.from, contentFrom, new CheckboxWidget(/[xX]/.test(match[2])));
          addInlineDecorations(contentFrom, match[3]);
        }
      } else if (/^\s*[-*+]\s+/.test(text)) {
        const match = /^(\s*[-*+]\s+)(.*)$/.exec(text);
        if (match) {
          const contentFrom = line.from + match[1].length;
          addSourceReveal(line.from, line.to);
          addWidget(line.from, contentFrom, new ListMarkerWidget("•", "cm-live-list-marker"));
          addInlineDecorations(contentFrom, match[2]);
        }
      } else if (/^\s*\d+[.)]\s+/.test(text)) {
        const match = /^(\s*)(\d+)([.)]\s+)(.*)$/.exec(text);
        if (match) {
          const markerTo = line.from + match[0].length - match[4].length;
          addSourceReveal(line.from, line.to);
          addWidget(line.from, markerTo, new ListMarkerWidget(`${match[2]}.`, "cm-live-ordered-marker"));
          addInlineDecorations(markerTo, match[4]);
        }
      } else {
        addInlineDecorations(line.from, text);
      }

      lineNumber += 1;
    }
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  return Decoration.set(
    ranges.map(({ from, to, deco }) => deco.range(from, to)),
    true
  );
}
export function findClickableLinkAtPosition(
  doc: Text,
  position: number
): ClickableLinkAtPosition | null {
  const line = doc.lineAt(position);
  const offset = position - line.from;

  for (const match of line.text.matchAll(/\[([^\]\n]+)\]\(([^)\n]+)\)/g)) {
    const fullText = match[0];
    const href = match[2];
    const start = match.index ?? 0;

    if (offset >= start && offset <= start + fullText.length) {
      return { href, type: "markdown" };
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
