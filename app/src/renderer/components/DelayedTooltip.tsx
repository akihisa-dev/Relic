import type { ReactElement, ReactNode } from "react";

interface DelayedTooltipProps {
  children: ReactNode;
  className?: string;
  label: string;
}

export function DelayedTooltip({ children, className = "", label }: DelayedTooltipProps): ReactElement {
  return (
    <div className={`delayed-tooltip${className ? ` ${className}` : ""}`} role="presentation">
      {children}
      <div aria-hidden="true" className="delayed-tooltip-content" role="tooltip">
        {label}
      </div>
    </div>
  );
}
