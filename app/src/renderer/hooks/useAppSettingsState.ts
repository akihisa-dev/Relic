import { relicClient } from "../relicClient";
import { useCallback, useEffect, useState } from "react";

import type {
  AppInfo,
  EditorSettings,
  FrontmatterTemplate,
  WorkspaceState
} from "../../shared/ipc";
import {
  defaultFrontmatterTemplates,
  defaultUserDefinedFields,
  type UserDefinedField
} from "../../shared/ipc";

interface UseAppSettingsStateInput {
  setEditorSettings: (settings: EditorSettings) => void;
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
}

export function useAppSettingsState({
  setEditorSettings,
  setWorkspaceError,
  setWorkspaceState
}: UseAppSettingsStateInput) {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [frontmatterTemplates, setFrontmatterTemplates] = useState<FrontmatterTemplate[]>(defaultFrontmatterTemplates);
  const [userDefinedFields, setUserDefinedFields] = useState<UserDefinedField[]>(defaultUserDefinedFields);

  useEffect(() => {
    let canceled = false;

    void relicClient.current?.getAppInfo().then((result) => {
      if (canceled) return;
      if (result.ok) setAppInfo(result.value);
    });

    void relicClient.current?.getWorkspaceState().then((result) => {
      if (canceled) return;
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });

    void relicClient.current?.getEditorSettings().then((result) => {
      if (canceled) return;
      if (result.ok) setEditorSettings(result.value);
    });

    void relicClient.current?.getUserDefinedFields().then((result) => {
      if (canceled) return;
      if (result.ok) setUserDefinedFields(result.value);
    });

    void relicClient.current?.getFrontmatterTemplates().then((result) => {
      if (canceled) return;
      if (result.ok) setFrontmatterTemplates(result.value);
    });

    return () => { canceled = true; };
  }, [setEditorSettings, setWorkspaceError, setWorkspaceState]);

  const handleSaveSettings = useCallback(
    (settings: EditorSettings): void => {
      setEditorSettings(settings);
      void relicClient.current?.saveEditorSettings(settings).then((result) => {
        if (!result.ok) setWorkspaceError(result.error.message);
      });
    },
    [setEditorSettings, setWorkspaceError]
  );

  const handleSaveUserDefinedFields = useCallback((fields: UserDefinedField[]): void => {
    setUserDefinedFields(fields);
    void relicClient.current?.saveUserDefinedFields(fields).then((result) => {
      if (!result.ok) setWorkspaceError(result.error.message);
    });
  }, [setWorkspaceError]);

  const handleSaveFrontmatterTemplates = useCallback((templates: FrontmatterTemplate[]): void => {
    setFrontmatterTemplates(templates);
    void relicClient.current?.saveFrontmatterTemplates(templates).then((result) => {
      if (!result.ok) setWorkspaceError(result.error.message);
    });
  }, [setWorkspaceError]);

  return {
    appInfo,
    frontmatterTemplates,
    handleSaveFrontmatterTemplates,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    userDefinedFields
  };
}
