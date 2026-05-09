import { useCallback, useEffect, useState } from "react";

import type {
  GitBranchSummary,
  GitCommitDiff,
  GitCommitSummary,
  GitConflict,
  GitHubAuthStatus,
  GitRemoteSummary,
  GitStatus,
  GitSyncPreview,
  GitTagSummary,
  GitWorkingChange,
  WorkspaceState
} from "../../shared/ipc";

type GitSyncStep = "push-preview" | "pull-preview" | "pull-fetching" | null;

interface UseGitPanelStateInput {
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
  t: (key: "git.remoteConnected") => string;
  workspaceState: WorkspaceState | null;
}

export function useGitPanelState({
  setWorkspaceError,
  setWorkspaceState,
  t,
  workspaceState
}: UseGitPanelStateInput) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitHubAuthStatus, setGitHubAuthStatus] = useState<GitHubAuthStatus | null>(null);
  const [gitRemotes, setGitRemotes] = useState<GitRemoteSummary[]>([]);
  const [gitBranches, setGitBranches] = useState<GitBranchSummary[]>([]);
  const [gitCommitHistory, setGitCommitHistory] = useState<GitCommitSummary[]>([]);
  const [gitTags, setGitTags] = useState<GitTagSummary[]>([]);
  const [gitWorkingChanges, setGitWorkingChanges] = useState<GitWorkingChange[]>([]);
  const [selectedGitCommitHash, setSelectedGitCommitHash] = useState<string | null>(null);
  const [selectedGitCommitDiff, setSelectedGitCommitDiff] = useState<GitCommitDiff | null>(null);
  const [newGitBranchName, setNewGitBranchName] = useState("");
  const [newGitTagName, setNewGitTagName] = useState("");
  const [newGitTagMessage, setNewGitTagMessage] = useState("");
  const [gitRemoteUrl, setGitRemoteUrl] = useState("");
  const [gitSyncMessage, setGitSyncMessage] = useState<string | null>(null);
  const [gitErrorMessage, setGitErrorMessage] = useState<string | null>(null);
  const [gitRetryAction, setGitRetryAction] = useState<(() => void) | null>(null);
  const [pendingGitBranchSwitch, setPendingGitBranchSwitch] = useState<string | null>(null);
  const [gitCommitMessage, setGitCommitMessage] = useState("");
  const [gitAuthorName, setGitAuthorName] = useState("");
  const [gitAuthorEmail, setGitAuthorEmail] = useState("");
  const [isCreatingGitBranch, setIsCreatingGitBranch] = useState(false);
  const [isCreatingGitCommit, setIsCreatingGitCommit] = useState(false);
  const [isCreatingGitTag, setIsCreatingGitTag] = useState(false);
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false);
  const [isConnectingGitRemote, setIsConnectingGitRemote] = useState(false);
  const [isDeletingGitTag, setIsDeletingGitTag] = useState(false);
  const [isDisconnectingGitHub, setIsDisconnectingGitHub] = useState(false);
  const [isPullingGitBranch, setIsPullingGitBranch] = useState(false);
  const [isPushingGitBranch, setIsPushingGitBranch] = useState(false);
  const [pushingGitTagName, setPushingGitTagName] = useState<string | null>(null);
  const [isSwitchingGitBranch, setIsSwitchingGitBranch] = useState(false);
  const [gitCloneUrl, setGitCloneUrl] = useState("");
  const [isCloningGitHub, setIsCloningGitHub] = useState(false);
  const [gitSyncPreview, setGitSyncPreview] = useState<GitSyncPreview | null>(null);
  const [gitSyncStep, setGitSyncStep] = useState<GitSyncStep>(null);
  const [gitConflicts, setGitConflicts] = useState<GitConflict[]>([]);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);

  const applyGitBranches = useCallback((branches: GitBranchSummary[]): void => {
    setGitBranches(branches);

    const currentBranch = branches.find((branch) => branch.isCurrent)?.name ?? null;

    setGitStatus((current) =>
      current
        ? {
            ...current,
            currentBranch
          }
        : current
    );
  }, []);

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

  const refreshGitTags = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.getGitTags().then((result) => {
      if (result.ok) {
        setGitTags(result.value);
      } else {
        setGitTags([]);
        setWorkspaceError(result.error.message);
      }
    });
  }, [setWorkspaceError]);

  const refreshGitBranches = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.getGitBranches().then((result) => {
      if (result.ok) {
        applyGitBranches(result.value);
      } else {
        setGitBranches([]);
        setWorkspaceError(result.error.message);
      }
    });
  }, [applyGitBranches, setWorkspaceError]);

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
      setGitBranches([]);
      setGitCommitHistory([]);
      setGitTags([]);
      setGitWorkingChanges([]);
      setPendingGitBranchSwitch(null);
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
      setGitBranches([]);
      setGitCommitHistory([]);
      setGitRemotes([]);
      setGitTags([]);
      setGitWorkingChanges([]);
      setSelectedGitCommitHash(null);
      setSelectedGitCommitDiff(null);
      setPendingGitBranchSwitch(null);
      return;
    }

    let canceled = false;

    void window.relic.getGitBranches().then((result) => {
      if (canceled) return;

      if (result.ok) {
        applyGitBranches(result.value);
      } else {
        setGitBranches([]);
        setWorkspaceError(result.error.message);
      }
    });

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

    void window.relic.getGitTags().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitTags(result.value);
      } else {
        setGitTags([]);
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
    applyGitBranches,
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
        setPendingGitBranchSwitch(null);
        setWorkspaceError(null);
        refreshGitBranches();
        refreshGitCommitHistory();
        refreshGitTags();
        refreshGitWorkingChanges();
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [refreshGitBranches, refreshGitCommitHistory, refreshGitTags, refreshGitWorkingChanges, setWorkspaceError]);

  const handleCreateGitBranch = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingGitBranch(true);
    setWorkspaceError(null);

    void window.relic
      .createGitBranch({ name: newGitBranchName })
      .then((result) => {
        if (result.ok) {
          applyGitBranches(result.value);
          setNewGitBranchName("");
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingGitBranch(false));
  }, [applyGitBranches, newGitBranchName, setWorkspaceError]);

  const handleSwitchGitBranch = useCallback(
    (name: string, allowDirty = false): void => {
      if (!window.relic) return;

      setIsSwitchingGitBranch(true);
      setWorkspaceError(null);

      void window.relic
        .switchGitBranch({ allowDirty, name })
        .then((result) => {
          if (result.ok) {
            applyGitBranches(result.value);
            setPendingGitBranchSwitch(null);
            refreshGitCommitHistory();
            refreshGitWorkingChanges();
            return;
          }

          if (result.error.code === "GIT_BRANCH_SWITCH_DIRTY") {
            setPendingGitBranchSwitch(name);
            return;
          }

          setWorkspaceError(result.error.message);
        })
        .finally(() => setIsSwitchingGitBranch(false));
    },
    [applyGitBranches, refreshGitCommitHistory, refreshGitWorkingChanges, setWorkspaceError]
  );

  const handleCreateGitCommit = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingGitCommit(true);
    setWorkspaceError(null);

    void window.relic
      .createGitCommit({
        authorEmail: gitAuthorEmail,
        authorName: gitAuthorName,
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
        setPendingGitBranchSwitch(null);
        refreshGitWorkingChanges();
      })
      .finally(() => setIsCreatingGitCommit(false));
  }, [gitAuthorEmail, gitAuthorName, gitCommitMessage, refreshGitWorkingChanges, setWorkspaceError]);

  const handleCreateGitTag = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingGitTag(true);
    setWorkspaceError(null);

    void window.relic
      .createGitTag({
        hash: selectedGitCommitHash ?? undefined,
        message: newGitTagMessage,
        name: newGitTagName,
        taggerEmail: gitAuthorEmail,
        taggerName: gitAuthorName
      })
      .then((result) => {
        if (!result.ok) {
          setWorkspaceError(result.error.message);
          return;
        }

        setGitTags(result.value);
        setNewGitTagName("");
        setNewGitTagMessage("");
      })
      .finally(() => setIsCreatingGitTag(false));
  }, [gitAuthorEmail, gitAuthorName, newGitTagMessage, newGitTagName, selectedGitCommitHash, setWorkspaceError]);

  const handleDeleteGitTag = useCallback((name: string): void => {
    if (!window.relic) return;

    setIsDeletingGitTag(true);
    setWorkspaceError(null);

    void window.relic
      .deleteGitTag({ name })
      .then((result) => {
        if (!result.ok) {
          setWorkspaceError(result.error.message);
          return;
        }

        setGitTags(result.value);
      })
      .finally(() => setIsDeletingGitTag(false));
  }, [setWorkspaceError]);

  const handleCommitAndSwitchGitBranch = useCallback((): void => {
    if (!window.relic || !pendingGitBranchSwitch) return;

    setIsCreatingGitCommit(true);
    setIsSwitchingGitBranch(true);
    setWorkspaceError(null);

    void window.relic
      .createGitCommit({
        authorEmail: gitAuthorEmail,
        authorName: gitAuthorName,
        message: gitCommitMessage
      })
      .then((commitResult) => {
        if (!commitResult.ok) {
          setWorkspaceError(commitResult.error.message);
          return;
        }

        setGitCommitMessage("");
        setGitCommitHistory((current) => [commitResult.value, ...current]);
        setSelectedGitCommitHash(commitResult.value.hash);

        return window.relic!.switchGitBranch({ name: pendingGitBranchSwitch });
      })
      .then((switchResult) => {
        if (!switchResult) {
          return;
        }

        if (switchResult.ok) {
          applyGitBranches(switchResult.value);
          setPendingGitBranchSwitch(null);
          refreshGitCommitHistory();
          refreshGitWorkingChanges();
        } else {
          setWorkspaceError(switchResult.error.message);
        }
      })
      .finally(() => {
        setIsCreatingGitCommit(false);
        setIsSwitchingGitBranch(false);
      });
  }, [
    applyGitBranches,
    gitAuthorEmail,
    gitAuthorName,
    gitCommitMessage,
    pendingGitBranchSwitch,
    refreshGitCommitHistory,
    refreshGitWorkingChanges,
    setWorkspaceError
  ]);

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

  const handlePushGitTag = useCallback((name: string): void => {
    if (!window.relic) return;

    setPushingGitTagName(name);
    clearGitMessages();

    void window.relic
      .pushGitTag({ name })
      .then((result) => {
        if (result.ok) {
          setGitSyncMessage(result.value.message);
        } else {
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => () => handlePushGitTag(name));
        }
      })
      .finally(() => setPushingGitTagName(null));
  }, [clearGitMessages]);

  return {
    gitStatus,
    gitHubAuthStatus,
    gitRemotes,
    gitBranches,
    gitCommitHistory,
    gitTags,
    gitWorkingChanges,
    selectedGitCommitHash,
    selectedGitCommitDiff,
    newGitBranchName,
    newGitTagName,
    newGitTagMessage,
    gitRemoteUrl,
    gitSyncMessage,
    gitErrorMessage,
    gitRetryAction,
    pendingGitBranchSwitch,
    gitCommitMessage,
    gitAuthorName,
    gitAuthorEmail,
    gitSyncPreview,
    gitSyncStep,
    gitConflicts,
    gitCloneUrl,
    isCreatingGitBranch,
    isCreatingGitCommit,
    isCreatingGitTag,
    isConnectingGitHub,
    isConnectingGitRemote,
    isDeletingGitTag,
    isDisconnectingGitHub,
    isPullingGitBranch,
    isPushingGitBranch,
    pushingGitTagName,
    isSwitchingGitBranch,
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
    handleCreateGitBranch,
    handleSwitchGitBranch,
    handleCommitAndSwitchGitBranch,
    handleCreateGitCommit,
    handleCreateGitTag,
    handleDeleteGitTag,
    handlePushGitTag,
    handleResolveConflict,
    setSelectedGitCommitHash,
    setNewGitBranchName,
    setNewGitTagName,
    setNewGitTagMessage,
    setGitRemoteUrl,
    setGitSyncStep,
    setPendingGitBranchSwitch,
    setGitCommitMessage,
    setGitAuthorName,
    setGitAuthorEmail,
    setGitCloneUrl
  };
}
