import { useEffect, useState, type ReactElement } from "react";

import type { WorkspaceCard } from "../../shared/ipc";
import { resolveCardImagePath } from "../cards/cardViewModel";
import { useWorkspaceCardsState } from "../cards/useWorkspaceCardsState";
import { useT } from "../i18n";
import { relicClient } from "../relicClient";

interface CardViewProps {
  currentPath?: string | null;
  onOpenFile: (path: string) => void;
  onSelectPath: (path: string) => void;
  refreshRevision: number;
  selectedPath?: string | null;
  workspaceId: string;
}

export function CardView({
  currentPath = null,
  onOpenFile,
  onSelectPath,
  refreshRevision,
  selectedPath = null,
  workspaceId
}: CardViewProps): ReactElement {
  const t = useT();
  const state = useWorkspaceCardsState({
    loadFailedMessage: t("cards.loadFailed"),
    refreshRevision,
    workspaceId
  });

  const selectedCard = state.status === "ready"
    ? state.cards.find((card) => card.path === selectedPath)
      ?? state.cards.find((card) => card.path === currentPath)
      ?? state.cards[0]
    : undefined;

  useEffect(() => {
    if (selectedCard && selectedCard.path !== selectedPath) {
      onSelectPath(selectedCard.path);
    }
  }, [onSelectPath, selectedCard, selectedPath]);

  return (
    <section aria-label={t("cards.title")} className="card-view">
      {state.status === "loading" ? <p className="card-view-status">{t("common.loading")}</p> : null}
      {state.status === "error" ? <p className="card-view-status card-view-status--error">{state.message}</p> : null}
      {state.status === "ready" && state.cards.length === 0 ? (
        <div className="card-view-empty">
          <h3>{t("cards.emptyTitle")}</h3>
          <p>{t("cards.emptyDescription")}</p>
        </div>
      ) : null}
      {state.status === "ready" && state.cards.length > 0 ? (
        <div className="card-view-body">
          <div aria-label={t("cards.title")} className="card-view-list" role="list">
            {state.cards.map((card) => (
              <div key={card.path} role="listitem">
                <button
                  aria-current={card.path === selectedCard?.path ? "true" : undefined}
                  className="card-view-list-item"
                  onClick={() => onSelectPath(card.path)}
                  type="button"
                >
                  {card.name}
                </button>
              </div>
            ))}
          </div>
          {selectedCard ? (
            <button
              aria-label={t("cards.openFile", { name: selectedCard.name })}
              className="card-view-item"
              onClick={() => onOpenFile(selectedCard.path)}
              type="button"
            >
              <span className="card-view-name-row">
                <span className="card-view-name">{selectedCard.name}</span>
              </span>
              <span className="card-view-image-frame">
                <CardImage card={selectedCard} key={selectedCard.path} />
              </span>
              <span className="card-view-description">{selectedCard.flavorText}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CardImage({ card }: { card: WorkspaceCard }): ReactElement {
  const t = useT();
  const [state, setState] = useState<"loading" | "failed" | { src: string }>("loading");
  const resolvedPath = resolveCardImagePath(card.path, card.imagePath);

  useEffect(() => {
    let active = true;
    setState("loading");
    if (!resolvedPath || !relicClient.current) {
      setState("failed");
      return () => {
        active = false;
      };
    }

    setState("loading");
    void relicClient.current.readImageFile({ path: resolvedPath }).then((result) => {
      if (!active) return;
      setState(result.ok ? { src: result.value.dataUrl } : "failed");
    }).catch(() => {
      if (active) setState("failed");
    });

    return () => {
      active = false;
    };
  }, [resolvedPath]);

  return (
    <span
      className="card-view-image"
      data-image-state={typeof state === "object" ? "ready" : state}
    >
      {typeof state === "object" ? (
        <img
          alt=""
          loading="lazy"
          onError={() => setState("failed")}
          src={state.src}
        />
      ) : state === "failed" ? (
        <span className="card-view-image-fallback">{t("cards.imageFailed")}</span>
      ) : (
        <span aria-hidden="true" className="card-view-image-placeholder" />
      )}
    </span>
  );
}
