import { useState, type ReactElement } from "react";

import { CHRONICLE_FIXED_FIELDS, STANDARD_FIXED_FIELDS, type FixedFieldDefinition } from "../frontmatterSettingsModel";
import { useT } from "../i18n";

export function FrontmatterFixedFields(): ReactElement {
  const t = useT();
  const [chronicleExpanded, setChronicleExpanded] = useState(false);

  return (
    <>
      <div className="frontmatter-field-group-label">{t("settings.fixedFields")}</div>
      {STANDARD_FIXED_FIELDS.map((field) => <FixedFieldCard field={field} key={field.name} />)}
      <section className="frontmatter-field-collapse">
        <button
          aria-expanded={chronicleExpanded}
          className="frontmatter-field-collapse-summary"
          data-expanded={chronicleExpanded}
          onClick={() => setChronicleExpanded((expanded) => !expanded)}
          type="button"
        >
          <span className="frontmatter-field-collapse-name">{t("settings.fixedFieldChronicleGroup")}</span>
          <span className="frontmatter-field-type">{t("settings.fixedFieldChronicleCount")}</span>
        </button>
      </section>
      {chronicleExpanded ? CHRONICLE_FIXED_FIELDS.map((field) => <FixedFieldCard field={field} key={field.name} />) : null}
    </>
  );
}

function FixedFieldCard({ field }: { field: FixedFieldDefinition }): ReactElement {
  const t = useT();

  return (
    <section className="frontmatter-field-card frontmatter-field-card--fixed">
      <div className="frontmatter-field-summary frontmatter-field-summary--static">
        <span className="frontmatter-field-name">{field.name}</span>
        <span className="frontmatter-field-type">{t("settings.fixedField")}</span>
      </div>
      <div className="frontmatter-field-description">
        <p>{t(field.descriptionKey)}</p>
        <div className="frontmatter-field-examples" aria-label={t("settings.frontmatterExampleLabel")}>
          {field.examples.map((exampleKey) => (
            <code key={exampleKey}>{t(exampleKey)}</code>
          ))}
        </div>
      </div>
    </section>
  );
}
