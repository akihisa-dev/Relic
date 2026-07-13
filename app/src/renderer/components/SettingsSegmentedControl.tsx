import {
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState
} from "react";

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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>({});

  const updateIndicator = useCallback(() => {
    const selectedButton = buttonRefs.current[selectedIndex];
    if (!selectedButton) return;

    const left = selectedButton.offsetLeft;
    const width = selectedButton.offsetWidth;
    setIndicatorStyle((current) => (
      current.left === left && current.width === width
        ? current
        : { left, width }
    ));
  }, [selectedIndex]);

  useLayoutEffect(() => {
    updateIndicator();

    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(root);
    return () => resizeObserver.disconnect();
  }, [options, updateIndicator]);

  return (
    <div aria-label={ariaLabel} className="settings-segmented" ref={rootRef}>
      <span aria-hidden="true" className="settings-segmented-indicator" style={indicatorStyle} />
      {options.map((option, index) => (
        <button
          aria-pressed={option.value === value}
          className="settings-segmented-button"
          key={option.value}
          onClick={() => onChange(option.value)}
          ref={(element) => {
            buttonRefs.current[index] = element;
          }}
          type="button"
        >
          {option.icon ? <span className="settings-segmented-icon">{option.icon}</span> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}
