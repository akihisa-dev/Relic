import { useEffect, useState } from "react";

import type { UserDefinedField, UserDefinedFieldType } from "../../shared/ipc";
import {
  isFieldNameAvailable,
  needsChoices,
  nextExpandedFieldAfterDelete,
  parseChoiceInput,
  uniqueChoices
} from "../frontmatterSettingsModel";

export function useFrontmatterFieldsState({
  userDefinedFields,
  onUserDefinedFieldsSave
}: {
  userDefinedFields: UserDefinedField[];
  onUserDefinedFieldsSave: (fields: UserDefinedField[]) => void;
}) {
  const [fieldsDraft, setFieldsDraft] = useState<UserDefinedField[]>(userDefinedFields);
  const [expandedField, setExpandedField] = useState<string | null>(userDefinedFields[0]?.name ?? null);
  const [fieldNameDrafts, setFieldNameDrafts] = useState<string[]>(() => userDefinedFields.map((field) => field.name));
  const [choiceInputs, setChoiceInputs] = useState<Record<string, string>>({});
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<UserDefinedFieldType>("text");
  const [newChoiceInput, setNewChoiceInput] = useState("");
  const [newChoices, setNewChoices] = useState<string[]>([]);

  useEffect(() => {
    setFieldsDraft(userDefinedFields);
    setFieldNameDrafts(userDefinedFields.map((field) => field.name));
    setExpandedField((current) => current && userDefinedFields.some((field) => field.name === current)
      ? current
      : userDefinedFields[0]?.name ?? null);
  }, [userDefinedFields]);

  const saveFields = (fields: UserDefinedField[]): void => {
    setFieldsDraft(fields);
    onUserDefinedFieldsSave(fields);
  };

  const isNameAvailable = (name: string, currentIndex?: number): boolean => (
    isFieldNameAvailable(fieldsDraft, name, currentIndex)
  );

  const updateUserDefinedField = (index: number, nextField: UserDefinedField): void => {
    const previousName = fieldsDraft[index]?.name;
    saveFields(fieldsDraft.map((field, i) => (i === index ? nextField : field)));

    if (previousName && previousName !== nextField.name) {
      setExpandedField(nextField.name);
      setFieldNameDrafts((current) => current.map((name, i) => (i === index ? nextField.name : name)));
      setChoiceInputs((current) => {
        const next = { ...current, [nextField.name]: current[previousName] ?? "" };
        delete next[previousName];
        return next;
      });
    }
  };

  const addChoicesToField = (index: number, input: string): void => {
    const field = fieldsDraft[index];
    if (!field) return;

    const choices = parseChoiceInput(input);
    if (choices.length === 0) return;

    updateUserDefinedField(index, {
      ...field,
      choices: uniqueChoices([...(field.choices ?? []), ...choices])
    });
    setChoiceInputs((current) => ({ ...current, [field.name]: "" }));
  };

  const addNewChoices = (): void => {
    const choices = parseChoiceInput(newChoiceInput);
    if (choices.length === 0) return;

    setNewChoices((current) => uniqueChoices([...current, ...choices]));
    setNewChoiceInput("");
  };

  const commitFieldName = (index: number): void => {
    const field = fieldsDraft[index];
    if (!field) return;

    const name = (fieldNameDrafts[index] ?? field.name).trim();
    if (name === field.name || !isNameAvailable(name, index)) {
      setFieldNameDrafts((current) => current.map((item, i) => (i === index ? field.name : item)));
      return;
    }

    updateUserDefinedField(index, { ...field, name });
  };

  const setExistingFieldNameDraft = (index: number, name: string): void => {
    setFieldNameDrafts((current) => {
      const next = [...current];
      next[index] = name;
      return next;
    });
  };

  const resetExistingFieldNameDraft = (index: number, name: string): void => {
    setFieldNameDrafts((current) => current.map((currentName, i) => (i === index ? name : currentName)));
  };

  const setNewFieldTypeAndResetChoices = (type: UserDefinedFieldType): void => {
    setNewFieldType(type);
    if (!needsChoices(type)) {
      setNewChoices([]);
      setNewChoiceInput("");
    }
  };

  const addNewField = (): void => {
    const name = newFieldName.trim();
    if (!isNameAvailable(name)) return;

    const field: UserDefinedField = { name, type: newFieldType };
    if (needsChoices(newFieldType) && newChoices.length > 0) {
      field.choices = newChoices;
    }

    const next = [...fieldsDraft, field];
    saveFields(next);
    setExpandedField(name);
    setNewFieldName("");
    setNewFieldType("text");
    setNewChoiceInput("");
    setNewChoices([]);
  };

  const deleteField = (index: number): void => {
    const next = fieldsDraft.filter((_, j) => j !== index);
    saveFields(next);
    setExpandedField(nextExpandedFieldAfterDelete(next, index));
  };

  return {
    addChoicesToField,
    addNewChoices,
    addNewField,
    canAddNewField: isNameAvailable(newFieldName.trim()),
    choiceInputs,
    commitFieldName,
    deleteField,
    expandedField,
    fieldsDraft,
    fieldNameDrafts,
    isNameAvailable,
    newChoiceInput,
    newChoices,
    newFieldName,
    newFieldType,
    resetExistingFieldNameDraft,
    setChoiceInputs,
    setExistingFieldNameDraft,
    setExpandedField,
    setNewChoiceInput,
    setNewChoices,
    setNewFieldName,
    setNewFieldTypeAndResetChoices,
    updateUserDefinedField
  };
}
