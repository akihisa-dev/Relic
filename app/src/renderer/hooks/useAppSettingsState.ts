import { useCallback, useEffect, useState } from "react";

import type {
  AppInfo,
  EditorSettings,
  FrontmatterTemplate,
  CardbookState
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
  setCardbookError: (message: string | null) => void;
  setCardbookState: (state: CardbookState) => void;
}

export function useAppSettingsState({
  setEditorSettings,
  setCardbookError,
  setCardbookState
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

    void window.relic?.getCardbookState().then((result) => {
      if (canceled) return;
      if (result.ok) {
        setCardbookState(result.value);
      } else {
        setCardbookError(result.error.message);
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
  }, [setEditorSettings, setCardbookError, setCardbookState]);

  const handleSaveSettings = useCallback(
    (settings: EditorSettings): void => {
      setEditorSettings(settings);
      void window.relic?.saveEditorSettings(settings);
    },
    [setEditorSettings]
  );

  const handleSaveFeatureToggles = useCallback((toggles: FeatureToggles): void => {
    setFeatureToggles(toggles);
    void window.relic?.saveFeatureToggles(toggles);
  }, []);

  const handleSaveUserDefinedFields = useCallback((fields: UserDefinedField[]): void => {
    setUserDefinedFields(fields);
    void window.relic?.saveUserDefinedFields(fields);
  }, []);

  const handleSaveFrontmatterTemplates = useCallback((templates: FrontmatterTemplate[]): void => {
    setFrontmatterTemplates(templates);
    void window.relic?.saveFrontmatterTemplates(templates);
  }, []);

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
