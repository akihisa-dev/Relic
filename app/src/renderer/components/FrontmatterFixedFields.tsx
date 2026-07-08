import { useState, type ReactElement } from "react";

import { FIXED_FIELDS, type FixedFieldDefinition } from "../frontmatterSettingsModel";
import { useT } from "../i18n";

export function FrontmatterFixedFields(): ReactElement {
  const [expandedField, setExpandedField] = useState<string | null>(null);

  return (
    <>
      {FIXED_FIELDS.map((field) => (
        <FixedFieldCard
          expanded={expandedField === field.name}
          field={field}
          key={field.name}
          onToggle={() => setExpandedField((current) => current === field.name ? null : field.name)}
        />
      ))}
    </>
  );
}

function FixedFieldCard({
  expanded,
  field,
  onToggle
}: {
  expanded: boolean;
  field: FixedFieldDefinition;
  onToggle: () => void;
}): ReactElement {
  const t = useT();

  return (
    <section className="frontmatter-field-card frontmatter-field-card--fixed" data-expanded={expanded}>
      <button
        aria-expanded={expanded}
        className="frontmatter-field-summary"
        onClick={onToggle}
        type="button"
      >
        <span className="frontmatter-field-name">{field.name}</span>
        <span className="frontmatter-field-type">{t("settings.fixedField")}</span>
      </button>
      {expanded ? (
        <div className="frontmatter-field-description">
          <p>{t(field.descriptionKey)}</p>
          <div className="frontmatter-field-examples" aria-label={t("settings.frontmatterExampleLabel")}>
            {field.examples.map((exampleKey) => (
              <code key={exampleKey}>{t(exampleKey)}</code>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
