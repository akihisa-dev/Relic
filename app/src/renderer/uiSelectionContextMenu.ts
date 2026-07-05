export interface UiSelectionContextMenuState {
  text: string;
  x: number;
  y: number;
}

function selectionTargetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Text) return target.parentElement;
  return null;
}

function isExcludedSelectionTarget(target: EventTarget | null): boolean {
  const element = selectionTargetElement(target);
  if (!element) return true;

  return Boolean(element.closest([
    "input",
    "textarea",
    "select",
    "[contenteditable='true']",
    ".cm-editor",
    ".editor-context-menu",
    ".tab-context-menu",
    ".command-palette"
  ].join(",")));
}

function selectionContainsTarget(selection: Selection, target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;

  try {
    if (selection.containsNode(target, true)) return true;
    for (let index = 0; index < selection.rangeCount; index += 1) {
      if (selection.getRangeAt(index).intersectsNode(target)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function selectedUiTextForContextMenu(event: MouseEvent, selection: Selection | null): string | null {
  if (!selection || selection.rangeCount === 0) return null;
  if (isExcludedSelectionTarget(event.target)) return null;
  if (!selectionContainsTarget(selection, event.target)) return null;

  const text = selection.toString();
  return text.trim().length > 0 ? text : null;
}
