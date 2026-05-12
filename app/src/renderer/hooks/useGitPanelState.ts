import { useCallback, useEffect, useState } from "react";

import type {
  GitCommitDiff,
  GitCommitSummary,
  GitConflict,
  GitHubAuthStatus,
  GitHubIntegrationSettings,
  GitRemoteSummary,
  GitStatus,
  GitSyncPreview,
  GitWorkingChange,
  WorkspaceState
} from "../../shared/ipc";

type GitSyncStep = "push-preview" | "pull-preview" | "pull-fetching" | null;

interface UseGitPanelStateInput {
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
  gitHubIntegrationSettings: GitHubIntegrationSettings;
  t: (key: "git.remoteConnected") => string;
  workspaceState: WorkspaceState | null;
}

export function useGitPanelState({
  setWorkspaceError,
  setWorkspaceState,
  gitHubIntegrationSettings,
  t,
  workspaceState
}: UseGitPanelStateInput) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitHubAuthStatus, setGitHubAuthStatus] = useState<GitHubAuthStatus | null>(null);
  const [gitRemotes, setGitRemotes] = useState<GitRemoteSummary[]>([]);
  const [gitCommitHistory, setGitCommitHistory] = useState<GitCommitSummary[]>([]);
  const [gitWorkingChanges, setGitWorkingChanges] = useState<GitWorkingChange[]>([]);
  const [selectedGitCommitHash, setSelectedGitCommitHash] = useState<string | null>(null);
  const [selectedGitCommitDiff, setSelectedGitCommitDiff] = useState<GitCommitDiff | null>(null);
  const [gitRemoteUrl, setGitRemoteUrl] = useState("");
  const [gitSyncMessage, setGitSyncMessage] = useState<string | null>(null);
  const [gitErrorMessage, setGitErrorMessage] = useState<string | null>(null);
  const [gitRetryAction, setGitRetryAction] = useState<(() => void) | null>(null);
  const [gitCommitMessage, setGitCommitMessage] = useState("");
  const [isCreatingGitCommit, setIsCreatingGitCommit] = useState(false);
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false);
  const [isConnectingGitRemote, setIsConnectingGitRemote] = useState(false);
  const [isDisconnectingGitHub, setIsDisconnectingGitHub] = useState(false);
  const [isPullingGitBranch, setIsPullingGitBranch] = useState(false);
  const [isPushingGitBranch, setIsPushingGitBranch] = useState(false);
  const [gitCloneUrl, setGitCloneUrl] = useState("");
  const [isCloningGitHub, setIsCloningGitHub] = useState(false);
  const [gitSyncPreview, setGitSyncPreview] = useState<GitSyncPreview | null>(null);
  const [gitSyncStep, setGitSyncStep] = useState<GitSyncStep>(null);
  const [gitConflicts, setGitConflicts] = useState<GitConflict[]>([]);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);

  const refreshGitWorkingChanges = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.getGitWorkingChanges().then((result) => {
      if (result.ok) {
        setGitWorkingChanges(result.value);
      } else {
        setGitWorkingChanges([]);
        setWorkspaceError(result.error.message);
      }
    });
  }, [setWorkspaceError]);

  const refreshGitCommitHistory = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.getGitCommitHistory().then((result) => {
      if (result.ok) {
        setGitCommitHistory(result.value);
        setSelectedGitCommitHash((current) => {
          if (result.value.length === 0) {
            return null;
          }

          return current && result.value.some((commit) => commit.hash === current)
            ? current
            : result.value[0].hash;
        });
      } else {
        setGitCommitHistory([]);
        setWorkspaceError(result.error.message);
      }
    });
  }, [setWorkspaceError]);

  const clearGitMessages = useCallback((): void => {
    setGitSyncMessage(null);
    setGitErrorMessage(null);
    setGitRetryAction(null);
  }, []);

  useEffect(() => {
    let canceled = false;

    void window.relic?.getGitHubAuthStatus().then((result) => {
      if (canceled) return;
      if (result.ok) setGitHubAuthStatus(result.value);
    });

    return () => { canceled = true; };
  }, []);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setGitStatus(null);
      setGitCommitHistory([]);
      setGitWorkingChanges([]);
      return;
    }

    let canceled = false;

    void window.relic.getGitStatus().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitStatus(result.value);
      } else {
        setGitStatus(null);
        setSelectedGitCommitHash(null);
        setSelectedGitCommitDiff(null);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setWorkspaceError, workspaceState?.activeWorkspace?.id]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic || !gitStatus?.initialized) {
      setGitCommitHistory([]);
      setGitRemotes([]);
      setGitWorkingChanges([]);
      setSelectedGitCommitHash(null);
      setSelectedGitCommitDiff(null);
      return;
    }

    let canceled = false;

    void window.relic.getGitRemotes().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitRemotes(result.value);
        setGitRemoteUrl(result.value.find((remote) => remote.isOrigin)?.url ?? "");
      } else {
        setGitRemotes([]);
      }
    });

    void window.relic.getGitCommitHistory().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitCommitHistory(result.value);
        if (result.value.length > 0 && !selectedGitCommitHash) {
          setSelectedGitCommitHash(result.value[0].hash);
        }
      } else {
        setGitCommitHistory([]);
        setWorkspaceError(result.error.message);
      }
    });

    void window.relic.getGitWorkingChanges().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitWorkingChanges(result.value);
      } else {
        setGitWorkingChanges([]);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [
    gitStatus?.initialized,
    selectedGitCommitHash,
    setWorkspaceError,
    workspaceState?.activeWorkspace?.id,
    workspaceState?.fileTree
  ]);

  useEffect(() => {
    if (!window.relic || !selectedGitCommitHash || !gitStatus?.initialized) {
      setSelectedGitCommitDiff(null);
      return;
    }

    let canceled = false;

    void window.relic.getGitCommitDiff(selectedGitCommitHash).then((result) => {
      if (canceled) return;

      if (result.ok) {
        setSelectedGitCommitDiff(result.value);
      } else {
        setSelectedGitCommitDiff(null);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [gitStatus?.initialized, selectedGitCommitHash, setWorkspaceError]);

  const handleInitializeGitRepository = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.initializeGitRepository().then((result) => {
      if (result.ok) {
        setGitStatus(result.value);
        setWorkspaceError(null);
        refreshGitCommitHistory();
        refreshGitWorkingChanges();
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [refreshGitCommitHistory, refreshGitWorkingChanges, setWorkspaceError]);

  const handleCreateGitCommit = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingGitCommit(true);
    setWorkspaceError(null);

    void window.relic
      .createGitCommit({
        message: gitCommitMessage
      })
      .then((result) => {
        if (!result.ok) {
          setWorkspaceError(result.error.message);
          return;
        }

        setGitCommitMessage("");
        setGitCommitHistory((current) => [result.value, ...current]);
        setSelectedGitCommitHash(result.value.hash);
        refreshGitWorkingChanges();
      })
      .finally(() => setIsCreatingGitCommit(false));
  }, [gitCommitMessage, refreshGitWorkingChanges, setWorkspaceError]);

  const handleConnectGitHubAccount = useCallback((): void => {
    if (!window.relic) return;

    setIsConnectingGitHub(true);
    setWorkspaceError(null);

    void window.relic
      .connectGitHubAccount()
      .then((result) => {
        if (result.ok) {
          setGitHubAuthStatus(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsConnectingGitHub(false));
  }, [setWorkspaceError]);

  const handleDisconnectGitHubAccount = useCallback((): void => {
    if (!window.relic) return;

    setIsDisconnectingGitHub(true);
    setWorkspaceError(null);

    void window.relic
      .disconnectGitHubAccount()
      .then((result) => {
        if (result.ok) {
          setGitHubAuthStatus(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsDisconnectingGitHub(false));
  }, [setWorkspaceError]);

  const handleConnectGitRemote = useCallback((): void => {
    if (!window.relic) return;

    setIsConnectingGitRemote(true);
    setGitSyncMessage(null);
    setWorkspaceError(null);

    void window.relic
      .connectGitRemote({ url: gitRemoteUrl })
      .then((result) => {
        if (result.ok) {
          setGitRemotes(result.value);
          setGitRemoteUrl(result.value.find((remote) => remote.isOrigin)?.url ?? gitRemoteUrl);
          setGitSyncMessage(t("git.remoteConnected"));
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsConnectingGitRemote(false));
  }, [gitRemoteUrl, setWorkspaceError, t]);

  const handleShowPushPreview = useCallback((): void => {
    if (!window.relic) return;

    clearGitMessages();
    setGitSyncStep("pull-fetching");

    void window.relic
      .getGitSyncPreview()
      .then((result) => {
        if (result.ok) {
          setGitSyncPreview(result.value);
          setGitSyncStep("push-preview");
        } else {
          setGitSyncStep(null);
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => handleShowPushPreview);
        }
      });
  }, [clearGitMessages]);

  const handleShowPullPreview = useCallback((): void => {
    if (!window.relic) return;

    clearGitMessages();
    setGitSyncStep("pull-fetching");

    void window.relic
      .getGitSyncPreview()
      .then((result) => {
        if (result.ok) {
          setGitSyncPreview(result.value);
          setGitSyncStep("pull-preview");
        } else {
          setGitSyncStep(null);
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => handleShowPullPreview);
        }
      });
  }, [clearGitMessages]);

  const handleConfirmPush = useCallback((): void => {
    if (!window.relic) return;

    setIsPushingGitBranch(true);
    setGitSyncStep(null);

    void window.relic
      .pushGitBranch()
      .then((result) => {
        if (result.ok) {
          setGitSyncMessage(result.value.message);
          refreshGitWorkingChanges();
        } else {
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => handleConfirmPush);
        }
      })
      .finally(() => setIsPushingGitBranch(false));
  }, [refreshGitWorkingChanges]);

  const handleConfirmPull = useCallback((): void => {
    if (!window.relic) return;

    setIsPullingGitBranch(true);
    setGitSyncStep(null);

    void window.relic
      .pullGitBranch()
      .then((result) => {
        if (result.ok) {
          setGitSyncMessage(result.value.message);
          refreshGitCommitHistory();
          refreshGitWorkingChanges();
          void window.relic?.getGitConflicts().then((r) => {
            if (r.ok) setGitConflicts(r.value);
          });
        } else {
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => handleConfirmPull);
          void window.relic?.getGitConflicts().then((r) => {
            if (r.ok) setGitConflicts(r.value);
          });
        }
      })
      .finally(() => setIsPullingGitBranch(false));
  }, [refreshGitCommitHistory, refreshGitWorkingChanges]);

  const handleResolveConflict = useCallback((filePath: string, resolution: "ours" | "theirs"): void => {
    if (!window.relic) return;

    setIsResolvingConflict(true);

    void window.relic
      .resolveGitConflict({ path: filePath, resolution })
      .then((result) => {
        if (result.ok) {
          setGitConflicts(result.value);
          refreshGitWorkingChanges();
        } else {
          setGitErrorMessage(result.error.message);
        }
      })
      .finally(() => setIsResolvingConflict(false));
  }, [refreshGitWorkingChanges]);

  const handleCloneGitHubRepository = useCallback((): void => {
    if (!window.relic) return;

    setIsCloningGitHub(true);
    setGitErrorMessage(null);

    void window.relic
      .cloneGitHubRepository({ url: gitCloneUrl })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setGitCloneUrl("");
        } else {
          setGitErrorMessage(result.error.message);
        }
      })
      .finally(() => setIsCloningGitHub(false));
  }, [gitCloneUrl, setWorkspaceState]);

  return {
    gitStatus,
    gitHubAuthStatus,
    gitRemotes,
    gitCommitHistory,
    gitWorkingChanges,
    selectedGitCommitHash,
    selectedGitCommitDiff,
    gitRemoteUrl,
    gitSyncMessage,
    gitErrorMessage,
    gitRetryAction,
    gitCommitMessage,
    gitSyncPreview,
    gitSyncStep,
    gitConflicts,
    gitCloneUrl,
    isCreatingGitCommit,
    isConnectingGitHub,
    isConnectingGitRemote,
    isDisconnectingGitHub,
    isPullingGitBranch,
    isPushingGitBranch,
    isCloningGitHub,
    isResolvingConflict,
    handleInitializeGitRepository,
    handleCloneGitHubRepository,
    handleConnectGitHubAccount,
    handleDisconnectGitHubAccount,
    handleConnectGitRemote,
    handlePushGitBranch: handleShowPushPreview,
    handlePullGitBranch: handleShowPullPreview,
    handleConfirmPush,
    handleConfirmPull,
    handleCreateGitCommit,
    handleResolveConflict,
    setSelectedGitCommitHash,
    setGitRemoteUrl,
    setGitSyncStep,
    setGitCommitMessage,
    setGitCloneUrl
  };
}
