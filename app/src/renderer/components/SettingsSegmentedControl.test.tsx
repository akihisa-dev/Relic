import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsSegmentedControl } from "./SettingsSegmentedControl";

const options = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" }
] as const;

describe("SettingsSegmentedControl", () => {
  it("選択項目の実際の位置と幅へピルを追従させる", () => {
    const { container, rerender } = render(
      <SettingsSegmentedControl
        ariaLabel="Theme"
        onChange={vi.fn()}
        options={[...options]}
        value="system"
      />
    );
    const lightButton = screen.getByRole("button", { name: "Light" });
    Object.defineProperty(lightButton, "offsetLeft", { configurable: true, value: 72 });
    Object.defineProperty(lightButton, "offsetWidth", { configurable: true, value: 54 });

    rerender(
      <SettingsSegmentedControl
        ariaLabel="Theme"
        onChange={vi.fn()}
        options={[...options]}
        value="light"
      />
    );

    expect(container.querySelector(".settings-segmented-indicator")).toHaveStyle({ left: "72px", width: "54px" });
    expect(lightButton).toHaveAttribute("aria-pressed", "true");
  });
});
