import { useCallback, useEffect, useState } from "react";

import type {
  AISettingsState,
  AppInfo,
  EditorSettings,
  FrontmatterTemplate,
  OpenAIWorkspaceModel,
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
  const [aiSettings, setAISettings] = useState<AISettingsState | null>(null);
  const [aiSettingsStatus, setAISettingsStatus] = useState<string | null>(null);
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

    void window.relic?.getAISettings().then((result) => {
      if (canceled) return;
      if (result.ok) setAISettings(result.value);
    });

    return () => { canceled = true; };
  }, [setEditorSettings, setWorkspaceError, setWorkspaceState]);

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

  const handleSaveOpenAIAPIKey = useCallback((apiKey: string): void => {
    setAISettingsStatus(null);
    void window.relic?.saveOpenAIAPIKey({ apiKey }).then((result) => {
      if (result.ok) {
        setAISettings(result.value);
        setAISettingsStatus("OpenAI APIキーを保存しました。");
      } else {
        setAISettingsStatus(result.error.message);
      }
    });
  }, []);

  const handleSaveAIModel = useCallback((model: OpenAIWorkspaceModel): void => {
    setAISettings((current) => current ? { ...current, model } : current);
    setAISettingsStatus(null);
    void window.relic?.saveAIModel({ model }).then((result) => {
      if (result.ok) {
        setAISettings(result.value);
        setAISettingsStatus(`OpenAIモデルを${result.value.model}に変更しました。`);
      } else {
        setAISettingsStatus(result.error.message);
      }
    });
  }, []);

  const handleDeleteOpenAIAPIKey = useCallback((): void => {
    setAISettingsStatus(null);
    void window.relic?.deleteOpenAIAPIKey().then((result) => {
      if (result.ok) {
        setAISettings(result.value);
        setAISettingsStatus("OpenAI APIキーを削除しました。");
      } else {
        setAISettingsStatus(result.error.message);
      }
    });
  }, []);

  const handleTestOpenAIAPIKey = useCallback((): void => {
    setAISettingsStatus("OpenAI APIキーを確認しています。");
    void window.relic?.testOpenAIAPIKey().then((result) => {
      if (result.ok) {
        setAISettingsStatus(`OpenAI APIキーを確認できました。選択中モデル: ${result.value.model}`);
      } else {
        setAISettingsStatus(result.error.message);
      }
    });
  }, []);

  return {
    aiSettings,
    aiSettingsStatus,
    appInfo,
    featureToggles,
    frontmatterTemplates,
    handleSaveFeatureToggles,
    handleSaveFrontmatterTemplates,
    handleDeleteOpenAIAPIKey,
    handleSaveAIModel,
    handleSaveOpenAIAPIKey,
    handleSaveSettings,
    handleTestOpenAIAPIKey,
    handleSaveUserDefinedFields,
    userDefinedFields
  };
}
