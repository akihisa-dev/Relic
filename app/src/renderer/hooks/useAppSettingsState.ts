import { useCallback, useEffect, useState } from "react";

import type {
  AppInfo,
  AutoSyncSettings,
  EditorSettings,
  MarkdownTemplateSummary,
  WorkspaceState
} from "../../shared/ipc";
import {
  defaultAutoSyncSettings,
  defaultFeatureToggles,
  defaultUserDefinedFields,
  type FeatureToggles,
  type UserDefinedField
} from "../../shared/ipc";

interface UseAppSettingsStateInput {
  setEditorSettings: (settings: EditorSettings) => void;
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
  workspaceState: WorkspaceState | null;
}

export function useAppSettingsState({
  setEditorSettings,
  setWorkspaceError,
  setWorkspaceState,
  workspaceState
}: UseAppSettingsStateInput) {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [autoSyncSettings, setAutoSyncSettings] = useState<AutoSyncSettings>(defaultAutoSyncSettings);
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>(defaultFeatureToggles);
  const [userDefinedFields, setUserDefinedFields] = useState<UserDefinedField[]>(defaultUserDefinedFields);
  const [markdownTemplates, setMarkdownTemplates] = useState<MarkdownTemplateSummary[]>([]);
  const [selectedTemplatePath, setSelectedTemplatePath] = useState("");

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

    void window.relic?.getAutoSyncSettings().then((result) => {
      if (canceled) return;
      if (result.ok) setAutoSyncSettings(result.value);
    });

    void window.relic?.getFeatureToggles().then((result) => {
      if (canceled) return;
      if (result.ok) setFeatureToggles(result.value);
    });

    void window.relic?.getUserDefinedFields().then((result) => {
      if (canceled) return;
      if (result.ok) setUserDefinedFields(result.value);
    });

    return () => { canceled = true; };
  }, [setEditorSettings, setWorkspaceError, setWorkspaceState]);

  useEffect(() => {
    let canceled = false;

    void window.relic?.getAutoSyncSettings().then((result) => {
      if (canceled) return;
      if (result.ok) setAutoSyncSettings(result.value);
    });

    return () => { canceled = true; };
  }, [workspaceState?.activeWorkspace?.id]);

  useEffect(() => {
    let canceled = false;

    void window.relic?.getMarkdownTemplates().then((result) => {
      if (canceled) return;
      if (result.ok) {
        setMarkdownTemplates(result.value);
        if (!result.value.some((template) => template.path === selectedTemplatePath)) {
          setSelectedTemplatePath("");
        }
      }
    });

    return () => { canceled = true; };
  }, [selectedTemplatePath, workspaceState?.activeWorkspace?.id]);

  const handleSaveSettings = useCallback(
    (settings: EditorSettings): void => {
      setEditorSettings(settings);
      void window.relic?.saveEditorSettings(settings);
    },
    [setEditorSettings]
  );

  const handleSaveAutoSyncSettings = useCallback((settings: AutoSyncSettings): void => {
    setAutoSyncSettings(settings);
    void window.relic?.saveAutoSyncSettings(settings);
  }, []);

  const handleSaveFeatureToggles = useCallback((toggles: FeatureToggles): void => {
    setFeatureToggles(toggles);
    void window.relic?.saveFeatureToggles(toggles);
  }, []);

  const handleSaveUserDefinedFields = useCallback((fields: UserDefinedField[]): void => {
    setUserDefinedFields(fields);
    void window.relic?.saveUserDefinedFields(fields);
  }, []);

  return {
    appInfo,
    autoSyncSettings,
    featureToggles,
    handleSaveAutoSyncSettings,
    handleSaveFeatureToggles,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    markdownTemplates,
    selectedTemplatePath,
    setSelectedTemplatePath,
    userDefinedFields
  };
}
