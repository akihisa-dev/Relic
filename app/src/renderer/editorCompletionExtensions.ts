import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";

import { isPositionInFencedCodeBlock } from "./markdownCodeBlockRanges";

interface WikiCompletionBuildStats {
  cacheHits: number;
  cacheMisses: number;
  lastCandidateCount: number;
  lastBuildDurationMs: number;
  lastWorkspacePath: string | null;
}

interface WikiCompletionCacheEntry {
  allFilePaths: string[];
  aliasCandidates: string[];
  index: WikiCompletionIndex;
}

const wikiCompletionIndexByWorkspace = new Map<string, WikiCompletionCacheEntry>();
const wikiCompletionBuildStats: WikiCompletionBuildStats = {
  cacheHits: 0,
  cacheMisses: 0,
  lastCandidateCount: 0,
  lastBuildDurationMs: 0,
  lastWorkspacePath: null
};

function workspaceKey(workspacePath?: string | null): string {
  return workspacePath ?? "<no-workspace>";
}

function buildOrGetCachedWikiCompletionIndex(
  workspacePath: string | null | undefined,
  allFilePaths: string[],
  aliasCandidates: string[]
): WikiCompletionIndex {
  const key = workspaceKey(workspacePath);
  const current = wikiCompletionIndexByWorkspace.get(key);
  if (current && current.allFilePaths === allFilePaths && current.aliasCandidates === aliasCandidates) {
    wikiCompletionBuildStats.cacheHits += 1;
    return current.index;
  }

  const start = performance.now();
  const index = buildWikiCompletionIndex(buildWikiCompletionCandidates(allFilePaths, aliasCandidates));
  const duration = performance.now() - start;

  wikiCompletionBuildStats.cacheMisses += 1;
  wikiCompletionBuildStats.lastCandidateCount = index.sortedCandidates.length;
  wikiCompletionBuildStats.lastBuildDurationMs = duration;
  wikiCompletionBuildStats.lastWorkspacePath = key;
  wikiCompletionIndexByWorkspace.set(key, {
    allFilePaths,
    aliasCandidates,
    index
  });

  return index;
}

export function __getWikiCompletionBuildStats(): WikiCompletionBuildStats {
  return { ...wikiCompletionBuildStats };
}

export function __clearWikiCompletionCache(): void {
  wikiCompletionIndexByWorkspace.clear();
  wikiCompletionBuildStats.cacheHits = 0;
  wikiCompletionBuildStats.cacheMisses = 0;
  wikiCompletionBuildStats.lastCandidateCount = 0;
  wikiCompletionBuildStats.lastBuildDurationMs = 0;
  wikiCompletionBuildStats.lastWorkspacePath = null;
}

interface WikiCompletionCandidate {
  apply: string;
  label: string;
  normalizedTerms: string[];
}

interface WikiCompletionIndex {
  contains: Map<string, WikiCompletionCandidate[]>;
  exact: Map<string, WikiCompletionCandidate[]>;
  prefix: Map<string, WikiCompletionCandidate[]>;
  sortedCandidates: WikiCompletionCandidate[];
}

const maxWikiCompletionOptions = 80;
const wikiCompletionIndexKeyLength = 2;

function normalizeCompletionText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja");
}

function pathWithoutMarkdownExtension(filePath: string): string {
  return filePath.replace(/\.md$/i, "");
}

function basenameWithoutMarkdownExtension(filePath: string): string {
  return filePath.split("/").at(-1)?.replace(/\.md$/i, "") ?? "";
}

function matchNormalizedRank(candidate: WikiCompletionCandidate, normalizedQuery: string): number | null {
  if (normalizedQuery === "") return 1;
  const terms = candidate.normalizedTerms;

  if (terms.some((term) => term === normalizedQuery)) return 0;
  if (terms.some((term) => term.startsWith(normalizedQuery))) return 1;
  if (terms.some((term) => term.includes(normalizedQuery))) return 2;

  return null;
}

function compareWikiCandidates(left: WikiCompletionCandidate, right: WikiCompletionCandidate): number {
  return left.label.localeCompare(right.label, "ja", { numeric: true, sensitivity: "base" });
}

function wikiCompletionIndexKey(value: string): string {
  return value.slice(0, Math.min(wikiCompletionIndexKeyLength, value.length));
}

function addIndexedCandidate(
  map: Map<string, Set<WikiCompletionCandidate>>,
  key: string,
  candidate: WikiCompletionCandidate
): void {
  if (!key) return;
  const existing = map.get(key);

  if (existing) {
    existing.add(candidate);
    return;
  }

  map.set(key, new Set([candidate]));
}

function addContainsIndexTerms(
  map: Map<string, Set<WikiCompletionCandidate>>,
  term: string,
  candidate: WikiCompletionCandidate
): void {
  const keys = new Set<string>();
  const maxSize = Math.min(wikiCompletionIndexKeyLength, term.length);

  for (let size = 1; size <= maxSize; size += 1) {
    for (let start = 0; start <= term.length - size; start += 1) {
      keys.add(term.slice(start, start + size));
    }
  }

  for (const key of keys) addIndexedCandidate(map, key, candidate);
}

function finalizeWikiCompletionMap(
  map: Map<string, Set<WikiCompletionCandidate>>
): Map<string, WikiCompletionCandidate[]> {
  return new Map(
    Array.from(map.entries(), ([key, candidates]) => [
      key,
      Array.from(candidates).sort(compareWikiCandidates)
    ])
  );
}

function buildWikiCompletionIndex(candidates: WikiCompletionCandidate[]): WikiCompletionIndex {
  const exact = new Map<string, Set<WikiCompletionCandidate>>();
  const prefix = new Map<string, Set<WikiCompletionCandidate>>();
  const contains = new Map<string, Set<WikiCompletionCandidate>>();

  for (const candidate of candidates) {
    for (const term of candidate.normalizedTerms) {
      addIndexedCandidate(exact, term, candidate);
      addIndexedCandidate(prefix, wikiCompletionIndexKey(term), candidate);
      addContainsIndexTerms(contains, term, candidate);
    }
  }

  return {
    contains: finalizeWikiCompletionMap(contains),
    exact: finalizeWikiCompletionMap(exact),
    prefix: finalizeWikiCompletionMap(prefix),
    sortedCandidates: candidates.toSorted(compareWikiCandidates)
  };
}

function rankedWikiCompletionCandidates(
  index: WikiCompletionIndex,
  query: string
): Array<WikiCompletionCandidate & { rank: number }> {
  const normalizedQuery = normalizeCompletionText(query);

  if (normalizedQuery === "") {
    return index.sortedCandidates.slice(0, maxWikiCompletionOptions).map((candidate) => ({ ...candidate, rank: 1 }));
  }

  const ranked: Array<WikiCompletionCandidate & { rank: number }> = [];
  const seen = new Set<WikiCompletionCandidate>();

  function addCandidates(candidates: WikiCompletionCandidate[] | undefined): void {
    if (!candidates) return;

    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;

      const rank = matchNormalizedRank(candidate, normalizedQuery);
      if (rank === null) continue;

      seen.add(candidate);
      ranked.push({ ...candidate, rank });
    }
  }

  addCandidates(index.exact.get(normalizedQuery));
  addCandidates(index.prefix.get(wikiCompletionIndexKey(normalizedQuery)));

  if (ranked.length < maxWikiCompletionOptions) {
    addCandidates(index.contains.get(wikiCompletionIndexKey(normalizedQuery)));
  }

  return ranked.toSorted((a, b) => a.rank - b.rank || compareWikiCandidates(a, b));
}

function buildWikiCompletionCandidates(allFilePaths: string[], aliasCandidates: string[]): WikiCompletionCandidate[] {
  const basenameMap = new Map<string, string[]>();

  for (const filePath of allFilePaths) {
    const basename = basenameWithoutMarkdownExtension(filePath);

    if (!basename) continue;

    if (!basenameMap.has(basename)) basenameMap.set(basename, []);

    basenameMap.get(basename)!.push(filePath);
  }

  const candidates: WikiCompletionCandidate[] = [];

  for (const [basename, paths] of basenameMap) {
    if (paths.length === 1) {
      const pathLabel = pathWithoutMarkdownExtension(paths[0]);
      candidates.push({
        apply: `${basename}]]`,
        label: basename,
        normalizedTerms: [basename, pathLabel].map(normalizeCompletionText)
      });
    } else {
      for (const filePath of paths) {
        const label = pathWithoutMarkdownExtension(filePath);
        candidates.push({
          apply: `${label}]]`,
          label,
          normalizedTerms: [basename, label].map(normalizeCompletionText)
        });
      }
    }
  }

  for (const alias of aliasCandidates) {
    const trimmed = alias.trim();
    if (!trimmed) continue;
    candidates.push({
      apply: `${trimmed}]]`,
      label: trimmed,
      normalizedTerms: [trimmed].map(normalizeCompletionText)
    });
  }

  return candidates;
}

export function buildWikiLinkCompletionSource(
  allFilePaths: string[],
  frontmatterCandidates: Record<string, string[]> = {},
  options?: { workspacePath?: string | null }
) {
  const aliasCandidates = frontmatterCandidates.aliases ?? [];
  let index: WikiCompletionIndex | null = null;

  return (context: CompletionContext): CompletionResult | null => {
    if (context.state && isPositionInFencedCodeBlock(context.state, context.pos)) return null;

    const before = context.matchBefore(/\[\[([^\]\n]*)$/);

    if (!before || (!context.explicit && before.text === "[[")) return null;

    if (!index) {
      index = buildOrGetCachedWikiCompletionIndex(
        options?.workspacePath,
        allFilePaths,
        aliasCandidates
      );
    }

    const query = before.text.slice(2);
    const ranked = rankedWikiCompletionCandidates(index, query);

    return {
      filter: false,
      from: before.from + 2,
      options: ranked.slice(0, maxWikiCompletionOptions).map(({ apply, label }) => ({ apply, label }))
    };
  };
}

export function buildAutocompleteExtension(
  allFilePaths: string[],
  frontmatterCandidates: Record<string, string[]>,
  workspacePath?: string | null
): Extension {
  return autocompletion({
    override: [buildWikiLinkCompletionSource(allFilePaths, frontmatterCandidates, { workspacePath })]
  });
}
