import { useEffect, useState, type ReactElement } from "react";

import type { WorkspaceTableFilter, WorkspaceTableFilterOperator } from "../../shared/ipc";
import { useT } from "../i18n";

export function TableFilterPopover({
  availableProperties,
  filters,
  onChange
}: {
  availableProperties: string[];
  filters: WorkspaceTableFilter[];
  onChange: (filters: WorkspaceTableFilter[]) => void;
}): ReactElement {
  const t = useT();
  const [target, setTarget] = useState<WorkspaceTableFilter["target"]>("file");
  const [property, setProperty] = useState(availableProperties[0] ?? "");
  const [operator, setOperator] = useState<WorkspaceTableFilterOperator>("contains");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (property && availableProperties.includes(property)) return;
    setProperty(availableProperties[0] ?? "");
  }, [availableProperties, property]);

  const operators = operatorsFor(target);
  const effectiveOperator = operators.includes(operator) ? operator : operators[0];
  const needsValue = effectiveOperator === "contains" || effectiveOperator === "not-contains" || effectiveOperator === "equals";
  const canAdd = target !== "property" || property.length > 0;

  const add = (): void => {
    const trimmedValue = value.trim();
    if (!canAdd || (needsValue && !trimmedValue)) return;
    const next: WorkspaceTableFilter = target === "frontmatter"
      ? { operator: effectiveOperator, target }
      : target === "file"
        ? { operator: effectiveOperator, target, value: trimmedValue }
        : needsValue
          ? { operator: effectiveOperator, property, target, value: trimmedValue }
          : { operator: effectiveOperator, property, target };
    onChange([...filters, next]);
    setValue("");
  };

  return (
    <div className="table-filter-popover-content">
      <p>{t("table.filtersAll")}</p>
      {filters.length > 0 ? (
        <div className="table-filter-list">
          {filters.map((filter, index) => (
            <div className="table-filter-item" key={`${filter.target}-${filter.property ?? ""}-${filter.operator}-${index}`}>
              <span>{filterSummary(filter, t)}</span>
              <button
                aria-label={t("table.removeFilter", { name: filterSummary(filter, t) })}
                onClick={() => onChange(filters.filter((_, filterIndex) => filterIndex !== index))}
                type="button"
              >×</button>
            </div>
          ))}
        </div>
      ) : <p className="table-filter-empty">{t("table.noFilters")}</p>}

      <div className="table-filter-builder">
        <select
          aria-label={t("table.filterTarget")}
          onChange={(event) => {
            const nextTarget = event.target.value as WorkspaceTableFilter["target"];
            setTarget(nextTarget);
            setOperator(operatorsFor(nextTarget)[0]);
          }}
          value={target}
        >
          <option value="file">{t("table.filterFile")}</option>
          <option disabled={availableProperties.length === 0} value="property">{t("table.filterProperty")}</option>
          <option value="frontmatter">{t("table.filterYaml")}</option>
        </select>
        {target === "property" ? (
          <select aria-label={t("table.filterProperty")} onChange={(event) => setProperty(event.target.value)} value={property}>
            {availableProperties.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        ) : null}
        <select
          aria-label={t("table.filterOperator")}
          onChange={(event) => setOperator(event.target.value as WorkspaceTableFilterOperator)}
          value={effectiveOperator}
        >
          {operators.map((item) => <option key={item} value={item}>{operatorLabel(item, t)}</option>)}
        </select>
        {needsValue ? (
          <input
            aria-label={t("table.filterValue")}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t("table.filterValue")}
            value={value}
          />
        ) : null}
        <button disabled={!canAdd || (needsValue && !value.trim())} onClick={add} type="button">{t("table.addFilter")}</button>
      </div>

      {filters.length > 0 ? (
        <button className="table-filter-clear" onClick={() => onChange([])} type="button">{t("table.clearFilters")}</button>
      ) : null}
    </div>
  );
}

function operatorsFor(target: WorkspaceTableFilter["target"]): WorkspaceTableFilterOperator[] {
  if (target === "frontmatter") return ["invalid", "valid"];
  if (target === "file") return ["contains", "not-contains", "equals"];
  return ["contains", "not-contains", "equals", "exists", "missing", "empty"];
}

function operatorLabel(operator: WorkspaceTableFilterOperator, t: ReturnType<typeof useT>): string {
  const keys = {
    contains: "table.filterContains",
    empty: "table.filterEmpty",
    equals: "table.filterEquals",
    exists: "table.filterExists",
    invalid: "table.filterInvalid",
    missing: "table.filterMissing",
    "not-contains": "table.filterNotContains",
    valid: "table.filterValid"
  } as const;
  return t(keys[operator]);
}

function filterSummary(filter: WorkspaceTableFilter, t: ReturnType<typeof useT>): string {
  const target = filter.target === "file"
    ? t("table.filterFile")
    : filter.target === "frontmatter"
      ? t("table.filterYaml")
      : filter.property ?? t("table.filterProperty");
  const suffix = filter.value ? `: ${filter.value}` : "";
  return `${target} · ${operatorLabel(filter.operator, t)}${suffix}`;
}
