import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "../i18n";
import { HakobiBridgeSidebar } from "./HakobiBridgeSidebar";

function renderSidebar(workspacePath: string | null = "/tmp/notes"): void {
  render(
    <I18nProvider language="en">
      <HakobiBridgeSidebar workspacePath={workspacePath} />
    </I18nProvider>
  );
}

describe("HakobiBridgeSidebar", () => {
  it("keeps Hakobi Bridge settings and workbench in its own sidebar", () => {
    renderSidebar();

    expect(screen.getByText("Connection status")).toBeInTheDocument();
    expect(screen.getByText("Hakobi Bridge settings")).toBeInTheDocument();
    expect(screen.getByLabelText("Allowed domain")).toHaveValue("app.ai-constcierge.com");
    expect(screen.getByLabelText("Block admin screens")).toBeChecked();
    expect(screen.getByLabelText("Confirm before sending")).toBeChecked();
    expect(screen.getByText("Workbench")).toBeInTheDocument();
    expect(screen.getByText("Relic change proposal")).toBeInTheDocument();
  });

  it("prepares a response and change proposal entry from the sidebar", () => {
    renderSidebar();

    fireEvent.click(screen.getByLabelText("Use Hakobi Bridge"));
    fireEvent.change(screen.getByLabelText("Send field"), { target: { value: "Summarize this file" } });
    fireEvent.click(screen.getByRole("button", { name: "Send to Hakobi" }));

    expect(screen.getByLabelText("Response display")).toHaveValue("Hakobi Bridge send draft: Summarize this file");

    fireEvent.click(screen.getByRole("button", { name: "Create Relic change proposal" }));
    expect(screen.getByText("The change proposal entry is ready.")).toBeInTheDocument();
  });

  it("requires a workspace before sending to Hakobi", () => {
    renderSidebar(null);

    expect(screen.getByText("Open a workspace to use this.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send to Hakobi" })).toBeDisabled();
  });
});
