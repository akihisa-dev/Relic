import { StateEffect, StateField, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

import type { FrontmatterDateFormat, UserDefinedField } from "../shared/ipc";
import { setEditorEditable } from "./editorEditable";
import {
  findFrontmatterBlock,
  reorderTopLevelYamlFields,
  serializeDataPreservingYaml,
  type FrontmatterBlock
} from "./editorFrontmatterModel";
import {
  createFrontmatterFooter,
  createFrontmatterHeader,
  frontmatterRowsForBlock
} from "./editorFrontmatterWidgetDom";
import type { Translator } from "./i18nModel";

const frontmatterCollapsedEffect = StateEffect.define<boolean>();

interface FrontmatterCollapsedState {
  blockFrom: number | null;
  blockTo: number | null;
  collapsed: boolean;
}

export const frontmatterCollapsedField = StateField.define<FrontmatterCollapsedState>({
  create: (state) => {
    const block = findFrontmatterBlock(state);

    return {
      blockFrom: block?.from ?? null,
      blockTo: block?.to ?? null,
      collapsed: true
    };
  },
  update: (value, transaction) => {
    let collapsed = value.collapsed;
    let hasExplicitCollapseEffect = false;

    for (const effect of transaction.effects) {
      if (effect.is(frontmatterCollapsedEffect)) {
        collapsed = effect.value;
        hasExplicitCollapseEffect = true;
      }
    }

    const block = findFrontmatterBlock(transaction.state);
    const hadBlock = value.blockFrom !== null && value.blockTo !== null;

    if (!hasExplicitCollapseEffect && !hadBlock && block) {
      collapsed = true;
    }

    return {
      blockFrom: block?.from ?? null,
      blockTo: block?.to ?? null,
      collapsed
    };
  }
});

function frontmatterCollapsedValue(state: EditorState): boolean {
  return state.field(frontmatterCollapsedField, false)?.collapsed ?? true;
}

class FrontmatterPropertiesWidget extends WidgetType {
  constructor(
    private readonly block: FrontmatterBlock,
    private readonly userDefinedFields: UserDefinedField[],
    private readonly candidates: Record<string, string[]>,
    private readonly collapsed: boolean,
    private readonly t: Translator,
    private readonly dateFormat: FrontmatterDateFormat
  ) {
    super();
  }

  override eq(other: FrontmatterPropertiesWidget): boolean {
    return this.block.from === other.block.from &&
      this.block.to === other.block.to &&
      JSON.stringify(this.block.data) === JSON.stringify(other.block.data) &&
      JSON.stringify(this.userDefinedFields) === JSON.stringify(other.userDefinedFields) &&
      JSON.stringify(this.candidates) === JSON.stringify(other.candidates) &&
      this.collapsed === other.collapsed &&
      this.dateFormat === other.dateFormat &&
      this.t === other.t;
  }

  override toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("section");
    wrapper.className = "cm-frontmatter-properties cm-frontmatter-properties--panel";
    wrapper.dataset.collapsed = String(this.collapsed);
    wrapper.contentEditable = "false";
    wrapper.addEventListener("focusin", () => scheduleEditorEditable(view, false));
    wrapper.addEventListener("focusout", (event) => {
      const nextTarget = (event as FocusEvent).relatedTarget;
      if (!(nextTarget instanceof Node) || !wrapper.contains(nextTarget)) {
        scheduleEditorEditable(view, true);
      }
    });

    wrapper.append(createFrontmatterHeader({
      collapsed: this.collapsed,
      count: Object.keys(this.block.data).length,
      onToggle: () => view.dispatch({ effects: frontmatterCollapsedEffect.of(!this.collapsed) }),
      t: this.t
    }));
    if (this.collapsed) return wrapper;

    wrapper.append(...frontmatterRowsForBlock({
      block: this.block,
      candidates: this.candidates,
      dateFormat: this.dateFormat,
      reorderFields: (orderedKeys) => this.reorderFields(view, orderedKeys),
      t: this.t,
      updateField: (editorView, key, value) => this.updateField(editorView, key, value),
      userDefinedFields: this.userDefinedFields,
      view
    }));
    wrapper.append(createFrontmatterFooter({
      t: this.t
    }));
    return wrapper;
  }

  override ignoreEvent(): boolean {
    return true;
  }

  private updateField(view: EditorView, key: string, value: unknown): void {
    const nextData = { ...this.block.data };

    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
      delete nextData[key];
    } else {
      nextData[key] = value;
    }

    this.writeData(view, nextData);
  }

  private reorderFields(view: EditorView, orderedKeys: string[]): void {
    const nextYaml = reorderTopLevelYamlFields(this.block.yamlText, orderedKeys);
    if (nextYaml === this.block.yamlText) return;

    setEditorEditable(view, true);
    const openLine = view.state.doc.line(this.block.startLine);
    const closeLine = view.state.doc.line(this.block.endLine);
    view.dispatch({
      changes: {
        from: openLine.to + 1,
        insert: nextYaml,
        to: closeLine.from
      }
    });
  }

  private writeData(view: EditorView, nextData: Record<string, unknown>): void {
    setEditorEditable(view, true);
    const nextYaml = serializeDataPreservingYaml(this.block, nextData, this.userDefinedFields).trimEnd();
    const nextBlock = Object.keys(nextData).length > 0 ? `---\n${nextYaml}\n---` : "";
    view.dispatch({
      changes: {
        from: this.block.from,
        insert: nextBlock,
        to: this.block.to
      }
    });
  }
}

function scheduleEditorEditable(view: EditorView, editable: boolean): void {
  globalThis.setTimeout(() => {
    try {
      setEditorEditable(view, editable);
    } catch {
      // The view can be gone by the time the deferred focus handler runs.
    }
  }, 0);
}

function buildFrontmatterPropertiesDecorations(
  state: EditorState,
  userDefinedFields: UserDefinedField[] = [],
  candidates: Record<string, string[]> = {},
  t: Translator,
  dateFormat: FrontmatterDateFormat
): DecorationSet {
  const block = findFrontmatterBlock(state);
  if (!block) return Decoration.none;

  const widget = new FrontmatterPropertiesWidget(
    block,
    userDefinedFields,
    candidates,
    frontmatterCollapsedValue(state),
    t,
    dateFormat
  );
  return Decoration.set([
    Decoration.replace({ widget, block: true }).range(block.from, block.to)
  ]);
}

export function createFrontmatterPropertiesField(
  userDefinedFields: UserDefinedField[],
  candidates: Record<string, string[]>,
  t: Translator,
  dateFormat: FrontmatterDateFormat
): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create: (state) => buildFrontmatterPropertiesDecorations(state, userDefinedFields, candidates, t, dateFormat),
    update: (_decorations, transaction) => buildFrontmatterPropertiesDecorations(
      transaction.state,
      userDefinedFields,
      candidates,
      t,
      dateFormat
    ),
    provide: (field) => EditorView.decorations.from(field)
  });
}
