import type { ReactElement, ReactNode } from "react";

export interface AppTitleBarProps {
  children?: ReactNode;
}

export function AppTitleBar({ children }: AppTitleBarProps): ReactElement {
  return (
    <div className="title-bar">
      <div className="title-bar-drag-area" />
      {children}
    </div>
  );
}
