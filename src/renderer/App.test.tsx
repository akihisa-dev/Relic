import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the phase 0 two-column shell", async () => {
    window.relic = {
      getAppInfo: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          name: "Relic",
          platform: "darwin",
          version: "0.0.0"
        }
      })
    };

    render(<App />);

    expect(screen.getByRole("navigation", { name: "ビュー切り替え" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ファイル" })).toBeInTheDocument();
    expect(await screen.findByText("IPC: Relic 0.0.0 / darwin")).toBeInTheDocument();
  });
});
