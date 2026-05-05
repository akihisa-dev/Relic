import * as yaml from "js-yaml";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

const BUILT_IN_FIELDS = ["tags", "aliases"] as const;
const SYSTEM_FIELDS = ["date", "status", "publish", "url", "author"] as const;
const KNOWN_FIELDS = new Set([...BUILT_IN_FIELDS, ...SYSTEM_FIELDS]);

function parseFrontmatter(content: string): ParsedFrontmatter {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return { data: {}, body: content };
  }

  const rest = content.slice(4);
  const closeIndex = rest.search(/^---$/m);

  if (closeIndex === -1) return { data: {}, body: content };

  const yamlText = rest.slice(0, closeIndex);
  const body = rest.slice(closeIndex + 4);

  try {
    const parsed = yaml.load(yamlText);

    if (parsed === null || parsed === undefined) return { data: {}, body };
    if (typeof parsed !== "object" || Array.isArray(parsed)) return { data: {}, body: content };

    return { data: parsed as Record<string, unknown>, body };
  } catch {
    return { data: {}, body: content };
  }
}

function writeFrontmatter(body: string, data: Record<string, unknown>): string {
  if (Object.keys(data).length === 0) return body;

  const yamlText = yaml.dump(data, { lineWidth: -1 });

  return `---\n${yamlText}---\n${body}`;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value) return [value];

  return [];
}

interface PillInputProps {
  candidates?: string[];
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}

function PillInput({ candidates = [], placeholder, values, onChange }: PillInputProps): ReactElement {
  const [input, setInput] = useState("");
  const [showCandidates, setShowCandidates] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCandidates = candidates.filter(
    (c) => c.toLowerCase().includes(input.toLowerCase()) && !values.includes(c)
  );

  const addValue = useCallback(
    (val: string): void => {
      const trimmed = val.trim();

      if (trimmed && !values.includes(trimmed)) {
        onChange([...values, trimmed]);
      }

      setInput("");
      setShowCandidates(false);
    },
    [onChange, values]
  );

  const removeValue = useCallback(
    (index: number): void => {
      onChange(values.filter((_, i) => i !== index));
    },
    [onChange, values]
  );

  return (
    <div className="fm-pill-input">
      <div className="fm-pills">
        {values.map((v, i) => (
          <span className="fm-pill" key={i}>
            {v}
            <button
              className="fm-pill-remove"
              onClick={() => removeValue(i)}
              title="削除"
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        <div className="fm-pill-input-wrap">
          <input
            ref={inputRef}
            className="fm-pill-text"
            onBlur={() => setTimeout(() => setShowCandidates(false), 150)}
            onChange={(e) => {
              setInput(e.target.value);
              setShowCandidates(true);
            }}
            onFocus={() => setShowCandidates(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addValue(input);
              } else if (e.key === "Backspace" && !input && values.length > 0) {
                removeValue(values.length - 1);
              }
            }}
            placeholder={values.length === 0 ? placeholder : ""}
            type="text"
            value={input}
          />
          {showCandidates && filteredCandidates.length > 0 ? (
            <ul className="fm-candidates">
              {filteredCandidates.slice(0, 8).map((c) => (
                <li
                  className="fm-candidate-item"
                  key={c}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addValue(c);
                  }}
                >
                  {c}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface FrontmatterFormProps {
  candidates: Record<string, string[]>;
  content: string;
  onChange: (content: string) => void;
  workspaceTags?: string[];
}

export function FrontmatterForm({
  candidates,
  content,
  onChange,
  workspaceTags = []
}: FrontmatterFormProps): ReactElement | null {
  const { data, body } = parseFrontmatter(content);

  const updateField = useCallback(
    (key: string, value: unknown): void => {
      const nextData = { ...data };

      if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
        delete nextData[key];
      } else {
        nextData[key] = value;
      }

      onChange(writeFrontmatter(body, nextData));
    },
    [body, data, onChange]
  );

  const freeFields = Object.keys(data).filter((k) => !KNOWN_FIELDS.has(k as typeof KNOWN_FIELDS extends Set<infer T> ? T : never));

  const tags = toStringArray(data.tags);
  const aliases = toStringArray(data.aliases);
  const author = toStringArray(data.author);
  const dateVal = data.date !== undefined ? String(data.date) : "";
  const statusVal = data.status !== undefined ? String(data.status) : "";
  const publishVal = data.publish === true;
  const urlVal = data.url !== undefined ? String(data.url) : "";

  const hasAnyData = Object.keys(data).length > 0;
  const [isExpanded, setIsExpanded] = useState(hasAnyData);

  useEffect(() => {
    if (hasAnyData) setIsExpanded(true);
  }, [hasAnyData]);

  return (
    <div className="fm-container">
      <button
        className="fm-toggle"
        onClick={() => setIsExpanded((v) => !v)}
        type="button"
      >
        <span className="fm-toggle-label">フロントマター</span>
        <span className="fm-toggle-arrow">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {isExpanded ? (
        <div className="fm-fields">
          {/* tags */}
          <div className="fm-row">
            <label className="fm-label">tags</label>
            <PillInput
              candidates={[...workspaceTags, ...(candidates.tags ?? [])]}
              onChange={(v) => updateField("tags", v.length > 0 ? v : undefined)}
              placeholder="タグを入力..."
              values={tags}
            />
          </div>

          {/* aliases */}
          <div className="fm-row">
            <label className="fm-label">aliases</label>
            <PillInput
              onChange={(v) => updateField("aliases", v.length > 0 ? v : undefined)}
              placeholder="別名を入力..."
              values={aliases}
            />
          </div>

          {/* date */}
          <div className="fm-row">
            <label className="fm-label">date</label>
            <input
              className="fm-input"
              onChange={(e) => updateField("date", e.target.value || undefined)}
              type="date"
              value={dateVal}
            />
          </div>

          {/* status */}
          <div className="fm-row">
            <label className="fm-label">status</label>
            <input
              className="fm-input"
              list="fm-status-list"
              onChange={(e) => updateField("status", e.target.value || undefined)}
              placeholder="状態"
              type="text"
              value={statusVal}
            />
            <datalist id="fm-status-list">
              {(candidates.status ?? ["draft", "review", "published"]).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* publish */}
          <div className="fm-row">
            <label className="fm-label">publish</label>
            <input
              checked={publishVal}
              className="fm-checkbox"
              onChange={(e) => updateField("publish", e.target.checked || undefined)}
              type="checkbox"
            />
          </div>

          {/* url */}
          <div className="fm-row">
            <label className="fm-label">url</label>
            <input
              className="fm-input fm-input--url"
              onChange={(e) => updateField("url", e.target.value || undefined)}
              placeholder="https://..."
              type="url"
              value={urlVal}
            />
            {urlVal ? (
              <a className="fm-url-open" href={urlVal} rel="noreferrer" target="_blank">
                ↗
              </a>
            ) : null}
          </div>

          {/* author */}
          <div className="fm-row">
            <label className="fm-label">author</label>
            <PillInput
              candidates={candidates.author ?? []}
              onChange={(v) => updateField("author", v.length > 0 ? v : undefined)}
              placeholder="著者名を入力..."
              values={author}
            />
          </div>

          {/* free fields */}
          {freeFields.map((key) => (
            <div className="fm-row" key={key}>
              <label className="fm-label fm-label--free" title={key}>
                {key}
              </label>
              <input
                className="fm-input"
                onChange={(e) => updateField(key, e.target.value || undefined)}
                type="text"
                value={data[key] !== undefined ? String(data[key]) : ""}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
