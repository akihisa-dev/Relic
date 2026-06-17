import { useCallback, useEffect, useState } from "react";

import type {
  AppInfo,
  EditorSettings,
  FrontmatterTemplate,
  WorkspaceState
} from "../../shared/ipc";
import {
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields,
  type FeatureToggles,
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
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>(defaultFeatureToggles);
  const [frontmatterTemplates, setFrontmatterTemplates] = useState<FrontmatterTemplate[]>(defaultFrontmatterTemplates);
  const [userDefinedFields, setUserDefinedFields] = useState<UserDefinedField[]>(defaultUserDefinedFields);

  useEffect(() => {
    let canceled = false;

    void window.relic?.getAppInfo().then((result) => {
      if (canceled) return;
      if (result.ok) setAppInfo(result.value);
    });

    void window.relic?.getWorkspaceState().then((result) => {
      if (canceled) return;
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });

    void window.relic?.getEditorSettings().then((result) => {
      if (canceled) return;
      if (result.ok) setEditorSettings(result.value);
    });

    void window.relic?.getFeatureToggles().then((result) => {
      if (canceled) return;
      if (result.ok) setFeatureToggles(result.value);
    });

    void window.relic?.getUserDefinedFields().then((result) => {
      if (canceled) return;
      if (result.ok) setUserDefinedFields(result.value);
    });

    void window.relic?.getFrontmatterTemplates().then((result) => {
      if (canceled) return;
      if (result.ok) setFrontmatterTemplates(result.value);
    });

    return () => { canceled = true; };
  }, [setEditorSettings, setWorkspaceError, setWorkspaceState]);

  const handleSaveSettings = useCallback(
    (settings: EditorSettings): void => {
      setEditorSettings(settings);
      void window.relic?.saveEditorSettings(settings).then((result) => {
        if (!result.ok) setWorkspaceError(result.error.message);
      });
    },
    [setEditorSettings, setWorkspaceError]
  );

  const handleSaveFeatureToggles = useCallback((toggles: FeatureToggles): void => {
    setFeatureToggles(toggles);
    void window.relic?.saveFeatureToggles(toggles).then((result) => {
      if (!result.ok) setWorkspaceError(result.error.message);
    });
  }, [setWorkspaceError]);

  const handleSaveUserDefinedFields = useCallback((fields: UserDefinedField[]): void => {
    setUserDefinedFields(fields);
    void window.relic?.saveUserDefinedFields(fields).then((result) => {
      if (!result.ok) setWorkspaceError(result.error.message);
    });
  }, [setWorkspaceError]);

  const handleSaveFrontmatterTemplates = useCallback((templates: FrontmatterTemplate[]): void => {
    setFrontmatterTemplates(templates);
    void window.relic?.saveFrontmatterTemplates(templates).then((result) => {
      if (!result.ok) setWorkspaceError(result.error.message);
    });
  }, [setWorkspaceError]);

  return {
    appInfo,
    featureToggles,
    frontmatterTemplates,
    handleSaveFeatureToggles,
    handleSaveFrontmatterTemplates,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    userDefinedFields
  };
}
