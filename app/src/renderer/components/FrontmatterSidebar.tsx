import type { ReactElement } from "react";

import type { UserDefinedField } from "../../shared/ipc";
import { useFrontmatterFieldsState } from "../hooks/useFrontmatterFieldsState";
import { useT } from "../i18n";
import { FrontmatterFieldAddForm } from "./FrontmatterFieldAddForm";
import { FrontmatterFieldList } from "./FrontmatterFieldList";
import { FrontmatterFixedFields } from "./FrontmatterFixedFields";

export function FrontmatterSidebar({
  userDefinedFields,
  onUserDefinedFieldsSave
}: {
  userDefinedFields: UserDefinedField[];
  onUserDefinedFieldsSave: (fields: UserDefinedField[]) => void;
}): ReactElement {
  const t = useT();
  const fieldsState = useFrontmatterFieldsState({ onUserDefinedFieldsSave, userDefinedFields });

  return (
    <div className="settings-page frontmatter-settings-section">
      <header className="settings-page-header">
        <p className="settings-page-kicker">{t("nav.frontmatter")}</p>
        <h2>{t("settings.frontmatterProperties")}</h2>
      </header>

      <section className="settings-group frontmatter-settings-group">
        <div className="frontmatter-format-guide">
          <p>{t("settings.frontmatterFormatGuide")}</p>
          <code>{t("settings.frontmatterFormatExample")}</code>
        </div>
      </section>

      <section className="settings-group frontmatter-settings-group">
        <FrontmatterFixedFields />
      </section>

      <section className="settings-group frontmatter-settings-group">
        <div className="frontmatter-field-group-label">{t("settings.freeFields")}</div>

        <FrontmatterFieldAddForm
          canAddNewField={fieldsState.canAddNewField}
          newChoiceInput={fieldsState.newChoiceInput}
          newChoices={fieldsState.newChoices}
          newFieldName={fieldsState.newFieldName}
          newFieldType={fieldsState.newFieldType}
          onAddNewChoices={fieldsState.addNewChoices}
          onAddNewField={fieldsState.addNewField}
          onNewChoiceInputChange={fieldsState.setNewChoiceInput}
          onNewChoicesChange={fieldsState.setNewChoices}
          onNewFieldNameChange={fieldsState.setNewFieldName}
          onNewFieldTypeChange={fieldsState.setNewFieldTypeAndResetChoices}
        />

        <FrontmatterFieldList
          addChoicesToField={fieldsState.addChoicesToField}
          choiceInputs={fieldsState.choiceInputs}
          commitFieldName={fieldsState.commitFieldName}
          deleteField={fieldsState.deleteField}
          expandedField={fieldsState.expandedField}
          fieldNameDrafts={fieldsState.fieldNameDrafts}
          fieldsDraft={fieldsState.fieldsDraft}
          onChoiceInputChange={(fieldName, value) => fieldsState.setChoiceInputs((current) => ({ ...current, [fieldName]: value }))}
          onExpandedFieldChange={fieldsState.setExpandedField}
          onFieldNameDraftChange={fieldsState.setExistingFieldNameDraft}
          onFieldNameDraftReset={fieldsState.resetExistingFieldNameDraft}
          updateUserDefinedField={fieldsState.updateUserDefinedField}
        />
      </section>
    </div>
  );
}
