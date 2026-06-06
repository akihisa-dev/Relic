import type { ReactElement } from "react";

export interface AppTitleBarProps {}

export function AppTitleBar(_props: AppTitleBarProps): ReactElement {
  return (
    <div className="title-bar">
      <div className="title-bar-drag-area" />
    </div>
  );
}
