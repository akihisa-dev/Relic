import {
  scanWikiLinks,
  type ResolvedWikiLink,
  type WikiLinkMatch
} from "../shared/links";
import { contentChangeRange, type EditorContentUpdate } from "./editorContentUpdate";

type WikiLinkResolver = (
  markdown: string,
  sourcePath: string,
  options?: { limit?: number }
) => ResolvedWikiLink[];

export interface OutgoingLinksSnapshot {
  content: string;
  links: ResolvedWikiLink[];
  matches: WikiLinkMatch[];
  resolver: WikiLinkResolver;
  revision: number;
  sourcePath: string;
}

let outgoingLinkFullScans = 0;

export function updateOutgoingLinksSnapshot(
  previous: OutgoingLinksSnapshot | null,
  content: string,
  revision: number,
  update: EditorContentUpdate | undefined,
  sourcePath: string,
  resolver: WikiLinkResolver,
  limit: number
): OutgoingLinksSnapshot {
  if (
    !previous ||
    previous.sourcePath !== sourcePath ||
    previous.resolver !== resolver
  ) {
    return scanOutgoingLinks(content, revision, sourcePath, resolver, limit);
  }
  if (previous.content === content) return previous;

  const change = contentChangeRange(previous.content, previous.revision, content, revision, update);
  if (!change) return previous;
  const oldChanged = previous.content.slice(change.from, change.oldTo);
  const newChanged = content.slice(change.from, change.newTo);
  const touchesLink = previous.matches.some((match) => change.from <= match.to && change.oldTo >= match.from);
  if (touchesLink || /[\[\]`\n\r]/.test(oldChanged) || /[\[\]`\n\r]/.test(newChanged)) {
    return scanOutgoingLinks(content, revision, sourcePath, resolver, limit);
  }

  const delta = change.newTo - change.oldTo;
  return {
    ...previous,
    content,
    matches: delta === 0 ? previous.matches : previous.matches.map((match) => (
      match.from >= change.oldTo ? shiftWikiLinkMatch(match, delta) : match
    )),
    revision
  };
}

function scanOutgoingLinks(
  content: string,
  revision: number,
  sourcePath: string,
  resolver: WikiLinkResolver,
  limit: number
): OutgoingLinksSnapshot {
  outgoingLinkFullScans += 1;
  return {
    content,
    links: resolver(content, sourcePath, { limit }),
    matches: scanWikiLinks(content, { limit }),
    resolver,
    revision,
    sourcePath
  };
}

function shiftWikiLinkMatch(match: WikiLinkMatch, delta: number): WikiLinkMatch {
  return {
    ...match,
    bodyFrom: match.bodyFrom + delta,
    bodyTo: match.bodyTo + delta,
    from: match.from + delta,
    to: match.to + delta
  };
}

/** @internal Test-only counter for deterministic link-scan assertions. */
export function __getOutgoingLinkFullScansForTests(): number {
  return outgoingLinkFullScans;
}

/** @internal Test-only reset for deterministic link-scan assertions. */
export function __resetOutgoingLinkFullScansForTests(): void {
  outgoingLinkFullScans = 0;
}
