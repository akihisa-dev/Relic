import { useState, type ReactElement } from "react";

import type { FrontmatterCategoryChoice } from "../../shared/ipc";
import { FIXED_FIELDS, parseChoiceInput, uniqueChoices } from "../frontmatterSettingsModel";
import { useT } from "../i18n";
import { FrontmatterChoiceEditor } from "./FrontmatterChoiceEditor";

export function TablePropertyPopover({
  categoryChoices,
  onCategoryChoicesSave,
  property
}: {
  categoryChoices: FrontmatterCategoryChoice[];
  onCategoryChoicesSave: (choices: FrontmatterCategoryChoice[]) => void;
  property: string;
}): ReactElement | null {
  const t = useT();
  const [categoryChoiceInput, setCategoryChoiceInput] = useState("");
  const [referenceExpanded, setReferenceExpanded] = useState(false);
  const definition = FIXED_FIELDS.find((field) => field.name === property);

  if (!definition) return null;

  const addCategoryChoices = (): void => {
    const choices = parseChoiceInput(categoryChoiceInput);
    if (choices.length === 0) return;
    onCategoryChoicesSave(uniqueChoices([...categoryChoices, ...choices]));
    setCategoryChoiceInput("");
  };

  return (
    <div className="table-property-popover-content">
      <div className="table-property-popover-heading">
        <strong>{property}</strong>
        <span className="frontmatter-field-type">{t("settings.fixedField")}</span>
      </div>
      <p>{t(definition.descriptionKey)}</p>

      {property === "category" ? (
        <section className="table-property-category">
          <div className="frontmatter-field-group-label">{t("settings.categoryChoices")}</div>
          <FrontmatterChoiceEditor
            choices={categoryChoices}
            input={categoryChoiceInput}
            onAddChoices={addCategoryChoices}
            onInputChange={setCategoryChoiceInput}
            onRemoveChoice={(choice) => onCategoryChoicesSave(categoryChoices.filter((item) => item !== choice))}
          />
        </section>
      ) : null}

      <button
        aria-expanded={referenceExpanded}
        className="table-property-reference-toggle"
        onClick={() => setReferenceExpanded((expanded) => !expanded)}
        type="button"
      >
        <span>{t("settings.frontmatterReferenceTitle")}</span>
        <span aria-hidden="true">{referenceExpanded ? "−" : "+"}</span>
      </button>
      {referenceExpanded ? (
        <div className="table-property-reference">
          <p>{t("settings.frontmatterFormatGuide")}</p>
          <div aria-label={t("settings.frontmatterExampleLabel")} className="frontmatter-field-examples">
            {definition.examples.map((exampleKey) => <code key={exampleKey}>{t(exampleKey)}</code>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
