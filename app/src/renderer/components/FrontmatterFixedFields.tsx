import type { ReactElement } from "react";

import { FIXED_FIELDS } from "../frontmatterSettingsModel";
import { useT } from "../i18n";

export function FrontmatterFixedFields(): ReactElement {
  const t = useT();

  return (
    <>
      <div className="frontmatter-field-group-label">{t("settings.fixedFields")}</div>
      {FIXED_FIELDS.map((field) => (
        <section className="frontmatter-field-card frontmatter-field-card--fixed" key={field.name}>
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
      ))}
    </>
  );
}
