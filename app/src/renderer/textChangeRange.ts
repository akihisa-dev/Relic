export interface TextChangeRange {
  from: number;
  newTo: number;
  oldTo: number;
}

/**
 * Returns the smallest single replacement that transforms oldText into newText.
 * Positions use UTF-16 offsets, matching JavaScript strings and CodeMirror.
 */
export function textChangeRange(oldText: string, newText: string): TextChangeRange | null {
  if (oldText === newText) return null;

  const sharedLimit = Math.min(oldText.length, newText.length);
  let from = 0;
  while (from < sharedLimit && oldText.charCodeAt(from) === newText.charCodeAt(from)) from += 1;

  let oldTo = oldText.length;
  let newTo = newText.length;
  while (
    oldTo > from &&
    newTo > from &&
    oldText.charCodeAt(oldTo - 1) === newText.charCodeAt(newTo - 1)
  ) {
    oldTo -= 1;
    newTo -= 1;
  }

  return { from, newTo, oldTo };
}
