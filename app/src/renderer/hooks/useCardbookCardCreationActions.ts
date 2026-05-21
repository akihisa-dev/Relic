import { useCallback, useState } from "react";

import {
  findCreatedMarkdownPath,
  nextUniqueCardName,
  nextUniqueCardFolderName
} from "./cardbookCardActionHelpers";
import type { CardbookCardActionsContext } from "./cardbookCardActionTypes";
import type { Translator } from "../i18n";

type CardbookCardCreationInput = Pick<
  CardbookCardActionsContext,
  "focusedPane" | "openCardInPane" | "setCardbookError" | "setCardbookState" | "cardbookState"
> & {
  t: Translator;
};

export function useCardbookCardCreationActions({
  focusedPane,
  openCardInPane,
  setCardbookError,
  setCardbookState,
  t,
  cardbookState
}: CardbookCardCreationInput) {
  const [cardNameDraft, setCardNameDraft] = useState("");
  const [cardFolderNameDraft, setCardFolderNameDraft] = useState("");
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [isCreatingCardFolder, setIsCreatingCardFolder] = useState(false);

  const handleCreateCard = useCallback((): void => {
    if (!window.relic) return;

    const cardName = cardNameDraft.trim() || nextUniqueCardName(cardbookState, t);

    setIsCreatingCard(true);
    setCardbookError(null);

    void window.relic
      .createMarkdownCard({ name: cardName })
      .then((result) => {
        if (result.ok) {
          setCardbookState(result.value);
          setCardNameDraft("");
          const expectedPath = cardName.endsWith(".md") ? cardName : `${cardName}.md`;
          void window.relic!.readMarkdownCard({ path: expectedPath }).then((readResult) => {
            if (readResult.ok) {
              openCardInPane(focusedPane, readResult.value);
            }
          });
        } else {
          setCardbookError(result.error.message);
        }
      })
      .finally(() => setIsCreatingCard(false));
  }, [
    cardNameDraft,
    focusedPane,
    openCardInPane,
    setCardbookError,
    setCardbookState,
    t,
    cardbookState
  ]);

  const handleCreateNoteFromPane = useCallback((name: string): void => {
    if (!window.relic) return;

    const cardName = name.trim() || nextUniqueCardName(cardbookState, t);

    void window.relic
      .createMarkdownCard({ name: cardName })
      .then((result) => {
        if (result.ok) {
          setCardbookState(result.value);
          const expectedPath = cardName.endsWith(".md") ? cardName : `${cardName}.md`;
          const newCard = findCreatedMarkdownPath(result.value.cardTree, expectedPath);

          if (newCard) {
            void window.relic!.readMarkdownCard({ path: newCard }).then((readResult) => {
              if (readResult.ok) openCardInPane(focusedPane, readResult.value);
            });
          }
        } else {
          setCardbookError(result.error.message);
        }
      });
  }, [
    focusedPane,
    openCardInPane,
    setCardbookError,
    setCardbookState,
    t,
    cardbookState
  ]);

  const handleCreateCardFolder = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingCardFolder(true);
    setCardbookError(null);

    void window.relic
      .createCardFolder({ name: cardFolderNameDraft.trim() || nextUniqueCardFolderName(cardbookState, t) })
      .then((result) => {
        if (result.ok) {
          setCardbookState(result.value);
          setCardFolderNameDraft("");
        } else {
          setCardbookError(result.error.message);
        }
      })
      .finally(() => setIsCreatingCardFolder(false));
  }, [cardFolderNameDraft, setCardbookError, setCardbookState, t, cardbookState]);

  return {
    cardNameDraft,
    cardFolderNameDraft,
    handleCreateCard,
    handleCreateCardFolder,
    handleCreateNoteFromPane,
    isCreatingCard,
    isCreatingCardFolder,
    setCardNameDraft,
    setCardFolderNameDraft,
    setIsCreatingCard
  };
}
