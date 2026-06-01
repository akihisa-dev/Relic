import { useCallback, useEffect, useState } from "react";

import type {
  AISettingsState,
  AIProvider,
  AppUiSettings,
  AppInfo,
  EditorSettings,
  FrontmatterTemplate,
  OpenAIWorkspaceModel,
  WorkspaceState
} from "../../shared/ipc";
import type { Translator } from "../i18nModel";
import {
  defaultFeatureToggles,
  defaultAppUiSettings,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields,
  type FeatureToggles,
  type UserDefinedField
} from "../../shared/ipc";

interface UseAppSettingsStateInput {
  onAISettingsChanged?: () => void;
  setEditorSettings: (settings: EditorSettings) => void;
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
  t: Translator;
}

export function useAppSettingsState({
  onAISettingsChanged,
  setEditorSettings,
  setWorkspaceError,
  setWorkspaceState,
  t
}: UseAppSettingsStateInput) {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [aiSettings, setAISettings] = useState<AISettingsState | null>(null);
  const [aiSettingsStatus, setAISettingsStatus] = useState<string | null>(null);
  const [appUiSettings, setAppUiSettings] = useState<AppUiSettings>(defaultAppUiSettings);
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

    void window.relic?.getAppUiSettings().then((result) => {
      if (canceled) return;
      if (result.ok) setAppUiSettings(result.value);
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

  const handleSaveAppUiSettings = useCallback((settings: AppUiSettings): void => {
    setAppUiSettings(settings);
    void window.relic?.saveAppUiSettings(settings).then((result) => {
      if (!result.ok) {
        setWorkspaceError(result.error.message);
      }
    });
  }, [setWorkspaceError]);

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
        setAISettingsStatus(t("settings.openAIAPIKeySaved"));
        onAISettingsChanged?.();
      } else {
        setAISettingsStatus(result.error.message);
      }
    });
  }, [onAISettingsChanged, t]);

  const handleSaveAIModel = useCallback((model: OpenAIWorkspaceModel): void => {
    setAISettings((current) => current ? { ...current, model } : current);
    setAISettingsStatus(null);
    void window.relic?.saveAIModel({ model }).then((result) => {
      if (result.ok) {
        setAISettings(result.value);
        setAISettingsStatus(t("settings.openAIModelChanged", { model: result.value.model }));
        onAISettingsChanged?.();
      } else {
        setAISettingsStatus(result.error.message);
      }
    });
  }, [onAISettingsChanged, t]);

  const handleSaveAIProvider = useCallback((aiProvider: AIProvider): void => {
    setAISettings((current) => current ? { ...current, aiProvider } : current);
    setAISettingsStatus(null);
    void window.relic?.saveAIProvider({ aiProvider }).then((result) => {
      if (result.ok) {
        setAISettings(result.value);
        setAISettingsStatus(t("settings.aiProviderChanged", { provider: formatAIProviderLabel(result.value.aiProvider) }));
        onAISettingsChanged?.();
      } else {
        setAISettingsStatus(result.error.message);
      }
    });
  }, [onAISettingsChanged, t]);

  const handleDeleteOpenAIAPIKey = useCallback((): void => {
    setAISettingsStatus(null);
    void window.relic?.deleteOpenAIAPIKey().then((result) => {
      if (result.ok) {
        setAISettings(result.value);
        setAISettingsStatus(t("settings.openAIAPIKeyDeleted"));
        onAISettingsChanged?.();
      } else {
        setAISettingsStatus(result.error.message);
      }
    });
  }, [onAISettingsChanged, t]);

  const handleTestOpenAIAPIKey = useCallback((): void => {
    setAISettingsStatus(t("settings.openAIAPIKeyTesting"));
    void window.relic?.testOpenAIAPIKey().then((result) => {
      if (result.ok) {
        setAISettingsStatus(t("settings.openAIAPIKeyTested", { model: result.value.model }));
      } else {
        setAISettingsStatus(result.error.message);
      }
    });
  }, [t]);

  return {
    aiSettings,
    aiSettingsStatus,
    appInfo,
    appUiSettings,
    featureToggles,
    frontmatterTemplates,
    handleSaveFeatureToggles,
    handleSaveAppUiSettings,
    handleSaveFrontmatterTemplates,
    handleDeleteOpenAIAPIKey,
    handleSaveAIModel,
    handleSaveAIProvider,
    handleSaveOpenAIAPIKey,
    handleSaveSettings,
    handleTestOpenAIAPIKey,
    handleSaveUserDefinedFields,
    userDefinedFields
  };
}

function formatAIProviderLabel(provider: AIProvider): string {
  return provider === "codex-app-server" ? "Codex App Server" : "OpenAI API";
}
