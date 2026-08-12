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
import type { WorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

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
  const userDefinedFieldsRef = useRef<UserDefinedField[]>(defaultUserDefinedFields);
  const editorSaveGenerationRef = useRef(0);
  const userDefinedFieldsSaveGenerationRef = useRef(0);
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
        userDefinedFieldsRef.current = result.value;
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

  const handleSaveUserDefinedFields = useCallback((fields: UserDefinedField[]): void => {
    const previousFields = userDefinedFieldsRef.current;
    const generation = ++userDefinedFieldsSaveGenerationRef.current;
    userDefinedFieldsRef.current = fields;
    setUserDefinedFields(fields);
    void relicClient.current?.saveUserDefinedFields(fields).then((result) => {
      if (!result.ok && generation === userDefinedFieldsSaveGenerationRef.current) {
        userDefinedFieldsRef.current = previousFields;
        setUserDefinedFields(previousFields);
        setWorkspaceError(result.error.message);
      }
    }).catch(() => {
      if (generation !== userDefinedFieldsSaveGenerationRef.current) return;
      userDefinedFieldsRef.current = previousFields;
      setUserDefinedFields(previousFields);
      setWorkspaceError(t("errors.operationFailed"));
    });
  }, [setWorkspaceError, t]);

  return {
    appInfo,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    userDefinedFields
  };
}
