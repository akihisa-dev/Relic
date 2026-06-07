import { StateEffect, StateField, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

import type { FrontmatterDateFormat, UserDefinedField } from "../shared/ipc";
import { setEditorEditable } from "./editorEditable";
import {
  findFrontmatterBlock,
  findTopLevelYamlFieldEntries,
  serializeDataPreservingYaml,
  type FrontmatterBlock
} from "./editorFrontmatterModel";
import {
  createFrontmatterHeader,
  frontmatterRowForLine
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

function visibleFrontmatterLineNumbers(block: FrontmatterBlock): Set<number> {
  const lines = block.yamlText.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();

  const lineNumbers = new Set<number>([block.startLine]);
  for (const entry of findTopLevelYamlFieldEntries(lines)) {
    if (Object.prototype.hasOwnProperty.call(block.data, entry.key)) {
      lineNumbers.add(block.startLine + entry.start + 1);
    }
  }

  return lineNumbers;
}

class FrontmatterPropertiesWidget extends WidgetType {
  constructor(
    private readonly block: FrontmatterBlock,
    private readonly userDefinedFields: UserDefinedField[],
    private readonly candidates: Record<string, string[]>,
    private readonly lineNumber: number,
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
      this.lineNumber === other.lineNumber &&
      this.collapsed === other.collapsed &&
      this.dateFormat === other.dateFormat;
  }

  override toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("section");
    wrapper.className = "cm-frontmatter-properties";
    wrapper.dataset.collapsed = String(this.collapsed);
    wrapper.contentEditable = "false";
    wrapper.addEventListener("focusin", () => setEditorEditable(view, false));
    wrapper.addEventListener("focusout", (event) => {
      const nextTarget = (event as FocusEvent).relatedTarget;
      if (!(nextTarget instanceof Node) || !wrapper.contains(nextTarget)) {
        setEditorEditable(view, true);
      }
    });

    if (this.lineNumber !== this.block.startLine) {
      if (this.collapsed) {
        wrapper.classList.add("cm-frontmatter-properties--collapsed-line");
        return wrapper;
      }

      const row = frontmatterRowForLine({
        block: this.block,
        candidates: this.candidates,
        lineNumber: this.lineNumber,
        t: this.t,
        updateField: (editorView, key, value) => this.updateField(editorView, key, value),
        userDefinedFields: this.userDefinedFields,
        view,
        dateFormat: this.dateFormat
      });
      if (row) {
        wrapper.append(row);
      } else {
        wrapper.classList.add("cm-frontmatter-properties--spacer");
      }
      return wrapper;
    }

    wrapper.append(createFrontmatterHeader({
      collapsed: this.collapsed,
      count: Object.keys(this.block.data).length,
      onToggle: () => view.dispatch({ effects: frontmatterCollapsedEffect.of(!this.collapsed) }),
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

function buildFrontmatterPropertiesDecorations(
  state: EditorState,
  userDefinedFields: UserDefinedField[] = [],
  candidates: Record<string, string[]> = {},
  t: Translator,
  dateFormat: FrontmatterDateFormat
): DecorationSet {
  const block = findFrontmatterBlock(state);
  if (!block) return Decoration.none;

  const collapsed = frontmatterCollapsedValue(state);
  const visibleLineNumbers = collapsed ? new Set<number>([block.startLine]) : visibleFrontmatterLineNumbers(block);
  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  for (let lineNumber = block.startLine; lineNumber <= block.endLine; lineNumber += 1) {
    const line = state.doc.line(lineNumber);

    if (!visibleLineNumbers.has(lineNumber)) {
      if (!collapsed) {
        const previousLine = state.doc.line(lineNumber - 1);
        ranges.push({
          from: previousLine.to,
          to: line.to,
          deco: Decoration.replace({})
        });
      }
      continue;
    }

    const widget = new FrontmatterPropertiesWidget(block, userDefinedFields, candidates, lineNumber, collapsed, t, dateFormat);
    ranges.push({
      from: line.from,
      to: line.to,
      deco: line.from < line.to
        ? Decoration.replace({ widget })
        : Decoration.widget({ widget })
    });
  }

  if (collapsed && block.endLine > block.startLine) {
    ranges.push({
      from: state.doc.line(block.startLine).to,
      to: state.doc.line(block.endLine).to,
      deco: Decoration.replace({})
    });
  }

  return Decoration.set(ranges.map((range) => range.deco.range(range.from, range.to)), true);
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
