import * as yaml from "js-yaml";
import { useCallback, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { FrontmatterTemplate, UserDefinedField, UserDefinedFieldType } from "../../shared/ipc";
import { useT } from "../i18n";

interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

const BUILT_IN_FIELDS = ["tags", "aliases"] as const;
const SYSTEM_FIELDS = ["date", "status", "publish", "url", "author"] as const;
const KNOWN_FIELDS = new Set([...BUILT_IN_FIELDS, ...SYSTEM_FIELDS]);
const FIELD_NAME_PATTERN = /^[^\s:][^\r\n:]*$/;

function hasField(data: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, key);
}

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

function defaultValueForField(field: UserDefinedField | null): unknown {
  if (!field) return "";
  if (field.type === "boolean") return false;
  if (field.type === "multi-select" || field.type === "tags") return [];

  return "";
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
  frontmatterTemplates?: FrontmatterTemplate[];
  onChange: (content: string) => void;
  onUserDefinedFieldsChange?: (fields: UserDefinedField[]) => void;
  userDefinedFields?: UserDefinedField[];
  workspaceTags?: string[];
}

export function FrontmatterForm({
  candidates,
  content,
  frontmatterTemplates = [],
  onChange,
  onUserDefinedFieldsChange,
  userDefinedFields = [],
  workspaceTags = []
}: FrontmatterFormProps): ReactElement | null {
  const t = useT();
  const [newFieldName, setNewFieldName] = useState("");
  const [assigningKey, setAssigningKey] = useState<string | null>(null);
  const [assigningType, setAssigningType] = useState<UserDefinedFieldType>("text");
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

  const addField = useCallback(
    (key: string, field: UserDefinedField | null = null): void => {
      const name = key.trim();

      if (!FIELD_NAME_PATTERN.test(name) || hasField(data, name)) return;

      onChange(writeFrontmatter(body, { ...data, [name]: defaultValueForField(field) }));
      setNewFieldName("");
    },
    [body, data, onChange]
  );

  const removeField = useCallback(
    (key: string): void => {
      if (!hasField(data, key)) return;
      const nextData = { ...data };

      delete nextData[key];
      onChange(writeFrontmatter(body, nextData));
    },
    [body, data, onChange]
  );

  const userDefinedFieldNames = new Set(userDefinedFields.map((f) => f.name));

  const applyTemplate = useCallback(
    (template: FrontmatterTemplate): void => {
      const nextData = { ...data };

      for (const fieldName of template.fieldNames) {
        if (hasField(nextData, fieldName)) continue;
        const field = userDefinedFields.find((item) => item.name === fieldName) ?? null;
        nextData[fieldName] = defaultValueForField(field);
      }

      onChange(writeFrontmatter(body, nextData));
    },
    [body, data, onChange, userDefinedFields]
  );

  const assignFieldAbility = useCallback(
    (key: string, type: UserDefinedFieldType): void => {
      if (!onUserDefinedFieldsChange || userDefinedFieldNames.has(key)) return;
      onUserDefinedFieldsChange([...userDefinedFields, { name: key, type }]);
      setAssigningKey(null);
      setAssigningType("text");
    },
    [onUserDefinedFieldsChange, userDefinedFieldNames, userDefinedFields]
  );

  const freeFields = Object.keys(data).filter(
    (k) => !KNOWN_FIELDS.has(k as typeof KNOWN_FIELDS extends Set<infer T> ? T : never) && !userDefinedFieldNames.has(k)
  );
  const availableFields = userDefinedFields.filter((field) => !hasField(data, field.name));

  const tags = toStringArray(data.tags);
  const aliases = toStringArray(data.aliases);
  const author = toStringArray(data.author);
  const dateVal = data.date !== undefined ? String(data.date) : "";
  const statusVal = data.status !== undefined ? String(data.status) : "";
  const publishVal = data.publish === true;
  const urlVal = data.url !== undefined ? String(data.url) : "";

  return (
    <div className="fm-container">
      <div className="fm-summary">
        <span className="fm-summary-title">{t("frontmatter.title")}</span>
        {fieldCount > 0 ? <span className="fm-summary-count">{fieldCount}</span> : null}
      </div>

      <div className="fm-fields">
        {fieldCount === 0 ? (
          <div className="empty-note">{t("frontmatter.empty")}</div>
        ) : null}

        {availableFields.length > 0 ? (
          <div className="fm-add-list" aria-label={t("frontmatter.availableFields")}>
            {availableFields.map((field) => (
              <button
                className="fm-add-chip"
                key={field.name}
                onClick={() => addField(field.name, field)}
                type="button"
              >
                <span>{field.name}</span>
                <span className="fm-add-chip-type">{field.type}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="fm-add-manual">
          <input
            className="fm-input"
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder={t("frontmatter.addFieldPlaceholder")}
            type="text"
            value={newFieldName}
          />
          <button
            className="setting-action-btn"
            disabled={!FIELD_NAME_PATTERN.test(newFieldName.trim()) || hasField(data, newFieldName.trim())}
            onClick={() => addField(newFieldName)}
            type="button"
          >
            {t("frontmatter.addField")}
          </button>
        </div>

        {frontmatterTemplates.length > 0 ? (
          <div className="fm-template-list" aria-label={t("frontmatter.templates")}>
            {frontmatterTemplates.map((template) => {
              const canApply = template.fieldNames.some((fieldName) => !hasField(data, fieldName));

              return (
                <button
                  className="fm-add-chip"
                  disabled={!canApply}
                  key={template.name}
                  onClick={() => applyTemplate(template)}
                  type="button"
                >
                  <span>{template.name}</span>
                  <span className="fm-add-chip-type">{template.fieldNames.length}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* tags */}
        {hasField(data, "tags") ? (
          <div className="fm-row">
            <label className="fm-label">tags</label>
            <PillInput
              candidates={[...workspaceTags, ...(candidates.tags ?? [])]}
              onChange={(v) => updateField("tags", v.length > 0 ? v : undefined)}
              placeholder={t("frontmatter.tagsPlaceholder")}
              values={tags}
            />
            <button className="fm-remove-field" onClick={() => removeField("tags")} title={t("frontmatter.removeField")} type="button">×</button>
          </div>
        ) : null}

        {/* aliases */}
        {hasField(data, "aliases") ? (
          <div className="fm-row">
            <label className="fm-label">aliases</label>
            <PillInput
              onChange={(v) => updateField("aliases", v.length > 0 ? v : undefined)}
              placeholder={t("frontmatter.aliasesPlaceholder")}
              values={aliases}
            />
            <button className="fm-remove-field" onClick={() => removeField("aliases")} title={t("frontmatter.removeField")} type="button">×</button>
          </div>
        ) : null}

        {/* date */}
        {hasField(data, "date") ? (
          <div className="fm-row">
            <label className="fm-label">date</label>
            <input
              className="fm-input"
              onChange={(e) => updateField("date", e.target.value || undefined)}
              type="date"
              value={dateVal}
            />
            <button className="fm-remove-field" onClick={() => removeField("date")} title={t("frontmatter.removeField")} type="button">×</button>
          </div>
        ) : null}

        {/* status */}
        {hasField(data, "status") ? (
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
            <button className="fm-remove-field" onClick={() => removeField("status")} title={t("frontmatter.removeField")} type="button">×</button>
          </div>
        ) : null}

        {/* publish */}
        {hasField(data, "publish") ? (
          <div className="fm-row">
            <label className="fm-label">publish</label>
            <input
              checked={publishVal}
              className="fm-checkbox"
              onChange={(e) => updateField("publish", e.target.checked || undefined)}
              type="checkbox"
            />
            <button className="fm-remove-field" onClick={() => removeField("publish")} title={t("frontmatter.removeField")} type="button">×</button>
          </div>
        ) : null}

        {/* url */}
        {hasField(data, "url") ? (
          <div className="fm-row fm-row--url">
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
            <button className="fm-remove-field" onClick={() => removeField("url")} title={t("frontmatter.removeField")} type="button">×</button>
          </div>
        ) : null}

        {/* author */}
        {hasField(data, "author") ? (
          <div className="fm-row">
            <label className="fm-label">author</label>
            <PillInput
              candidates={candidates.author ?? []}
              onChange={(v) => updateField("author", v.length > 0 ? v : undefined)}
              placeholder={t("frontmatter.authorPlaceholder")}
              values={author}
            />
            <button className="fm-remove-field" onClick={() => removeField("author")} title={t("frontmatter.removeField")} type="button">×</button>
          </div>
        ) : null}

        {/* user-defined fields */}
        {userDefinedFields.filter((field) => hasField(data, field.name)).map((field) => {
          const val = data[field.name];
          const datalistId = `fm-udf-${encodeURIComponent(field.name)}`;

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
                <button className="fm-remove-field" onClick={() => removeField(field.name)} title={t("frontmatter.removeField")} type="button">×</button>
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
                <button className="fm-remove-field" onClick={() => removeField(field.name)} title={t("frontmatter.removeField")} type="button">×</button>
              </div>
            );
          }

          if (field.type === "tags") {
            return (
              <div className="fm-row" key={field.name}>
                <label className="fm-label">{field.name}</label>
                <PillInput
                  candidates={[...workspaceTags, ...(field.choices ?? [])]}
                  onChange={(v) => updateField(field.name, v.length > 0 ? v : undefined)}
                  placeholder={field.name}
                  values={toStringArray(val)}
                />
                <button className="fm-remove-field" onClick={() => removeField(field.name)} title={t("frontmatter.removeField")} type="button">×</button>
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
                  <button className="fm-remove-field" onClick={() => removeField(field.name)} title={t("frontmatter.removeField")} type="button">×</button>
                </>
              ) : (
                <>
                  <input
                    className="fm-input"
                    onChange={(e) => updateField(field.name, e.target.value || undefined)}
                    type={inputType}
                    value={strVal}
                  />
                  <button className="fm-remove-field" onClick={() => removeField(field.name)} title={t("frontmatter.removeField")} type="button">×</button>
                </>
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
            {assigningKey === key ? (
              <select
                aria-label={t("frontmatter.assignAbility")}
                className="fm-input"
                onChange={(e) => setAssigningType(e.target.value as UserDefinedFieldType)}
                value={assigningType}
              >
                {(["text", "number", "date", "boolean", "select", "multi-select", "tags", "url"] as UserDefinedFieldType[]).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            ) : (
              <input
                className="fm-input"
                onChange={(e) => updateField(key, e.target.value || undefined)}
                type="text"
                value={data[key] !== undefined ? String(data[key]) : ""}
              />
            )}
            <div className="fm-field-actions">
              {onUserDefinedFieldsChange ? (
                assigningKey === key ? (
                  <button className="fm-remove-field" onClick={() => assignFieldAbility(key, assigningType)} title={t("frontmatter.assignAbility")} type="button">✓</button>
                ) : (
                  <button className="fm-remove-field" onClick={() => setAssigningKey(key)} title={t("frontmatter.assignAbility")} type="button">＋</button>
                )
              ) : null}
              <button className="fm-remove-field" onClick={() => removeField(key)} title={t("frontmatter.removeField")} type="button">×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
