import type { ReactElement, ReactNode } from "react";

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
  return (
    <div aria-label={ariaLabel} className="settings-segmented" role="group">
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
