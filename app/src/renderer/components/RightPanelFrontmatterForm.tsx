import * as yaml from "js-yaml";
import type { ChangeEvent, ReactElement } from "react";
import { useMemo, useState } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import {
  choicesFor,
  chronicleInputValue,
  dateInputValue,
  fieldFor,
  firstArrayValue,
  inputTypeFor,
  isChronicleField,
  isEditableScalar,
  isSingleValueField,
  parseChronicleYearInput,
  parseDateInputForFormat,
  parseScalarValue,
  scalarInputValue,
  fixedFrontmatterFieldNames,
  frontmatterFieldNamePattern
} from "../editorFrontmatterModel";
import { useT } from "../i18n";
import { parseFrontmatterContent, updateFrontmatterContent } from "../rightPanelFrontmatterModel";
import type { FileTab } from "../store/editorStore";

interface RightPanelFrontmatterFormProps {
  activeFileTab: FileTab | null;
  editorSettings: EditorSettings;
  frontmatterCandidates: Record<string, string[]>;
  onUpdateTabContent: (tabId: string, content: string) => void;
  userDefinedFields: UserDefinedField[];
}

export function RightPanelFrontmatterForm({
  activeFileTab,
  editorSettings,
  frontmatterCandidates,
  onUpdateTabContent,
  userDefinedFields
}: RightPanelFrontmatterFormProps): ReactElement {
  const t = useT();
  const [newFieldName, setNewFieldName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const parsed = useMemo(
    () => activeFileTab ? parseFrontmatterContent(activeFileTab.content) : null,
    [activeFileTab]
  );

  if (!activeFileTab) {
    return <div className="empty-note">{t("frontmatter.rightPanelNoFile")}</div>;
  }

  if (!parsed || parsed.error) {
    return <div className="empty-note">{t("frontmatter.rightPanelInvalid")}</div>;
  }

  const commitData = (nextData: Record<string, unknown>): void => {
    const nextContent = updateFrontmatterContent(activeFileTab.content, nextData, userDefinedFields);
    if (nextContent === null) return;
    onUpdateTabContent(activeFileTab.id, nextContent);
  };

  const updateField = (key: string, value: unknown): void => {
    const nextData = { ...parsed.data };
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
      delete nextData[key];
    } else {
      nextData[key] = value;
    }
    commitData(nextData);
  };

  const fieldNames = Object.keys(parsed.data);
  const availableFields = [...fixedFrontmatterFieldNames, ...userDefinedFields.map((field) => field.name)].reduce<string[]>((fields, name) => {
    if (fields.includes(name) || Object.prototype.hasOwnProperty.call(parsed.data, name)) return fields;
    fields.push(name);
    return fields;
  }, []);

  const addField = (): void => {
    const key = newFieldName.trim();
    if (!key) return;
    if (!frontmatterFieldNamePattern.test(key)) {
      setAddError(t("frontmatter.invalidPropertyName"));
      return;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, key)) {
      setAddError(t("frontmatter.duplicateProperty"));
      return;
    }
    setAddError(null);
    setNewFieldName("");
    commitData({ ...parsed.data, [key]: null });
  };

  return (
    <div className="right-frontmatter-panel">
      <div className="right-frontmatter-file" title={activeFileTab.path}>{activeFileTab.name}</div>
      {fieldNames.length > 0 ? (
        <div className="right-frontmatter-fields">
          {fieldNames.map((key) => (
            <RightPanelFrontmatterRow
              candidates={frontmatterCandidates}
              dateFormat={editorSettings.frontmatterDateFormat}
              key={key}
              name={key}
              userDefinedFields={userDefinedFields}
              value={parsed.data[key]}
              onUpdateField={updateField}
            />
          ))}
        </div>
      ) : (
        <div className="empty-note">{t("frontmatter.empty")}</div>
      )}
      <div className="right-frontmatter-add">
        <input
          aria-label={t("frontmatter.propertyName")}
          className="right-frontmatter-add-input"
          list="right-frontmatter-available-fields"
          onChange={(event) => {
            setAddError(null);
            setNewFieldName(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") addField();
          }}
          placeholder={t("frontmatter.propertyName")}
          type="text"
          value={newFieldName}
        />
        <datalist id="right-frontmatter-available-fields">
          {availableFields.map((name) => <option key={name} label={name} value={name}>{name}</option>)}
        </datalist>
        <button className="secondary-button" onClick={addField} type="button">
          {t("frontmatter.addProperty")}
        </button>
        {addError ? <div className="cm-frontmatter-input-error">{addError}</div> : null}
      </div>
    </div>
  );
}

function RightPanelFrontmatterRow({
  candidates,
  dateFormat,
  name,
  onUpdateField,
  userDefinedFields,
  value
}: {
  candidates: Record<string, string[]>;
  dateFormat: EditorSettings["frontmatterDateFormat"];
  name: string;
  onUpdateField: (key: string, value: unknown) => void;
  userDefinedFields: UserDefinedField[];
  value: unknown;
}): ReactElement {
  const t = useT();
  const field = fieldFor(name, userDefinedFields);

  return (
    <div className="right-frontmatter-row">
      <span className="right-frontmatter-key" title={name}>{name}</span>
      <div className="right-frontmatter-control">
        <FrontmatterValueControl
          candidates={candidates}
          dateFormat={dateFormat}
          field={field}
          name={name}
          value={value}
          onUpdateField={onUpdateField}
        />
      </div>
      <button
        aria-label={`${name} ${t("frontmatter.removeProperty")}`}
        className="cm-frontmatter-remove"
        onClick={() => onUpdateField(name, undefined)}
        title={t("frontmatter.removeProperty")}
        type="button"
      >
        ×
      </button>
    </div>
  );
}

function FrontmatterValueControl({
  candidates,
  dateFormat,
  field,
  name,
  onUpdateField,
  value
}: {
  candidates: Record<string, string[]>;
  dateFormat: EditorSettings["frontmatterDateFormat"];
  field?: UserDefinedField;
  name: string;
  onUpdateField: (key: string, value: unknown) => void;
  value: unknown;
}): ReactElement {
  if (isChronicleField(name)) {
    return <ChronicleControl name={name} value={Array.isArray(value) ? value : []} onUpdateField={onUpdateField} />;
  }
  if (field?.type === "boolean") {
    const checkedValue = firstArrayValue(value);
    return (
      <label className="cm-frontmatter-boolean">
        <input
          checked={checkedValue === true || String(checkedValue).toLowerCase() === "true"}
          className="cm-frontmatter-checkbox"
          onChange={(event) => onUpdateField(name, [event.target.checked])}
          type="checkbox"
        />
        <span>{checkedValue === true || String(checkedValue).toLowerCase() === "true" ? "true" : "false"}</span>
      </label>
    );
  }
  if (isSingleValueField(field)) {
    return <ScalarControl candidates={candidates} dateFormat={dateFormat} field={field} name={name} value={firstArrayValue(value)} writeAsArray onUpdateField={onUpdateField} />;
  }
  if (!field && Array.isArray(value)) {
    return <ScalarControl candidates={{}} dateFormat={dateFormat} field={undefined} name={name} value={firstArrayValue(value)} writeAsArray onUpdateField={onUpdateField} />;
  }
  if (field?.type === "multi-select" || name === "aliases" || name === "tags" || Array.isArray(value)) {
    return <ArrayControl name={name} value={Array.isArray(value) ? value : value == null ? [] : [value]} onUpdateField={onUpdateField} />;
  }
  if (isEditableScalar(value)) {
    return <ScalarControl candidates={candidates} dateFormat={dateFormat} field={field} name={name} value={value} onUpdateField={onUpdateField} />;
  }
  return <ComplexControl name={name} value={value} onUpdateField={onUpdateField} />;
}

function ScalarControl({
  candidates,
  dateFormat,
  field,
  name,
  onUpdateField,
  value,
  writeAsArray = false
}: {
  candidates: Record<string, string[]>;
  dateFormat: EditorSettings["frontmatterDateFormat"];
  field?: UserDefinedField;
  name: string;
  onUpdateField: (key: string, value: unknown) => void;
  value: unknown;
  writeAsArray?: boolean;
}): ReactElement {
  const t = useT();
  const [invalid, setInvalid] = useState(false);
  const inputValue = field?.type === "date"
    ? dateInputValue(value)
    : scalarInputValue(value, field);

  if (field?.type === "select") {
    const choices = choicesFor(name, field, candidates);
    const options = inputValue && !choices.includes(inputValue) ? [inputValue, ...choices] : choices;
    return (
      <select
        aria-label={name}
        className="cm-frontmatter-input"
        onChange={(event) => {
          const nextValue = parseScalarValue(event.target.value, field);
          onUpdateField(name, writeAsArray && nextValue !== undefined ? [nextValue] : nextValue);
        }}
        value={inputValue}
      >
        {!inputValue ? <option value="">{t("frontmatter.empty")}</option> : null}
        {options.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
      </select>
    );
  }

  const listId = field && choicesFor(name, field, candidates).length > 0 ? `right-frontmatter-${safeId(name)}` : undefined;
  return (
    <>
      <input
        aria-label={name}
        aria-invalid={invalid ? "true" : undefined}
        className="cm-frontmatter-input"
        defaultValue={inputValue}
        key={inputValue}
        list={listId}
        onBlur={(event) => {
          if (field?.type === "date") {
            const nextValue = parseDateTextValue(event.target.value, dateFormat);
            setInvalid(nextValue === null);
            if (nextValue === null) return;
            onUpdateField(name, writeAsArray && nextValue !== undefined ? [nextValue] : nextValue);
            return;
          }

          const nextValue = parseScalarValue(event.target.value, field);
          onUpdateField(name, writeAsArray && nextValue !== undefined ? [nextValue] : nextValue);
        }}
        type={inputTypeFor(field)}
      />
      {listId ? (
        <datalist id={listId}>
          {choicesFor(name, field, candidates).map((choice) => <option key={choice} label={choice} value={choice}>{choice}</option>)}
        </datalist>
      ) : null}
    </>
  );
}

function ChronicleControl({
  name,
  onUpdateField,
  value
}: {
  name: string;
  onUpdateField: (key: string, value: unknown) => void;
  value: unknown[];
}): ReactElement {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const startValue = chronicleInputValue(value[0]);
  const endValue = value.length > 1 ? chronicleInputValue(value[1]) : "";

  const commit = (startRaw: string, endRaw: string): void => {
    const allowZeroOrNegative = name !== "chronicle0";
    const startYear = parseChronicleYearInput(startRaw.trim(), allowZeroOrNegative);
    const endYear = parseChronicleYearInput(endRaw.trim(), allowZeroOrNegative);
    if (!startRaw.trim() && !endRaw.trim()) {
      setError(null);
      onUpdateField(name, undefined);
      return;
    }
    if (!startRaw.trim()) {
      setError(t("frontmatter.chronicleStartRequired"));
      return;
    }
    if (startYear === null || (endRaw.trim() && endYear === null)) {
      setError(t(allowZeroOrNegative ? "frontmatter.invalidSubChronicleYear" : "frontmatter.invalidChronicleYear"));
      return;
    }
    if (endYear !== null && startYear > endYear) {
      setError(t("frontmatter.invalidChronicleRange"));
      return;
    }
    setError(null);
    onUpdateField(name, endYear === null || endYear === startYear ? [startYear] : [startYear, endYear]);
  };

  return (
    <span className="cm-frontmatter-input-wrap cm-frontmatter-chronicle">
      <input aria-label={`${name} ${t("frontmatter.rangeStart")}`} className="cm-frontmatter-input" defaultValue={startValue} inputMode="numeric" onBlur={(event) => commit(event.target.value, event.currentTarget.parentElement?.querySelectorAll("input")[1]?.value ?? "")} placeholder={t("frontmatter.rangeStart")} type="text" />
      <input aria-label={`${name} ${t("frontmatter.rangeEnd")}`} className="cm-frontmatter-input" defaultValue={endValue} inputMode="numeric" onBlur={(event) => commit(event.currentTarget.parentElement?.querySelectorAll("input")[0]?.value ?? "", event.target.value)} placeholder={t("frontmatter.rangeEnd")} type="text" />
      {error ? <span className="cm-frontmatter-input-error">{error}</span> : null}
    </span>
  );
}

function ArrayControl({
  name,
  onUpdateField,
  value
}: {
  name: string;
  onUpdateField: (key: string, value: unknown) => void;
  value: unknown[];
}): ReactElement {
  const t = useT();
  const [draftValue, setDraftValue] = useState("");
  const nextItems = (index: number, nextValue: string): string[] => {
    const items = value.map(String);
    if (!nextValue.trim()) {
      items.splice(index, 1);
      return items;
    }
    items[index] = nextValue.trim();
    return items;
  };

  return (
    <div className="cm-frontmatter-pills">
      {value.map((item, index) => (
        <span className="cm-frontmatter-pill" key={arrayItemKey(value, index)}>
          <input
            aria-label={`${name} ${t("frontmatter.value")}`}
            className="cm-frontmatter-pill-value"
            defaultValue={String(item)}
            onBlur={(event) => onUpdateField(name, nextItems(index, event.target.value))}
            type="text"
          />
          <button
            aria-label={`${name} ${t("frontmatter.removeValue")}`}
            className="cm-frontmatter-pill-remove"
            onClick={() => onUpdateField(name, value.flatMap((entry, entryIndex) => entryIndex === index ? [] : [String(entry)]))}
            title={t("frontmatter.removeValue")}
            type="button"
          >
            ×
          </button>
        </span>
      ))}
      <input
        aria-label={`${name} ${t("frontmatter.value")}`}
        className="cm-frontmatter-pill-input"
        onChange={(event) => setDraftValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          const nextValue = draftValue.trim();
          if (!nextValue) return;
          onUpdateField(name, [...value.map(String), nextValue]);
          setDraftValue("");
        }}
        placeholder={t("frontmatter.value")}
        type="text"
        value={draftValue}
      />
      <button
        aria-label={`${name} ${t("frontmatter.addValue")}`}
        className="cm-frontmatter-pill-add"
        onClick={() => {
          const nextValue = draftValue.trim();
          if (!nextValue) return;
          onUpdateField(name, [...value.map(String), nextValue]);
          setDraftValue("");
        }}
        title={t("frontmatter.addValue")}
        type="button"
      >
        +
      </button>
    </div>
  );
}

function ComplexControl({
  name,
  onUpdateField,
  value
}: {
  name: string;
  onUpdateField: (key: string, value: unknown) => void;
  value: unknown;
}): ReactElement {
  const [invalid, setInvalid] = useState(false);

  return (
    <textarea
      aria-label={name}
      aria-invalid={invalid ? "true" : undefined}
      className="cm-frontmatter-yaml-input"
      defaultValue={yaml.dump(value, { lineWidth: -1 }).trimEnd()}
      onBlur={(event: ChangeEvent<HTMLTextAreaElement>) => {
        try {
          setInvalid(false);
          onUpdateField(name, yaml.load(event.target.value));
        } catch {
          setInvalid(true);
        }
      }}
      rows={3}
      spellCheck={false}
    />
  );
}

function parseDateTextValue(value: string, dateFormat: EditorSettings["frontmatterDateFormat"]): string | null | undefined {
  const rawValue = value.trim();
  if (rawValue === "") return undefined;
  return parseDateInputForFormat(rawValue, dateFormat);
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function arrayItemKey(value: unknown[], targetIndex: number): string {
  const target = String(value[targetIndex]);
  const occurrence = value.slice(0, targetIndex + 1).filter((item) => String(item) === target).length;
  return `${target}-${occurrence}`;
}
