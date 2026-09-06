import { relicClient } from "../relicClient";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AppInfo,
  EditorSettings,
  WorkspaceState
} from "../../shared/ipc";
import {
  defaultEditorSettings,
  defaultUserDefinedFields,
  type UserDefinedField
} from "../../shared/ipc";
import { useT } from "../i18n";
import { useLatest } from "./useLatest";
import type { WorkspaceRequestGuard } from "../workspaceSession";

interface UseAppSettingsStateInput extends Pick<WorkspaceRequestGuard, "beginWorkspaceRequest"> {
  setEditorSettings: (settings: EditorSettings) => void;
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
}

export function useAppSettingsState({
  beginWorkspaceRequest,
  setEditorSettings,
  setWorkspaceError,
  setWorkspaceState
}: UseAppSettingsStateInput) {
  const t = useT();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [userDefinedFields, setUserDefinedFields] = useState<UserDefinedField[]>(defaultUserDefinedFields);
  const editorSettingsRef = useRef<EditorSettings>(defaultEditorSettings);
  const editorSaveGenerationRef = useRef(0);
  const beginWorkspaceRequestRef = useLatest(beginWorkspaceRequest);

  useEffect(() => {
    let canceled = false;
    const isCurrentWorkspace = beginWorkspaceRequestRef.current();

    void relicClient.current?.getAppInfo().then((result) => {
      if (canceled) return;
      if (result.ok) setAppInfo(result.value);
    }).catch(() => {
      if (!canceled) setWorkspaceError(t("errors.operationFailed"));
    });

    void relicClient.current?.getWorkspaceState().then((result) => {
      if (canceled || !isCurrentWorkspace()) return;
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    }).catch(() => {
      if (canceled || !isCurrentWorkspace()) return;
      setWorkspaceError(t("errors.operationFailed"));
    });

    void relicClient.current?.getEditorSettings().then((result) => {
      if (canceled) return;
      if (result.ok) {
        editorSettingsRef.current = result.value;
        setEditorSettings(result.value);
      }
    }).catch(() => {
      if (!canceled) setWorkspaceError(t("errors.operationFailed"));
    });

    void relicClient.current?.getUserDefinedFields().then((result) => {
      if (canceled) return;
      if (result.ok) {
        setUserDefinedFields(result.value);
      }
    }).catch(() => {
      if (!canceled) setWorkspaceError(t("errors.operationFailed"));
    });

    return () => { canceled = true; };
  }, [beginWorkspaceRequestRef, setEditorSettings, setWorkspaceError, setWorkspaceState, t]);

  const handleSaveSettings = useCallback(
    (settings: EditorSettings): void => {
      const previousSettings = editorSettingsRef.current;
      const generation = ++editorSaveGenerationRef.current;
      editorSettingsRef.current = settings;
      setEditorSettings(settings);
      void relicClient.current?.saveEditorSettings(settings).then((result) => {
        if (!result.ok && generation === editorSaveGenerationRef.current) {
          editorSettingsRef.current = previousSettings;
          setEditorSettings(previousSettings);
          setWorkspaceError(result.error.message);
        }
      }).catch(() => {
        if (generation !== editorSaveGenerationRef.current) return;
        editorSettingsRef.current = previousSettings;
        setEditorSettings(previousSettings);
        setWorkspaceError(t("errors.operationFailed"));
      });
    },
    [setEditorSettings, setWorkspaceError, t]
  );

  return {
    appInfo,
    handleSaveSettings,
    userDefinedFields
  };
}
