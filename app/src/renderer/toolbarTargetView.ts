import { EditorView } from "@codemirror/view";

export function findToolbarTargetView(
  views: EditorView[],
  lastTargetView: EditorView | null
): EditorView | null {
  const activeDomView = findActiveElementView();
  if (activeDomView) return activeDomView;

  const activeView = views.find(viewContainsActiveElement);
  if (activeView) return activeView;

  const selectedDomView = findBrowserSelectionView();
  if (selectedDomView) return selectedDomView;

  const selectedView = views.find(viewContainsBrowserSelection);
  if (selectedView) return selectedView;

  const focusedView = views.find((view) => view.hasFocus);
  if (focusedView) return focusedView;

  const selectedStateViews = views.filter(viewHasNonEmptySelection);
  if (selectedStateViews.length === 1) return selectedStateViews[0];

  return lastTargetView ?? views[0] ?? null;
}

function viewContainsBrowserSelection(view: EditorView): boolean {
  const selection = window.getSelection();
  const anchorNode = selection?.anchorNode;
  const focusNode = selection?.focusNode;

  if (!selection || selection.isCollapsed || !anchorNode || !focusNode) return false;

  return view.dom.contains(anchorNode) || view.dom.contains(focusNode);
}

function findViewFromNode(node: Node | null): EditorView | null {
  const element = node instanceof Element ? node : node?.parentElement ?? null;

  return element instanceof HTMLElement ? EditorView.findFromDOM(element) ?? null : null;
}

function findBrowserSelectionView(): EditorView | null {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed) return null;

  return findViewFromNode(selection.anchorNode) ?? findViewFromNode(selection.focusNode);
}

function findActiveElementView(): EditorView | null {
  return findViewFromNode(document.activeElement);
}

function viewContainsActiveElement(view: EditorView): boolean {
  const activeElement = document.activeElement;

  return activeElement !== null && view.dom.contains(activeElement);
}

function viewHasNonEmptySelection(view: EditorView): boolean {
  return view.state.selection.ranges.some((range) => !range.empty);
}
