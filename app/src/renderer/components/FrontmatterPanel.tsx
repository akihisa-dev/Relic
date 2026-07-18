import type { ReactElement } from "react";

import type { FrontmatterCategoryChoice } from "../../shared/ipc";
import { TableView } from "./TableView";

export function FrontmatterPanel({
  categoryChoices,
  onCategoryChoicesSave,
  onOpenFile,
  refreshRevision,
  workspaceId
}: {
  categoryChoices: FrontmatterCategoryChoice[];
  onCategoryChoicesSave: (choices: FrontmatterCategoryChoice[]) => void;
  onOpenFile: (path: string) => void;
  refreshRevision: number;
  workspaceId: string;
}): ReactElement {
  return (
    <TableView
      categoryChoices={categoryChoices}
      onCategoryChoicesSave={onCategoryChoicesSave}
      onOpenFile={onOpenFile}
      refreshRevision={refreshRevision}
      workspaceId={workspaceId}
    />
  );
}
