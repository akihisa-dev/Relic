import type { ReactElement } from "react";

import type { CardbookState } from "../../shared/ipc";
import { findNodeByPath, type CardTreeExpansionRequest } from "../cardTreeModel";
import { useT } from "../i18n";
import { CardTree, CardTreeItem, type CardTreeProps } from "./CardTree";

interface CardsSidebarTreeSectionProps extends Omit<CardTreeProps, "expansionRequest" | "isRoot" | "nodes" | "onDeleteSelectedItems" | "onRequestExpansion" | "pinnedPaths"> {
  expansionRequest?: CardTreeExpansionRequest;
  onDeleteSelectedItems: () => void;
  onRequestExpansion: (action: CardTreeExpansionRequest["action"], scopePath?: string) => void;
  pinnedPaths: Set<string>;
  cardbookState: CardbookState;
}

export function CardsSidebarTreeSection({
  expansionRequest,
  onDeleteSelectedItems,
  onRequestExpansion,
  pinnedPaths,
  cardbookState,
  ...cardTreeProps
}: CardsSidebarTreeSectionProps): ReactElement {
  const t = useT();
  const userNodes = cardbookState.cardTree;

  return (
    <>
      {pinnedPaths.size > 0 ? (
        <div className="pinned-section">
          <div className="pinned-section-heading">{t("cards.pinned")}</div>
          <ul className="card-tree">
            {cardbookState.pinnedPaths.map((p) => {
              const node = findNodeByPath(cardbookState.cardTree, p);

              if (!node) return null;

              return (
                <CardTreeItem
                  {...cardTreeProps}
                  expansionRequest={expansionRequest}
                  isPinned
                  key={p}
                  node={node}
                  onDeleteSelectedItems={onDeleteSelectedItems}
                  onRequestExpansion={onRequestExpansion}
                  pinnedPaths={pinnedPaths}
                />
              );
            })}
          </ul>
        </div>
      ) : null}
      <CardTree
        {...cardTreeProps}
        expansionRequest={expansionRequest}
        isRoot
        nodes={userNodes}
        onDeleteSelectedItems={onDeleteSelectedItems}
        onRequestExpansion={onRequestExpansion}
        pinnedPaths={pinnedPaths}
      />
    </>
  );
}
