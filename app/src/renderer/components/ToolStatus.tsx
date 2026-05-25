import type { ReactElement } from "react";

import { isToolStatusError } from "../toolsPanelModel";

export function ToolStatus({ status }: { status: string | null }): ReactElement | null {
  if (!status) return null;

  return (
    <div className={`tool-status${isToolStatusError(status) ? " tool-status--error" : " tool-status--success"}`}>
      {status}
    </div>
  );
}
