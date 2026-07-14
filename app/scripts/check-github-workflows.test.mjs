import { describe, expect, it } from "vitest";

import { parseWorkflow, validateWorkflow } from "./check-github-workflows.mjs";

const validWorkflow = `
name: Verify
on:
  pull_request:
permissions:
  contents: read
concurrency:
  group: verify-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - run: pnpm test
`;

describe("check-github-workflows", () => {
  it("明示した読取権限・concurrency・固定Action参照を受理する", () => {
    expect(validateWorkflow(parseWorkflow(validWorkflow, "valid.yml"), "valid.yml")).toEqual([]);
  });

  it("permissionsとconcurrencyの欠落を報告する", () => {
    const workflow = parseWorkflow(`
name: Missing guards
on: workflow_dispatch
jobs:
  test:
    runs-on: ubuntu-latest
    steps: []
`, "missing.yml");
    expect(validateWorkflow(workflow, "missing.yml")).toEqual([
      "missing.yml: top-level permissions must be explicit.",
      "missing.yml: concurrency group and cancel-in-progress are required.",
    ]);
  });

  it("Pull Requestのwrite権限とcheckout credential保持を拒否する", () => {
    const workflow = parseWorkflow(validWorkflow
      .replace("contents: read", "contents: write")
      .replace("persist-credentials: false", "persist-credentials: true"), "unsafe.yml");
    expect(validateWorkflow(workflow, "unsafe.yml")).toContain(
      "unsafe.yml: pull request workflow grants top-level write permissions: contents.",
    );
    expect(validateWorkflow(workflow, "unsafe.yml")).toContain(
      "unsafe.yml: job test step 1 must set checkout persist-credentials to false.",
    );
  });

  it("mutableなAction参照とpull_request_targetを拒否する", () => {
    const workflow = parseWorkflow(validWorkflow
      .replace("pull_request:", "pull_request_target:")
      .replace("actions/checkout@v7", "actions/checkout@main"), "mutable.yml");
    expect(validateWorkflow(workflow, "mutable.yml")).toContain(
      "mutable.yml: pull_request_target requires a separate explicit security review.",
    );
    expect(validateWorkflow(workflow, "mutable.yml")).toContain(
      "mutable.yml: job test step 1 uses a missing or mutable Action reference: actions/checkout@main.",
    );
  });
});
