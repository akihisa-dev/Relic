import { relicClient } from "../relicClient";
import { useCallback, useEffect, useState } from "react";

import type {
  AppInfo,
  EditorSettings,
  WorkspaceState
} from "../../shared/ipc";
import {
  defaultUserDefinedFields,
  type UserDefinedField
} from "../../shared/ipc";
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
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [userDefinedFields, setUserDefinedFields] = useState<UserDefinedField[]>(defaultUserDefinedFields);
  const beginWorkspaceRequestRef = useLatest(beginWorkspaceRequest);

  useEffect(() => {
    let canceled = false;
    const isCurrentWorkspace = beginWorkspaceRequestRef.current();

    void relicClient.current?.getAppInfo().then((result) => {
      if (canceled) return;
      if (result.ok) setAppInfo(result.value);
    });

    void relicClient.current?.getWorkspaceState().then((result) => {
      if (canceled || !isCurrentWorkspace()) return;
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

    return () => { canceled = true; };
  }, [beginWorkspaceRequestRef, setEditorSettings, setWorkspaceError, setWorkspaceState]);

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

  return {
    appInfo,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    userDefinedFields
  };
}
