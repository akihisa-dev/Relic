import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import type { SearchMode, CardbookSearchResult, CardbookState, CardbookTreeNode } from "../../shared/ipc";
import { type CardTreeExpansionRequest } from "../cardTreeModel";
import { isFilteringCards as isFilteringCardsModel } from "../cardsSidebarModel";
import { useCardTreeSelection } from "../hooks/useCardTreeSelection";
import { CardsSearchResults } from "./CardsSearchResults";
import { CardsSidebarSearch } from "./CardsSidebarSearch";
import { CardsSidebarTreeSection } from "./CardsSidebarTreeSection";
import { CardsCreateActions, CardsCardbookActions, CardsCardbookEmpty } from "./CardsCardbookActions";

export interface CardsSidebarProps {
  isCreatingCard: boolean;
  isCreatingCardFolder: boolean;
  isCreatingCardbook: boolean;
  isSearching: boolean;
  isOpeningCardbook: boolean;
  onCreateCard: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  onCreateCardInCardFolder?: (cardFolderPath: string) => void;
  onCreateCardFolder: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  onCreateCardFolderInCardFolder?: (cardFolderPath: string) => void;
  onCreateCardbook: () => void;
  onDeleteItem: (path: string, type: CardbookTreeNode["type"]) => void;
  onDeleteItems: (items: Array<{ path: string; type: CardbookTreeNode["type"] }>) => void;
  onDuplicateCard: (path: string) => void;
  onMoveCard: (path: string, destCardFolder: string) => void;
  onMoveCardFolder: (path: string, destCardFolder: string) => void;
  onMoveItems: (items: Array<{ path: string; type: CardbookTreeNode["type"] }>, destCardFolder: string) => void;
  onOpenCard: (path: string, event?: React.MouseEvent<HTMLButtonElement>) => void;
  onOpenInOtherPane?: (path: string) => void;
  onOpenCardbook: () => void;
  onRevealItem?: (path: string) => void;
  onRenameItem: (path: string, type: CardbookTreeNode["type"], newName: string) => void;
  onSelectCardFolder: (node: Extract<CardbookTreeNode, { type: "cardFolder" }>) => void;
  onSelectedCountChange?: (count: number) => void;
  onSearchFrontmatterFieldChange: (field: string) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onSearchQueryChange: (query: string) => void;
  onTogglePin: (path: string) => void;
  openCardPaths?: Set<string>;
  searchError: string | null;
  searchFocusRequest: number;
  searchFrontmatterCandidates: Record<string, string[]>;
  searchFrontmatterField: string;
  searchFrontmatterFields: string[];
  searchMode: SearchMode;
  searchQuery: string;
  searchResults: CardbookSearchResult[];
  cardbookState: CardbookState | null;
}

export function CardsSidebar({
  isCreatingCard,
  isCreatingCardFolder,
  isCreatingCardbook,
  isSearching,
  isOpeningCardbook,
  onCreateCard,
  onCreateCardInCardFolder,
  onCreateCardFolder,
  onCreateCardFolderInCardFolder,
  onCreateCardbook,
  onDeleteItem,
  onDeleteItems,
  onDuplicateCard,
  onMoveCard,
  onMoveCardFolder,
  onMoveItems,
  onOpenCard,
  onOpenInOtherPane,
  onOpenCardbook,
  onRevealItem,
  onRenameItem,
  onSelectCardFolder,
  onSelectedCountChange,
  onSearchFrontmatterFieldChange,
  onSearchModeChange,
  onSearchQueryChange,
  onTogglePin,
  openCardPaths,
  searchError,
  searchFocusRequest,
  searchFrontmatterCandidates,
  searchFrontmatterField,
  searchFrontmatterFields,
  searchMode,
  searchQuery,
  searchResults,
  cardbookState
}: CardsSidebarProps): ReactElement {
  const [expansionRequest, setExpansionRequest] = useState<CardTreeExpansionRequest | undefined>(undefined);
  const activeCardbook = cardbookState?.activeCardbook ?? null;
  const pinnedPaths = useMemo(
    () => new Set(cardbookState?.pinnedPaths ?? []),
    [cardbookState?.pinnedPaths]
  );
  const userNodes = useMemo(() => cardbookState?.cardTree ?? [], [cardbookState?.cardTree]);
  const { handleSelectItem, selectedItems, selectedPaths } = useCardTreeSelection({
    nodes: userNodes,
    onSelectedCountChange
  });
  const isFilteringCards = isFilteringCardsModel({ isSearching, query: searchQuery, searchError });

  const requestExpansion = (action: CardTreeExpansionRequest["action"], scopePath?: string): void => {
    setExpansionRequest((current) => ({ action, id: (current?.id ?? 0) + 1, scopePath }));
  };

  return (
    <div className="sidebar-section">
      {activeCardbook ? (
        <>
          <CardsSidebarSearch
            onSearchFrontmatterFieldChange={onSearchFrontmatterFieldChange}
            onSearchModeChange={onSearchModeChange}
            onSearchQueryChange={onSearchQueryChange}
            searchError={searchError}
            searchFocusRequest={searchFocusRequest}
            searchFrontmatterCandidates={searchFrontmatterCandidates}
            searchFrontmatterField={searchFrontmatterField}
            searchFrontmatterFields={searchFrontmatterFields}
            searchMode={searchMode}
            searchQuery={searchQuery}
          />
          <CardsCreateActions
            isCreatingCard={isCreatingCard}
            isCreatingCardFolder={isCreatingCardFolder}
            onCollapseAllCardFolders={() => requestExpansion("collapse")}
            onCreateCard={onCreateCard}
            onCreateCardFolder={onCreateCardFolder}
            onExpandAllCardFolders={() => requestExpansion("expand")}
          />
          {isFilteringCards ? (
            <CardsSearchResults
              error={searchError}
              frontmatterField={searchFrontmatterField}
              isSearching={isSearching}
              mode={searchMode}
              onOpenCard={onOpenCard}
              query={searchQuery}
              results={searchResults}
            />
          ) : null}
          {!isFilteringCards && cardbookState ? (
            <CardsSidebarTreeSection
              expansionRequest={expansionRequest}
              onDeleteItem={onDeleteItem}
              onDeleteSelectedItems={() => onDeleteItems(selectedItems)}
              onCreateCardInCardFolder={onCreateCardInCardFolder}
              onCreateCardFolderInCardFolder={onCreateCardFolderInCardFolder}
              onDuplicateCard={onDuplicateCard}
              onMoveCard={onMoveCard}
              onMoveCardFolder={onMoveCardFolder}
              onMoveItems={onMoveItems}
              onOpenCard={onOpenCard}
              onOpenInOtherPane={onOpenInOtherPane}
              onRequestExpansion={requestExpansion}
              onRevealItem={onRevealItem}
              onRenameItem={onRenameItem}
              onSelectCardFolder={onSelectCardFolder}
              onSelectItem={handleSelectItem}
              onTogglePin={onTogglePin}
              openCardPaths={openCardPaths}
              pinnedPaths={pinnedPaths}
              selectedItems={selectedItems}
              selectedPaths={selectedPaths}
              cardbookState={cardbookState}
            />
          ) : null}
          <CardsCardbookActions
            isCreatingCardbook={isCreatingCardbook}
            isOpeningCardbook={isOpeningCardbook}
            onCreateCardbook={onCreateCardbook}
            onOpenCardbook={onOpenCardbook}
          />
        </>
      ) : (
        <CardsCardbookEmpty
          isCreatingCardbook={isCreatingCardbook}
          isOpeningCardbook={isOpeningCardbook}
          onCreateCardbook={onCreateCardbook}
          onOpenCardbook={onOpenCardbook}
        />
      )}
    </div>
  );
}
