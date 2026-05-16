import type { ReactElement } from "react";

import { useT } from "../i18n";

interface FrontmatterChoiceEditorProps {
  choices: string[];
  input: string;
  onAddChoices: () => void;
  onInputChange: (value: string) => void;
  onRemoveChoice: (choice: string) => void;
}

export function FrontmatterChoiceEditor({
  choices,
  input,
  onAddChoices,
  onInputChange,
  onRemoveChoice
}: FrontmatterChoiceEditorProps): ReactElement {
  const t = useT();

  return (
    <div className="frontmatter-choice-editor">
      <div className="frontmatter-choice-list">
        {choices.map((choice) => (
          <span className="frontmatter-choice-pill" key={choice}>
            <span>{choice}</span>
            <button
              aria-label={t("settings.removeChoice", { choice })}
              onClick={() => onRemoveChoice(choice)}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="frontmatter-choice-add">
        <input
          className="setting-custom-field-input"
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            onAddChoices();
          }}
          placeholder={t("settings.choiceAddPlaceholder")}
          type="text"
          value={input}
        />
        <button className="setting-action-btn" disabled={!input.trim()} onClick={onAddChoices} type="button">
          {t("settings.choiceAdd")}
        </button>
      </div>
    </div>
  );
}
