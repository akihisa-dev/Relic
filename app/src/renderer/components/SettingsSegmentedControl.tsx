import type { CSSProperties, ReactElement, ReactNode } from "react";

export interface SettingsSegmentedOption<T extends string> {
  icon?: ReactNode;
  label: string;
  value: T;
}

export function SettingsSegmentedControl<T extends string>({
  ariaLabel,
  onChange,
  options,
  value
}: {
  ariaLabel: string;
  onChange: (value: T) => void;
  options: SettingsSegmentedOption<T>[];
  value: T;
}): ReactElement {
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const style = {
    "--settings-segmented-count": options.length,
    "--settings-segmented-index": selectedIndex
  } as CSSProperties;

  return (
    <div aria-label={ariaLabel} className="settings-segmented" style={style}>
      <span aria-hidden="true" className="settings-segmented-indicator" />
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className="settings-segmented-button"
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.icon ? <span className="settings-segmented-icon">{option.icon}</span> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}
