import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";

import {
  buildMermaidSource,
  createEmptyMermaidFlowchart,
  isValidMermaidNodeId,
  mermaidConnectionKey,
  nextMermaidNodeId,
  parseMermaidFlowchart,
  type MermaidConnection,
  type MermaidDirection,
  type MermaidFlowchartModel,
  type MermaidNode,
  type MermaidNodeShape
} from "../mermaidFlowchart";
import { buildMermaidFallback, renderMermaidElement } from "../mermaidPreview";
import { useT, type Translator } from "../i18n";

type MermaidSelection =
  | { type: "connection"; index: number }
  | { type: "node"; id: string }
  | null;

interface NewNodeDraft {
  error: string | null;
  id: string;
  label: string;
  shape: MermaidNodeShape;
}

interface NewConnectionDraft {
  error: string | null;
  from: string | null;
  label: string;
  to: string | null;
}

interface MermaidVisualEditorProps {
  blockRange: {
    from: number;
    to: number;
  };
  filePath: string;
  onChange: (source: string) => void;
  source: string;
}

const shapeOptions: MermaidNodeShape[] = ["rectangle", "diamond", "circle"];

export function MermaidVisualEditor({
  blockRange,
  filePath,
  onChange,
  source
}: MermaidVisualEditorProps): ReactElement {
  const t = useT();
  const [workingSource, setWorkingSource] = useState(source);
  const [selection, setSelection] = useState<MermaidSelection>(null);
  const [nodeDraft, setNodeDraft] = useState<NewNodeDraft | null>(null);
  const [nodeIdDraft, setNodeIdDraft] = useState("");
  const [nodeIdError, setNodeIdError] = useState<string | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<NewConnectionDraft | null>(null);
  const lastWrittenSourceRef = useRef<string | null>(null);

  useEffect(() => {
    if (source === lastWrittenSourceRef.current) return;

    setWorkingSource(source);
    setSelection(null);
    setNodeDraft(null);
    setNodeIdDraft("");
    setNodeIdError(null);
    setConnectionDraft(null);
  }, [source]);

  const parseResult = useMemo(() => parseMermaidFlowchart(workingSource), [workingSource]);
  const isEmptyMermaid = !parseResult.ok && parseResult.reason === "empty";
  const model = parseResult.ok
    ? parseResult.model
    : isEmptyMermaid
      ? createEmptyMermaidFlowchart()
      : null;
  const isVisualEditable = model !== null;
  const visualSource = model ? buildMermaidSource(model) : workingSource;
  const selectedNode = selection?.type === "node"
    ? model?.nodes.find((node) => node.id === selection.id) ?? null
    : null;
  const selectedConnection = selection?.type === "connection"
    ? model?.connections[selection.index] ?? null
    : null;

  useEffect(() => {
    if (!selectedNode) {
      setNodeIdDraft("");
      setNodeIdError(null);
      return;
    }

    setNodeIdDraft(selectedNode.id);
    setNodeIdError(null);
  }, [selectedNode?.id]);

  useEffect(() => {
    if (!model) return;

    if (selection?.type === "node" && !model.nodes.some((node) => node.id === selection.id)) {
      setSelection(null);
    }

    if (selection?.type === "connection" && !model.connections[selection.index]) {
      setSelection(null);
    }
  }, [model, selection]);

  const commitSource = (nextSource: string): void => {
    lastWrittenSourceRef.current = nextSource;
    setWorkingSource(nextSource);
    onChange(nextSource);
  };

  const commitModel = (nextModel: MermaidFlowchartModel): void => {
    commitSource(buildMermaidSource(nextModel));
  };

  const updateDirection = (direction: MermaidDirection): void => {
    if (!model) return;
    commitModel({ ...model, direction });
  };

  const openNodeDraft = (): void => {
    if (!model) return;

    const id = nextMermaidNodeId(model.nodes);
    setNodeDraft({
      error: null,
      id,
      label: "",
      shape: "rectangle"
    });
    setConnectionDraft(null);
    setSelection(null);
  };

  const updateNodeDraft = (patch: Partial<Omit<NewNodeDraft, "error">>): void => {
    if (!nodeDraft) return;
    setNodeDraft({ ...nodeDraft, ...patch, error: null });
  };

  const submitNodeDraft = (): void => {
    if (!model || !nodeDraft) return;

    const id = nodeDraft.id.trim();
    const label = nodeDraft.label.trim() || id;
    const error = validateNodeId(id, model.nodes, t);
    if (error) {
      setNodeDraft({ ...nodeDraft, error });
      return;
    }

    commitModel({
      ...model,
      nodes: [...model.nodes, { id, label, shape: nodeDraft.shape }]
    });
    setNodeDraft(null);
    setSelection({ id, type: "node" });
  };

  const deleteSelectedNode = (): void => {
    if (!model || !selectedNode) return;

    commitModel({
      ...model,
      connections: model.connections.filter((connection) => (
        connection.from !== selectedNode.id && connection.to !== selectedNode.id
      )),
      nodes: model.nodes.filter((node) => node.id !== selectedNode.id)
    });
    setSelection(null);
  };

  const updateSelectedNode = (patch: Partial<Pick<MermaidNode, "label" | "shape">>): void => {
    if (!model || !selectedNode) return;

    commitModel({
      ...model,
      nodes: model.nodes.map((node) => (
        node.id === selectedNode.id ? { ...node, ...patch } : node
      ))
    });
  };

  const commitSelectedNodeId = (): void => {
    if (!model || !selectedNode) return;

    const nextId = nodeIdDraft.trim();
    if (nextId === selectedNode.id) return;

    const error = validateNodeId(nextId, model.nodes, t, selectedNode.id);
    if (error) {
      setNodeIdError(error);
      return;
    }

    commitModel({
      ...model,
      connections: model.connections.map((connection) => ({
        ...connection,
        from: connection.from === selectedNode.id ? nextId : connection.from,
        to: connection.to === selectedNode.id ? nextId : connection.to
      })),
      nodes: model.nodes.map((node) => (
        node.id === selectedNode.id ? { ...node, id: nextId } : node
      ))
    });
    setSelection({ id: nextId, type: "node" });
    setNodeIdError(null);
  };

  const startConnectionDraft = (): void => {
    setConnectionDraft({
      error: null,
      from: null,
      label: "",
      to: null
    });
    setNodeDraft(null);
    setSelection(null);
  };

  const handlePreviewNodeSelect = (id: string): void => {
    if (!model) return;

    if (!connectionDraft) {
      setSelection({ id, type: "node" });
      return;
    }

    if (!connectionDraft.from) {
      setConnectionDraft({ ...connectionDraft, error: null, from: id });
      setSelection({ id, type: "node" });
      return;
    }

    setConnectionDraft({ ...connectionDraft, error: null, to: id });
    setSelection({ id, type: "node" });
  };

  const submitConnectionDraft = (): void => {
    if (!model || !connectionDraft?.from || !connectionDraft.to) return;

    const nextConnection = normalizeConnection({
      from: connectionDraft.from,
      label: connectionDraft.label,
      to: connectionDraft.to
    });
    if (hasSameConnection(model.connections, nextConnection)) {
      setConnectionDraft({ ...connectionDraft, error: t("mermaidEditor.duplicateConnection") });
      return;
    }

    commitModel({
      ...model,
      connections: [...model.connections, nextConnection]
    });
    setSelection({ index: model.connections.length, type: "connection" });
    setConnectionDraft(null);
  };

  const deleteSelectedConnection = (): void => {
    if (!model || selection?.type !== "connection") return;

    commitModel({
      ...model,
      connections: model.connections.filter((_connection, index) => index !== selection.index)
    });
    setSelection(null);
  };

  const updateSelectedConnectionLabel = (label: string): void => {
    if (!model || selection?.type !== "connection") return;

    const nextConnection = normalizeConnection({
      ...model.connections[selection.index],
      label
    });

    commitModel({
      ...model,
      connections: model.connections.map((connection, index) => (
        index === selection.index ? nextConnection : connection
      ))
    });
  };

  const handleSourceChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    commitSource(event.target.value);
    setSelection(null);
    setNodeDraft(null);
    setNodeIdDraft("");
    setNodeIdError(null);
    setConnectionDraft(null);
  };

  return (
    <div className="mermaid-visual-editor">
      <header className="mermaid-visual-header">
        <div>
          <h2>{t("mermaidEditor.title")}</h2>
          <p>{t("mermaidEditor.description")}</p>
        </div>
        <div className="mermaid-visual-context">
          <span>{filePath}</span>
          <span>{t("mermaidEditor.blockRange", { from: blockRange.from, to: blockRange.to })}</span>
          <strong>{t("mermaidEditor.savedToMarkdown")}</strong>
        </div>
      </header>

      {!isVisualEditable ? (
        <div className="mermaid-visual-state-banner" role="status">
          {t("mermaidEditor.unsupportedMermaid")}
        </div>
      ) : null}

      <div className="mermaid-visual-workspace">
        <section className="mermaid-visual-preview-panel" aria-label={t("mermaidEditor.preview")}>
          <div className="mermaid-visual-panel-heading">{t("mermaidEditor.preview")}</div>
          <MermaidRenderedPreview
            connectionDraft={connectionDraft}
            model={model}
            onConnectionSelect={(index) => {
              setConnectionDraft(null);
              setNodeDraft(null);
              setSelection({ index, type: "connection" });
            }}
            onNodeSelect={handlePreviewNodeSelect}
            selection={selection}
            source={visualSource}
          />
        </section>

        <aside className="mermaid-visual-inspector" aria-label={t("mermaidEditor.selection")}>
          <div className="mermaid-visual-panel-heading">{t("mermaidEditor.selection")}</div>
          {connectionDraft ? (
            <ConnectionDraftForm
              draft={connectionDraft}
              nodes={model?.nodes ?? []}
              onCancel={() => setConnectionDraft(null)}
              onLabelChange={(label) => setConnectionDraft({ ...connectionDraft, error: null, label })}
              onSubmit={submitConnectionDraft}
              t={t}
            />
          ) : selectedNode ? (
            <NodeInspector
              error={nodeIdError}
              node={selectedNode}
              nodeIdDraft={nodeIdDraft}
              onDelete={deleteSelectedNode}
              onIdCommit={commitSelectedNodeId}
              onIdDraftChange={(value) => {
                setNodeIdDraft(value);
                setNodeIdError(null);
              }}
              onLabelChange={(label) => updateSelectedNode({ label })}
              onShapeChange={(shape) => updateSelectedNode({ shape })}
              t={t}
            />
          ) : selectedConnection ? (
            <ConnectionInspector
              connection={selectedConnection}
              onDelete={deleteSelectedConnection}
              onLabelChange={updateSelectedConnectionLabel}
              t={t}
            />
          ) : (
            <div className="mermaid-visual-empty-selection">{t("mermaidEditor.emptySelection")}</div>
          )}
        </aside>
      </div>

      <section className="mermaid-visual-actions" aria-label={t("mermaidEditor.structure")}>
        <div className="mermaid-visual-action-row">
          <button className="secondary-button" disabled={!isVisualEditable} onClick={openNodeDraft} type="button">
            {t("mermaidEditor.addNode")}
          </button>
          <button className="secondary-button" disabled={!isVisualEditable} onClick={startConnectionDraft} type="button">
            {t("mermaidEditor.addConnection")}
          </button>
          <label className="mermaid-visual-inline-field">
            <span>{t("mermaidEditor.direction")}</span>
            <select
              disabled={!isVisualEditable}
              onChange={(event) => updateDirection(event.target.value as MermaidDirection)}
              value={model?.direction ?? "TD"}
            >
              <option value="TD">TD</option>
              <option value="LR">LR</option>
            </select>
          </label>
        </div>

        {nodeDraft ? (
          <NodeDraftForm
            draft={nodeDraft}
            onCancel={() => setNodeDraft(null)}
            onChange={updateNodeDraft}
            onSubmit={submitNodeDraft}
            t={t}
          />
        ) : null}

        <details className="mermaid-visual-source-editor" open={!isVisualEditable}>
          <summary>{t("mermaidEditor.sourceEdit")}</summary>
          <textarea
            aria-label={t("mermaidEditor.source")}
            onChange={handleSourceChange}
            spellCheck={false}
            value={workingSource}
          />
        </details>
      </section>
    </div>
  );
}

function MermaidRenderedPreview({
  connectionDraft,
  model,
  onConnectionSelect,
  onNodeSelect,
  selection,
  source
}: {
  connectionDraft: NewConnectionDraft | null;
  model: MermaidFlowchartModel | null;
  onConnectionSelect: (index: number) => void;
  onNodeSelect: (id: string) => void;
  selection: MermaidSelection;
  source: string;
}): ReactElement {
  const previewRef = useRef<HTMLDivElement>(null);
  const selectionKey = selection?.type === "node"
    ? `node:${selection.id}`
    : selection?.type === "connection"
      ? `connection:${selection.index}`
      : "none";
  const connectionDraftKey = `${connectionDraft?.from ?? ""}->${connectionDraft?.to ?? ""}`;

  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;

    let cancelled = false;
    container.replaceChildren(buildMermaidFallback(source));
    void renderMermaidElement(container, source).then((handle) => {
      if (cancelled || !handle || !model) return;
      wireMermaidPreviewSelection(container, model, selection, connectionDraft, onNodeSelect, onConnectionSelect);
    });

    return () => {
      cancelled = true;
    };
  }, [connectionDraftKey, model, onConnectionSelect, onNodeSelect, selectionKey, source]);

  return <div className="mermaid-visual-preview preview-mermaid" ref={previewRef} />;
}

function NodeDraftForm({
  draft,
  onCancel,
  onChange,
  onSubmit,
  t
}: {
  draft: NewNodeDraft;
  onCancel: () => void;
  onChange: (patch: Partial<Omit<NewNodeDraft, "error">>) => void;
  onSubmit: () => void;
  t: Translator;
}): ReactElement {
  return (
    <div className="mermaid-visual-form mermaid-visual-form--inline">
      <label className="mermaid-visual-field">
        <span>{t("mermaidEditor.nodeId")}</span>
        <input onChange={(event) => onChange({ id: event.target.value })} value={draft.id} />
      </label>
      <label className="mermaid-visual-field">
        <span>{t("mermaidEditor.label")}</span>
        <input onChange={(event) => onChange({ label: event.target.value })} value={draft.label} />
      </label>
      <label className="mermaid-visual-field">
        <span>{t("mermaidEditor.shape")}</span>
        <select onChange={(event) => onChange({ shape: event.target.value as MermaidNodeShape })} value={draft.shape}>
          {shapeOptions.map((shape) => <option key={shape} value={shape}>{shapeLabel(shape, t)}</option>)}
        </select>
      </label>
      {draft.error ? <div className="mermaid-visual-form-error" role="alert">{draft.error}</div> : null}
      <div className="mermaid-visual-form-actions">
        <button className="secondary-button" onClick={onSubmit} type="button">{t("mermaidEditor.add")}</button>
        <button className="secondary-button" onClick={onCancel} type="button">{t("mermaidEditor.cancel")}</button>
      </div>
    </div>
  );
}

function NodeInspector({
  error,
  node,
  nodeIdDraft,
  onDelete,
  onIdCommit,
  onIdDraftChange,
  onLabelChange,
  onShapeChange,
  t
}: {
  error: string | null;
  node: MermaidNode;
  nodeIdDraft: string;
  onDelete: () => void;
  onIdCommit: () => void;
  onIdDraftChange: (value: string) => void;
  onLabelChange: (label: string) => void;
  onShapeChange: (shape: MermaidNodeShape) => void;
  t: Translator;
}): ReactElement {
  return (
    <div className="mermaid-visual-form">
      <label className="mermaid-visual-field">
        <span>{t("mermaidEditor.nodeId")}</span>
        <input onChange={(event) => onIdDraftChange(event.target.value)} value={nodeIdDraft} />
      </label>
      <button
        className="secondary-button"
        disabled={nodeIdDraft.trim() === node.id}
        onClick={onIdCommit}
        type="button"
      >
        {t("mermaidEditor.applyNodeId")}
      </button>
      {error ? <div className="mermaid-visual-form-error" role="alert">{error}</div> : null}
      <label className="mermaid-visual-field">
        <span>{t("mermaidEditor.label")}</span>
        <input onChange={(event) => onLabelChange(event.target.value)} value={node.label} />
      </label>
      <label className="mermaid-visual-field">
        <span>{t("mermaidEditor.shape")}</span>
        <select onChange={(event) => onShapeChange(event.target.value as MermaidNodeShape)} value={node.shape}>
          {shapeOptions.map((shape) => <option key={shape} value={shape}>{shapeLabel(shape, t)}</option>)}
        </select>
      </label>
      <button className="secondary-button danger-button" onClick={onDelete} type="button">
        {t("mermaidEditor.deleteNode")}
      </button>
    </div>
  );
}

function ConnectionDraftForm({
  draft,
  nodes,
  onCancel,
  onLabelChange,
  onSubmit,
  t
}: {
  draft: NewConnectionDraft;
  nodes: MermaidNode[];
  onCancel: () => void;
  onLabelChange: (label: string) => void;
  onSubmit: () => void;
  t: Translator;
}): ReactElement {
  return (
    <div className="mermaid-visual-form">
      <div className="mermaid-visual-help">
        {!draft.from
          ? t("mermaidEditor.connectionPickStart")
          : !draft.to
            ? t("mermaidEditor.connectionPickEnd", { id: draft.from })
            : t("mermaidEditor.connectionReady")}
      </div>
      <ReadonlyConnectionField label={t("mermaidEditor.from")} value={draft.from ?? ""} />
      <ReadonlyConnectionField label={t("mermaidEditor.to")} value={draft.to ?? ""} />
      <label className="mermaid-visual-field">
        <span>{t("mermaidEditor.label")}</span>
        <input
          disabled={!draft.from || !draft.to}
          onChange={(event) => onLabelChange(event.target.value)}
          value={draft.label}
        />
      </label>
      {draft.error ? <div className="mermaid-visual-form-error" role="alert">{draft.error}</div> : null}
      <div className="mermaid-visual-form-actions">
        <button className="secondary-button" disabled={!draft.from || !draft.to || nodes.length === 0} onClick={onSubmit} type="button">
          {t("mermaidEditor.add")}
        </button>
        <button className="secondary-button" onClick={onCancel} type="button">{t("mermaidEditor.cancel")}</button>
      </div>
    </div>
  );
}

function ConnectionInspector({
  connection,
  onDelete,
  onLabelChange,
  t
}: {
  connection: MermaidConnection;
  onDelete: () => void;
  onLabelChange: (label: string) => void;
  t: Translator;
}): ReactElement {
  return (
    <div className="mermaid-visual-form">
      <ReadonlyConnectionField label={t("mermaidEditor.from")} value={connection.from} />
      <ReadonlyConnectionField label={t("mermaidEditor.to")} value={connection.to} />
      <label className="mermaid-visual-field">
        <span>{t("mermaidEditor.label")}</span>
        <input onChange={(event) => onLabelChange(event.target.value)} value={connection.label ?? ""} />
      </label>
      <button className="secondary-button danger-button" onClick={onDelete} type="button">
        {t("mermaidEditor.deleteConnection")}
      </button>
    </div>
  );
}

function ReadonlyConnectionField({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <label className="mermaid-visual-field">
      <span>{label}</span>
      <input readOnly value={value} />
    </label>
  );
}

function wireMermaidPreviewSelection(
  container: HTMLElement,
  model: MermaidFlowchartModel,
  selection: MermaidSelection,
  connectionDraft: NewConnectionDraft | null,
  onNodeSelect: (id: string) => void,
  onConnectionSelect: (index: number) => void
): void {
  model.nodes.forEach((node, index) => {
    const element = findMermaidNodeElement(container, node, index);
    if (!element) return;

    element.classList.add("mermaid-editor-preview-selectable");
    if (selection?.type === "node" && selection.id === node.id) {
      element.classList.add("mermaid-editor-preview-selected");
    }
    if (connectionDraft?.from === node.id) {
      element.classList.add("mermaid-editor-preview-connection-start");
    }
    attachPreviewSelectionHandlers(element, () => onNodeSelect(node.id));
  });

  model.connections.forEach((connection, index) => {
    const element = findMermaidConnectionElement(container, connection, index);
    if (!element) return;

    element.classList.add("mermaid-editor-preview-selectable");
    if (selection?.type === "connection" && selection.index === index) {
      element.classList.add("mermaid-editor-preview-selected");
    }
    attachPreviewSelectionHandlers(element, () => onConnectionSelect(index));

    const labelElement = findMermaidConnectionLabelElement(container, index);
    if (labelElement) {
      labelElement.classList.add("mermaid-editor-preview-selectable");
      if (selection?.type === "connection" && selection.index === index) {
        labelElement.classList.add("mermaid-editor-preview-selected");
      }
      attachPreviewSelectionHandlers(labelElement, () => onConnectionSelect(index));
    }
  });
}

function attachPreviewSelectionHandlers(element: Element, select: () => void): void {
  element.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    select();
  });
  element.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent) || (event.key !== "Enter" && event.key !== " ")) return;

    event.preventDefault();
    event.stopPropagation();
    select();
  });
  element.setAttribute("tabindex", "0");
  element.setAttribute("role", "button");
}

function findMermaidNodeElement(container: HTMLElement, node: MermaidNode, index: number): Element | null {
  const nodeElements = Array.from(container.querySelectorAll("g.node, .node"));
  return nodeElements.find((element) => elementIdContainsToken(element.id, node.id)) ?? nodeElements[index] ?? null;
}

function findMermaidConnectionElement(
  container: HTMLElement,
  connection: MermaidConnection,
  index: number
): Element | null {
  const groupElements = Array.from(container.querySelectorAll("g.edgePath, .edgePath"));
  const edgeElements = groupElements.length > 0
    ? groupElements
    : Array.from(container.querySelectorAll("path.flowchart-link, .flowchart-link"));
  return edgeElements.find((element) => (
    elementIdContainsToken(element.id, connection.from) && elementIdContainsToken(element.id, connection.to)
  )) ?? edgeElements[index] ?? null;
}

function findMermaidConnectionLabelElement(container: HTMLElement, index: number): Element | null {
  return Array.from(container.querySelectorAll("g.edgeLabel, .edgeLabel"))[index] ?? null;
}

function elementIdContainsToken(id: string, token: string): boolean {
  if (id === token) return true;
  return new RegExp(`(^|[-_])${escapeRegExp(token)}($|[-_])`).test(id);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateNodeId(
  id: string,
  nodes: Pick<MermaidNode, "id">[],
  t: Translator,
  currentId?: string
): string | null {
  if (!isValidMermaidNodeId(id)) return t("mermaidEditor.invalidNodeId");
  if (nodes.some((node) => node.id === id && node.id !== currentId)) return t("mermaidEditor.duplicateNodeId");
  return null;
}

function normalizeConnection(connection: MermaidConnection): MermaidConnection {
  const label = connection.label?.trim();
  return label ? { from: connection.from, label, to: connection.to } : { from: connection.from, to: connection.to };
}

function hasSameConnection(connections: MermaidConnection[], nextConnection: MermaidConnection): boolean {
  return connections.some((connection) => mermaidConnectionKey(normalizeConnection(connection)) === mermaidConnectionKey(nextConnection));
}

function shapeLabel(shape: MermaidNodeShape, t: Translator): string {
  if (shape === "diamond") return t("mermaidEditor.shapeDiamond");
  if (shape === "circle") return t("mermaidEditor.shapeCircle");
  return t("mermaidEditor.shapeRectangle");
}
