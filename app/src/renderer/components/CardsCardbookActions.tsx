import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";

import { useT } from "../i18n";

interface CardsCardbookActionProps {
  isCreatingCardbook: boolean;
  isOpeningCardbook: boolean;
  onCreateCardbook: () => void;
  onOpenCardbook: () => void;
}

interface CardsCreateActionsProps {
  isCreatingCard: boolean;
  isCreatingCardFolder: boolean;
  onCreateCard: (event?: ReactMouseEvent<HTMLButtonElement>) => void;
  onCreateCardFolder: (event?: ReactMouseEvent<HTMLButtonElement>) => void;
  onCollapseAllCardFolders: () => void;
  onExpandAllCardFolders: () => void;
}

export function CardsCreateActions({
  isCreatingCard,
  isCreatingCardFolder,
  onCreateCard,
  onCreateCardFolder,
  onCollapseAllCardFolders,
  onExpandAllCardFolders
}: CardsCreateActionsProps): ReactElement {
  const t = useT();
  const createCardLabel = isCreatingCard ? t("common.running") : t("cards.createNote");
  const createCardFolderLabel = isCreatingCardFolder ? t("common.running") : t("cards.createCardFolder");
  const expandAllLabel = t("cards.expandAllCardFolders");
  const collapseAllLabel = t("cards.collapseAllCardFolders");

  return (
    <div className="cards-create-actions">
      <button
        aria-label={createCardLabel}
        className="cards-create-icon-button"
        data-tooltip={createCardLabel}
        disabled={isCreatingCard}
        onClick={onCreateCard}
        title={createCardLabel}
        type="button"
      >
        <NewCardIcon />
      </button>
      <button
        aria-label={createCardFolderLabel}
        className="cards-create-icon-button"
        data-tooltip={createCardFolderLabel}
        disabled={isCreatingCardFolder}
        onClick={onCreateCardFolder}
        title={createCardFolderLabel}
        type="button"
      >
        <NewCardFolderIcon />
      </button>
      <button
        aria-label={expandAllLabel}
        className="cards-create-icon-button"
        data-tooltip={expandAllLabel}
        onClick={onExpandAllCardFolders}
        title={expandAllLabel}
        type="button"
      >
        <ExpandAllCardFoldersIcon />
      </button>
      <button
        aria-label={collapseAllLabel}
        className="cards-create-icon-button"
        data-tooltip={collapseAllLabel}
        onClick={onCollapseAllCardFolders}
        title={collapseAllLabel}
        type="button"
      >
        <CollapseAllCardFoldersIcon />
      </button>
    </div>
  );
}

function NewCardIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="22">
      <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function NewCardFolderIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="22">
      <path d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  );
}

function ExpandAllCardFoldersIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="22">
      <path d="M3 5h8" />
      <path d="M3 12h8" />
      <path d="M3 19h8" />
      <path d="m15 8 3-3 3 3" />
      <path d="m15 16 3 3 3-3" />
    </svg>
  );
}

function CollapseAllCardFoldersIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="22">
      <path d="M3 5h8" />
      <path d="M3 12h8" />
      <path d="M3 19h8" />
      <path d="m15 5 3 3 3-3" />
      <path d="m15 19 3-3 3 3" />
    </svg>
  );
}

export function CardsCardbookActions({
  isCreatingCardbook,
  isOpeningCardbook,
  onCreateCardbook,
  onOpenCardbook
}: CardsCardbookActionProps): ReactElement {
  const t = useT();

  return (
    <div className="cardbook-actions">
      <button
        className="secondary-button cardbook-action-button"
        disabled={isOpeningCardbook || isCreatingCardbook}
        onClick={onOpenCardbook}
        type="button"
      >
        <OpenCardbookIcon />
        {isOpeningCardbook ? t("cards.opening") : t("cards.openCardFolder")}
      </button>
      <button
        className="secondary-button cardbook-action-button"
        disabled={isOpeningCardbook || isCreatingCardbook}
        onClick={onCreateCardbook}
        type="button"
      >
        <CreateCardbookIcon />
        {isCreatingCardbook ? t("cards.creatingCardbook") : t("cards.createNewCardbook")}
      </button>
    </div>
  );
}

export function CardsCardbookEmpty({
  isCreatingCardbook,
  isOpeningCardbook,
  onCreateCardbook,
  onOpenCardbook
}: CardsCardbookActionProps): ReactElement {
  const t = useT();

  return (
    <div className="cardbook-empty">
      <div>
        <p className="cardbook-empty-title">{t("cards.cardbookEmptyTitle")}</p>
        <p className="cardbook-empty-copy">{t("cards.cardbookHint")}</p>
      </div>
      <div className="cardbook-empty-actions">
        <button
          className="primary-button cardbook-action-button"
          disabled={isOpeningCardbook || isCreatingCardbook}
          onClick={onOpenCardbook}
          type="button"
        >
          <OpenCardbookIcon />
          {isOpeningCardbook ? t("cards.opening") : t("cards.openCardFolder")}
        </button>
        <button
          className="secondary-button cardbook-action-button"
          disabled={isOpeningCardbook || isCreatingCardbook}
          onClick={onCreateCardbook}
          type="button"
        >
          <CreateCardbookIcon />
          {isCreatingCardbook ? t("cards.creatingCardbook") : t("cards.createNewCardbook")}
        </button>
      </div>
    </div>
  );
}

function OpenCardbookIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

function CreateCardbookIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
      <path d="M12 7v6" />
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      <path d="M9 10h6" />
    </svg>
  );
}
