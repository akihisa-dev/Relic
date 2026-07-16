import { useEffect, useRef, useState, type ReactElement } from "react";

import type { WorkspaceCard } from "../../shared/ipc";
import { resolveCardImagePath } from "../cards/cardViewModel";
import { loadWorkspaceCards } from "../cards/workspaceCardsLoader";
import { useT } from "../i18n";
import { relicClient } from "../relicClient";

interface CardViewProps {
  onOpenFile: (path: string) => void;
  refreshRevision: number;
  workspaceId: string;
}

export function CardView({ onOpenFile, refreshRevision, workspaceId }: CardViewProps): ReactElement {
  const t = useT();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; cards: WorkspaceCard[] }
  >({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });

    void loadWorkspaceCards({ revision: refreshRevision, workspaceId }).then((result) => {
      if (!active) return;
      setState(result.ok
        ? { status: "ready", cards: result.value }
        : { status: "error", message: result.error.message });
    }).catch(() => {
      if (active) setState({ status: "error", message: t("cards.loadFailed") });
    });

    return () => {
      active = false;
    };
  }, [refreshRevision, t, workspaceId]);

  return (
    <section aria-label={t("cards.title")} className="card-view">
      <header className="card-view-header">
        <div>
          <p className="card-view-kicker">{t("nav.cards")}</p>
          <h2>{t("cards.title")}</h2>
        </div>
        {state.status === "ready" ? <span>{t("cards.count", { count: state.cards.length })}</span> : null}
      </header>
      {state.status === "loading" ? <p className="card-view-status">{t("common.loading")}</p> : null}
      {state.status === "error" ? <p className="card-view-status card-view-status--error">{state.message}</p> : null}
      {state.status === "ready" && state.cards.length === 0 ? (
        <p className="card-view-status">{t("cards.empty")}</p>
      ) : null}
      {state.status === "ready" && state.cards.length > 0 ? (
        <div className="card-view-grid">
          {state.cards.map((card) => (
            <button
              aria-label={t("cards.openFile", { name: card.name })}
              className="card-view-item"
              key={card.path}
              onClick={() => onOpenFile(card.path)}
              title={card.path}
              type="button"
            >
              <CardImage card={card} />
              <span className="card-view-name">{card.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CardImage({ card }: { card: WorkspaceCard }): ReactElement {
  const t = useT();
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "failed" | { src: string }>("idle");
  const resolvedPath = resolveCardImagePath(card.path, card.imagePath);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || visible) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin: "160px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    let active = true;
    if (!visible || !resolvedPath || !relicClient.current) {
      if (visible && !resolvedPath) setState("failed");
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
  }, [resolvedPath, visible]);

  return (
    <span className="card-view-image" ref={hostRef}>
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
