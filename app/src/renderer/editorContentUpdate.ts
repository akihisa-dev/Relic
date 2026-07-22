import type { ChangeSet } from "@codemirror/state";

import { textChangeRange, type TextChangeRange } from "./textChangeRange";

export interface EditorContentUpdateInput {
  change: TextChangeRange | null;
  generation: number;
  sourceKey?: string;
}

export interface EditorContentUpdate extends EditorContentUpdateInput {
  previousRevision: number;
  revision: number;
}

let nextContentGeneration = 0;

export function nextEditorContentGeneration(): number {
  nextContentGeneration += 1;
  return nextContentGeneration;
}

export function changeRangeFromChangeSet(changes: ChangeSet): TextChangeRange | null {
  let from = Number.POSITIVE_INFINITY;
  let oldTo = 0;
  let newTo = 0;

  changes.iterChangedRanges((rangeFrom, rangeOldTo, rangeNewFrom, rangeNewTo) => {
    from = Math.min(from, rangeFrom, rangeNewFrom);
    oldTo = Math.max(oldTo, rangeOldTo);
    newTo = Math.max(newTo, rangeNewTo);
  });

  return Number.isFinite(from) ? { from, oldTo, newTo } : null;
}

export function contentChangeRange(
  previousContent: string,
  previousRevision: number,
  content: string,
  revision: number,
  update?: EditorContentUpdate
): TextChangeRange | null {
  if (
    update?.change &&
    update.previousRevision === previousRevision &&
    update.revision === revision
  ) {
    return update.change;
  }

  return textChangeRange(previousContent, content);
}

/** @internal Test-only reset for deterministic generation assertions. */
export function __resetEditorContentGenerationForTests(): void {
  nextContentGeneration = 0;
}
