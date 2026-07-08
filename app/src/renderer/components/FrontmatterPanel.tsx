import { useState, type ReactElement } from "react";

import type { FrontmatterCategoryChoice } from "../../shared/ipc";
import { FIXED_FIELDS, parseChoiceInput, uniqueChoices } from "../frontmatterSettingsModel";
import { useT } from "../i18n";
import { FrontmatterChoiceEditor } from "./FrontmatterChoiceEditor";
import { FrontmatterFixedFields } from "./FrontmatterFixedFields";

export function FrontmatterPanel({
  categoryChoices,
  onCategoryChoicesSave
}: {
  categoryChoices: FrontmatterCategoryChoice[];
  onCategoryChoicesSave: (choices: FrontmatterCategoryChoice[]) => void;
}): ReactElement {
  const t = useT();
  const [categoryChoiceInput, setCategoryChoiceInput] = useState("");
  const [referenceExpanded, setReferenceExpanded] = useState(false);
  const addCategoryChoices = (): void => {
    const choices = parseChoiceInput(categoryChoiceInput);
    if (choices.length === 0) return;

    onCategoryChoicesSave(uniqueChoices([...categoryChoices, ...choices]));
    setCategoryChoiceInput("");
  };

  return (
    <div className="settings-page frontmatter-settings-section">
      <header className="settings-page-header">
        <p className="settings-page-kicker">{t("nav.frontmatter")}</p>
        <h2>{t("settings.frontmatterProperties")}</h2>
        <p className="settings-page-description">{t("settings.frontmatterSettingsDescription")}</p>
      </header>

      <section className="settings-group frontmatter-settings-summary" aria-label={t("settings.frontmatterSummaryLabel")}>
        <div className="frontmatter-summary-item">
          <span>{t("settings.categoryChoices")}</span>
          <strong>{t("settings.frontmatterSummaryCount", { count: categoryChoices.length })}</strong>
        </div>
        <div className="frontmatter-summary-item">
          <span>{t("settings.fixedFields")}</span>
          <strong>{t("settings.frontmatterSummaryCount", { count: FIXED_FIELDS.length })}</strong>
        </div>
      </section>

      <section className="settings-group frontmatter-settings-group">
        <div className="frontmatter-section-heading">
          <div>
            <div className="frontmatter-field-group-label">{t("settings.fixedFields")}</div>
            <h3>{t("settings.fixedPropertiesTitle")}</h3>
          </div>
        </div>
        <p className="frontmatter-field-description-text">{t("settings.fixedPropertiesDescription")}</p>
        <FrontmatterFixedFields />
      </section>

      <section className="settings-group frontmatter-settings-group">
        <div className="frontmatter-section-heading">
          <div>
            <div className="frontmatter-field-group-label">{t("settings.categoryChoices")}</div>
            <h3>{t("settings.categoryChoicesTitle")}</h3>
          </div>
        </div>
        <p className="frontmatter-field-description-text">{t("settings.categoryChoicesDescription")}</p>
        <FrontmatterChoiceEditor
          choices={categoryChoices}
          input={categoryChoiceInput}
          onAddChoices={addCategoryChoices}
          onInputChange={setCategoryChoiceInput}
          onRemoveChoice={(choice) => onCategoryChoicesSave(categoryChoices.filter((item) => item !== choice))}
        />
      </section>

      <section className="settings-group frontmatter-settings-group frontmatter-reference-group">
        <button
          aria-expanded={referenceExpanded}
          className="frontmatter-reference-toggle"
          data-expanded={referenceExpanded}
          onClick={() => setReferenceExpanded((expanded) => !expanded)}
          type="button"
        >
          <span>{t("settings.frontmatterReferenceTitle")}</span>
          <span className="frontmatter-field-type">{t("settings.frontmatterReferenceBadge")}</span>
        </button>
        {referenceExpanded ? (
          <div className="frontmatter-reference-content">
            <div className="frontmatter-format-guide">
              <p>{t("settings.frontmatterFormatGuide")}</p>
              <code>{t("settings.frontmatterFormatExample")}</code>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
