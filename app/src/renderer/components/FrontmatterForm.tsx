import * as yaml from "js-yaml";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { UserDefinedField } from "../../shared/ipc";
import { useT } from "../i18n";

interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

const BUILT_IN_FIELDS = ["tags", "aliases"] as const;
const SYSTEM_FIELDS = ["date", "status", "publish", "url", "author"] as const;
const KNOWN_FIELDS = new Set([...BUILT_IN_FIELDS, ...SYSTEM_FIELDS]);
const MAX_FRONTMATTER_FIELDS = 20;

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
  const t = useT();
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
              title={t("common.delete")}
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
  userDefinedFields?: UserDefinedField[];
  workspaceTags?: string[];
}

export function FrontmatterForm({
  candidates,
  content,
  onChange,
  userDefinedFields = [],
  workspaceTags = []
}: FrontmatterFormProps): ReactElement | null {
  const t = useT();
  const { data, body } = parseFrontmatter(content);
  const fieldCount = Object.keys(data).length;

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

  const userDefinedFieldNames = new Set(userDefinedFields.map((f) => f.name));
  const freeFields = Object.keys(data).filter(
    (k) => !KNOWN_FIELDS.has(k as typeof KNOWN_FIELDS extends Set<infer T> ? T : never) && !userDefinedFieldNames.has(k)
  );

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
        <span className="fm-toggle-label">{t("frontmatter.title")}</span>
        <span className="fm-toggle-arrow">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {isExpanded ? (
        <div className="fm-fields">
          {fieldCount > MAX_FRONTMATTER_FIELDS ? (
            <div className="fm-warning" role="alert">
              {t("frontmatter.fieldLimit", { count: fieldCount })}
            </div>
          ) : null}

          {/* tags */}
          <div className="fm-row">
            <label className="fm-label">tags</label>
            <PillInput
              candidates={[...workspaceTags, ...(candidates.tags ?? [])]}
              onChange={(v) => updateField("tags", v.length > 0 ? v : undefined)}
              placeholder={t("frontmatter.tagsPlaceholder")}
              values={tags}
            />
          </div>

          {/* aliases */}
          <div className="fm-row">
            <label className="fm-label">aliases</label>
            <PillInput
              onChange={(v) => updateField("aliases", v.length > 0 ? v : undefined)}
              placeholder={t("frontmatter.aliasesPlaceholder")}
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
              placeholder={t("frontmatter.statusPlaceholder")}
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
              placeholder={t("frontmatter.authorPlaceholder")}
              values={author}
            />
          </div>

          {/* user-defined fields */}
          {userDefinedFields.map((field) => {
            const val = data[field.name];
            const datalistId = `fm-udf-${field.name}`;

            if (field.type === "boolean") {
              return (
                <div className="fm-row" key={field.name}>
                  <label className="fm-label">{field.name}</label>
                  <input
                    checked={val === true}
                    className="fm-checkbox"
                    onChange={(e) => updateField(field.name, e.target.checked || undefined)}
                    type="checkbox"
                  />
                </div>
              );
            }

            if (field.type === "multi-select") {
              return (
                <div className="fm-row" key={field.name}>
                  <label className="fm-label">{field.name}</label>
                  <PillInput
                    candidates={field.choices ?? []}
                    onChange={(v) => updateField(field.name, v.length > 0 ? v : undefined)}
                    placeholder={field.name}
                    values={toStringArray(val)}
                  />
                </div>
              );
            }

            const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text";
            const strVal = val !== undefined ? String(val) : "";

            return (
              <div className="fm-row" key={field.name}>
                <label className="fm-label">{field.name}</label>
                {field.type === "select" ? (
                  <>
                    <input
                      className="fm-input"
                      list={datalistId}
                      onChange={(e) => updateField(field.name, e.target.value || undefined)}
                      placeholder={field.name}
                      type="text"
                      value={strVal}
                    />
                    <datalist id={datalistId}>
                      {(field.choices ?? []).map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </>
                ) : (
                  <input
                    className="fm-input"
                    onChange={(e) => updateField(field.name, e.target.value || undefined)}
                    type={inputType}
                    value={strVal}
                  />
                )}
              </div>
            );
          })}

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
