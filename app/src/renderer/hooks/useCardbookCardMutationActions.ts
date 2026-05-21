import { useCallback } from "react";

import type { CardbookState, CardbookTreeNode } from "../../shared/ipc";
import type { Translator } from "../i18n";
import {
  buildCardFolderTabPathUpdates,
  getMovableTreeItems,
  removeCoveredItems
} from "./cardbookCardActionHelpers";
import type { CardbookCardActionsContext } from "./cardbookCardActionTypes";
import {
  deleteTreeItemMessage,
  deleteTreeItemsMessage,
  getActiveCardTab,
  movedCardFolderPath,
  renamedCardFolderPath,
  tabCloseTargetsForTreeItem,
  tabCloseTargetsForTreeItems
} from "./cardbookCardMutationModel";

type CardbookCardMutationInput = Pick<
  CardbookCardActionsContext,
  | "closeTab"
  | "focusedPane"
  | "leftPane"
  | "openCardInPane"
  | "rightPane"
  | "setCardbookError"
  | "setCardbookState"
  | "tabs"
  | "updateTabMeta"
>;

export function useCardbookCardMutationActions({
  closeTab,
  focusedPane,
  leftPane,
  openCardInPane,
  rightPane,
  setCardbookError,
  setCardbookState,
  tabs,
  updateTabMeta,
  t
}: CardbookCardMutationInput & { t: Translator }) {
  const handleMoveCard = useCallback((path: string, destCardFolder: string): void => {
    if (!window.relic) return;

    void window.relic.moveMarkdownCard({ destinationCardFolder: destCardFolder, path }).then((result) => {
      if (result.ok) {
        const oldTab = Object.entries(tabs).find(([, tab]) => tab.kind === "card" && tab.path === path);

        if (oldTab) updateTabMeta(oldTab[0], { name: result.value.card.name, path: result.value.card.path });
        setCardbookState(result.value.cardbookState);
      } else {
        setCardbookError(result.error.message);
      }
    });
  }, [setCardbookError, setCardbookState, tabs, updateTabMeta]);

  const handleMoveCardFolder = useCallback((path: string, destCardFolder: string): void => {
    if (!window.relic) return;

    void window.relic.moveCardFolder({ destinationCardFolder: destCardFolder, path }).then((result) => {
      if (result.ok) {
        const nextCardFolderPath = movedCardFolderPath(path, destCardFolder);

        buildCardFolderTabPathUpdates(tabs, path, nextCardFolderPath)
          .forEach((update) => updateTabMeta(update.tabId, { name: update.name, path: update.path }));
        setCardbookState(result.value);
      } else {
        setCardbookError(result.error.message);
      }
    });
  }, [setCardbookError, setCardbookState, tabs, updateTabMeta]);

  const handleMoveTreeItems = useCallback(
    (items: Array<{ path: string; type: CardbookTreeNode["type"] }>, destCardFolder: string): void => {
      if (!window.relic) return;

      const movableItems = getMovableTreeItems(items, destCardFolder);

      if (movableItems.length === 0) return;

      void (async () => {
        for (const item of movableItems) {
          if (item.type === "card") {
            const result = await window.relic!.moveMarkdownCard({ destinationCardFolder: destCardFolder, path: item.path });
            if (!result.ok) {
              setCardbookError(result.error.message);
              return;
            }

            const oldTab = Object.entries(tabs).find(([, tab]) => tab.kind === "card" && tab.path === item.path);

            if (oldTab) updateTabMeta(oldTab[0], { name: result.value.card.name, path: result.value.card.path });
            setCardbookState(result.value.cardbookState);
            continue;
          }

          const result = await window.relic!.moveCardFolder({ destinationCardFolder: destCardFolder, path: item.path });
          if (!result.ok) {
            setCardbookError(result.error.message);
            return;
          }

          const nextCardFolderPath = movedCardFolderPath(item.path, destCardFolder);

          buildCardFolderTabPathUpdates(tabs, item.path, nextCardFolderPath)
            .forEach((update) => updateTabMeta(update.tabId, { name: update.name, path: update.path }));
          setCardbookState(result.value);
        }
      })();
    },
    [setCardbookError, setCardbookState, tabs, updateTabMeta]
  );

  const handleMoveActiveCard = useCallback(
    (destinationCardFolder: string): void => {
      const activeCard = getActiveCardTab({ focusedPane, leftPane, rightPane, tabs });

      if (!activeCard || !window.relic) return;

      void window.relic
        .moveMarkdownCard({ destinationCardFolder, path: activeCard.tab.path })
        .then((result) => {
          if (result.ok) {
            updateTabMeta(activeCard.tabId, { name: result.value.card.name, path: result.value.card.path });
            setCardbookState(result.value.cardbookState);
          } else {
            setCardbookError(result.error.message);
          }
        });
    },
    [focusedPane, leftPane, rightPane, setCardbookError, setCardbookState, tabs, updateTabMeta]
  );

  const handleRenameActiveCard = useCallback(
    (newName: string): void => {
      const activeCard = getActiveCardTab({ focusedPane, leftPane, rightPane, tabs });

      if (!activeCard || !window.relic) return;

      void window.relic
        .renameMarkdownCard({ newName, path: activeCard.tab.path })
        .then((result) => {
          if (result.ok) {
            updateTabMeta(activeCard.tabId, { name: result.value.card.name, path: result.value.card.path });
            setCardbookState(result.value.cardbookState);
          } else {
            setCardbookError(result.error.message);
          }
        });
    },
    [focusedPane, leftPane, rightPane, setCardbookError, setCardbookState, tabs, updateTabMeta]
  );

  const handleRenameTreeItem = useCallback(
    (path: string, type: CardbookTreeNode["type"], newName: string): void => {
      if (!window.relic) return;

      if (type === "card") {
        void window.relic.renameMarkdownCard({ newName, path }).then((result) => {
          if (result.ok) {
            Object.entries(tabs)
              .filter(([, tab]) => tab.kind === "card" && tab.path === path)
              .forEach(([tabId]) => {
                updateTabMeta(tabId, { name: result.value.card.name, path: result.value.card.path });
              });
            setCardbookState(result.value.cardbookState);
          } else {
            setCardbookError(result.error.message);
          }
        });
        return;
      }

      void window.relic.renameCardFolder({ newName, path }).then((result) => {
        if (result.ok) {
          const nextCardFolderPath = renamedCardFolderPath(path, newName);

          buildCardFolderTabPathUpdates(tabs, path, nextCardFolderPath)
            .forEach((update) => updateTabMeta(update.tabId, { name: update.name, path: update.path }));
          setCardbookState(result.value);
        } else {
          setCardbookError(result.error.message);
        }
      });
    },
    [setCardbookError, setCardbookState, tabs, updateTabMeta]
  );

  const handleDuplicateActiveCard = useCallback((): void => {
    const activeCard = getActiveCardTab({ focusedPane, leftPane, rightPane, tabs });
    if (!activeCard || !window.relic) return;
    void window.relic.duplicateMarkdownCard({ path: activeCard.tab.path }).then((result) => {
      if (result.ok) {
        setCardbookState(result.value.cardbookState);
        openCardInPane(focusedPane, result.value.card);
      } else {
        setCardbookError(result.error.message);
      }
    });
  }, [focusedPane, leftPane, openCardInPane, rightPane, setCardbookError, setCardbookState, tabs]);

  const handleDuplicateTreeCard = useCallback(
    (path: string): void => {
      if (!window.relic) return;

      void window.relic.duplicateMarkdownCard({ path }).then((result) => {
        if (result.ok) {
          setCardbookState(result.value.cardbookState);
          openCardInPane(focusedPane, result.value.card);
        } else {
          setCardbookError(result.error.message);
        }
      });
    },
    [focusedPane, openCardInPane, setCardbookError, setCardbookState]
  );

  const handleDeleteActiveCard = useCallback((): void => {
    const activeCard = getActiveCardTab({ focusedPane, leftPane, rightPane, tabs });
    if (!activeCard || !window.relic) return;
    if (!window.confirm(t("cards.deleteCardConfirm", { name: activeCard.tab.name }))) return;
    void window.relic.moveItemToTrash({ path: activeCard.tab.path, type: "card" }).then((result) => {
      if (result.ok) {
        closeTab(focusedPane, activeCard.tabId);
        setCardbookState(result.value);
      } else {
        setCardbookError(result.error.message);
      }
    });
  }, [closeTab, focusedPane, leftPane, rightPane, setCardbookError, setCardbookState, t, tabs]);

  const handleDeleteTreeItem = useCallback(
    (path: string, type: CardbookTreeNode["type"]): void => {
      if (!window.relic) return;

      const message = deleteTreeItemMessage(path, type, t);
      if (!window.confirm(message)) return;

      void window.relic.moveItemToTrash({ path, type }).then((result) => {
        if (result.ok) {
          const item = { path, type };
          tabCloseTargetsForTreeItem({ item, leftPane, rightPane, tabs })
            .forEach((target) => closeTab(target.pane, target.tabId));
          setCardbookState(result.value);
        } else {
          setCardbookError(result.error.message);
        }
      });
    },
    [closeTab, leftPane, rightPane, setCardbookError, setCardbookState, t, tabs]
  );

  const handleDeleteTreeItems = useCallback(
    (items: Array<{ path: string; type: CardbookTreeNode["type"] }>): void => {
      if (!window.relic || items.length === 0) return;

      const deletableItems = removeCoveredItems(items);
      const itemCount = deletableItems.length;
      const message = deleteTreeItemsMessage(itemCount, t);
      if (!window.confirm(message)) return;

      void (async () => {
        let nextCardbookState: CardbookState | null = null;

        for (const item of deletableItems) {
          const result = await window.relic!.moveItemToTrash({ path: item.path, type: item.type });
          if (!result.ok) {
            setCardbookError(result.error.message);
            return;
          }
          nextCardbookState = result.value;
        }

        tabCloseTargetsForTreeItems({ items: deletableItems, leftPane, rightPane, tabs })
          .forEach((target) => closeTab(target.pane, target.tabId));

        if (nextCardbookState) setCardbookState(nextCardbookState);
      })();
    },
    [closeTab, leftPane, rightPane, setCardbookError, setCardbookState, t, tabs]
  );

  return {
    handleDeleteActiveCard,
    handleDeleteTreeItem,
    handleDeleteTreeItems,
    handleDuplicateActiveCard,
    handleDuplicateTreeCard,
    handleMoveActiveCard,
    handleMoveCard,
    handleMoveCardFolder,
    handleMoveTreeItems,
    handleRenameActiveCard,
    handleRenameTreeItem
  };
}
