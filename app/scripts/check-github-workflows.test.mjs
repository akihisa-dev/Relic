import { describe, expect, it } from "vitest";

import {
  parseWorkflow,
  validateDraftReleaseWorkflowPolicy,
  validateRepositoryWorkflowPolicy,
  validateWorkflow
} from "./check-github-workflows.mjs";

const checkoutSha = "3d3c42e5aac5ba805825da76410c181273ba90b1";
const setupNodeSha = "249970729cb0ef3589644e2896645e5dc5ba9c38";

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
      - uses: actions/checkout@${checkoutSha}
        with:
          persist-credentials: false
      - run: pnpm test
`;

const validDraftReleaseWorkflow = `
name: Draft Release
on:
  push:
    tags:
      - "*"
permissions:
  contents: read
concurrency:
  group: draft-release-\${{ github.ref }}
  cancel-in-progress: false
jobs:
  validate-release-tag:
    runs-on: ubuntu-latest
    steps:
      - run: test "$GITHUB_REF_TYPE" = tag && test "$GITHUB_REF_NAME" = "$(node -p \"require('./app/package.json').version\")"
  verify-release-dependencies:
    needs: validate-release-tag
    runs-on: ubuntu-latest
    steps:
      - run: pnpm licenses:check
  build-macos:
    needs: verify-release-dependencies
    runs-on: macos-latest
    steps:
      - run: test "$(uname -m)" = arm64
      - run: pnpm build:mac:safe
      - run: pnpm smoke:package
  draft-release:
    needs: build-macos
    runs-on: ubuntu-latest
    environment: release
    steps:
      - run: test "$GITHUB_REF_TYPE" = tag && test "$TAG_NAME" = "$(node -p \"require('./app/package.json').version\")"
      - run: >-
          gh release upload "$TAG_NAME"
          release-assets/Relic-macOS-arm64.dmg
          release-assets/Relic-macOS-arm64.dmg.sha256
          THIRD_PARTY_NOTICES.md
          sbom/relic-dependencies.cdx.json
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
      .replace(`actions/checkout@${checkoutSha}`, "actions/checkout@v7"), "mutable.yml");
    expect(validateWorkflow(workflow, "mutable.yml")).toContain(
      "mutable.yml: pull_request_target requires a separate explicit security review.",
    );
    expect(validateWorkflow(workflow, "mutable.yml")).toContain(
      "mutable.yml: job test step 1 uses a missing or mutable Action reference: actions/checkout@v7.",
    );
  });

  it("完全な40桁SHA以外のAction参照を拒否する", () => {
    const workflow = parseWorkflow(validWorkflow
      .replace(`actions/checkout@${checkoutSha}`, "actions/checkout@main"), "mutable-branch.yml");
    expect(validateWorkflow(workflow, "mutable-branch.yml")).toContain(
      "mutable-branch.yml: job test step 1 uses a missing or mutable Action reference: actions/checkout@main."
    );

    const tagWorkflow = parseWorkflow(validWorkflow
      .replace(`actions/checkout@${checkoutSha}`, "actions/checkout@v7"), "mutable-tag.yml");
    expect(validateWorkflow(tagWorkflow, "mutable-tag.yml")).toContain(
      "mutable-tag.yml: job test step 1 uses a missing or mutable Action reference: actions/checkout@v7."
    );
  });

  it("Node.js正本、main CI、手動配布事前検証、安全ビルドの整合を確認する", () => {
    const workflow = (name, trigger, command) => parseWorkflow(`
name: ${name}
on:
  ${trigger}:
permissions:
  contents: read
concurrency:
  group: ${name}-\${{ github.ref }}
  cancel-in-progress: false
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@${setupNodeSha}
        with:
          node-version: 22
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: ${command}
`);
    const codeCi = workflow("Code CI", "push", "pnpm committed-diff:check -- base head && pnpm verify:ci && pnpm smoke:electron");
    codeCi.on.push = { branches: ["main"] };
    codeCi.jobs.verify["runs-on"] = "macos-latest";
    const workflows = new Map([
      [".github/workflows/ci.yml", codeCi],
      [".github/workflows/pre-release-verification.yml", workflow("Pre-release", "workflow_dispatch", "test \"$(uname -m)\" = arm64 && pnpm build:mac:safe && pnpm smoke:package")],
      [".github/workflows/draft-release.yml", parseWorkflow(validDraftReleaseWorkflow)]
    ]);

    expect(validateRepositoryWorkflowPolicy(workflows, {
      engines: { node: ">=22 <27" },
      packageManager: "pnpm@10.10.0"
    })).toEqual([]);
  });

  it("古いNode.jsと安全でない依存導入を報告する", () => {
    const unsafe = parseWorkflow(`
name: Unsafe
on: workflow_dispatch
permissions:
  contents: read
concurrency:
  group: unsafe
  cancel-in-progress: false
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version: 20
      - run: pnpm install
`);
    const errors = validateRepositoryWorkflowPolicy(new Map([
      [".github/workflows/ci.yml", unsafe],
      [".github/workflows/pre-release-verification.yml", unsafe],
      [".github/workflows/draft-release.yml", unsafe]
    ]), {
      engines: { node: ">=22 <27" },
      packageManager: "pnpm@10.10.0"
    });

    expect(errors).toContain(".github/workflows/ci.yml: job verify Node.js 20 is outside app/package.json engines.node.");
    expect(errors).toContain(".github/workflows/ci.yml: job verify must install with --frozen-lockfile.");
    expect(errors).toContain(".github/workflows/ci.yml: job verify must enable Corepack before pnpm install.");
  });

  it("packageを作るjobに起動スモークがない場合は報告する", () => {
    const packageWorkflow = parseWorkflow(`
name: Package
on: workflow_dispatch
permissions:
  contents: read
concurrency:
  group: package
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm build:mac:safe
`);
    const errors = validateRepositoryWorkflowPolicy(new Map([
      [".github/workflows/ci.yml", packageWorkflow],
      [".github/workflows/pre-release-verification.yml", packageWorkflow],
      [".github/workflows/draft-release.yml", packageWorkflow]
    ]), {
      engines: { node: ">=22 <27" },
      packageManager: "pnpm@10.10.0"
    });

    expect(errors).toContain(
      ".github/workflows/pre-release-verification.yml: package build job build must run the package Electron smoke."
    );
    expect(errors).toContain(
      ".github/workflows/draft-release.yml: package build job build must run the package Electron smoke."
    );
  });

  it("Draft ReleaseにDMGとchecksumがない場合は報告する", () => {
    const workflow = parseWorkflow(validDraftReleaseWorkflow);
    const uploadStep = workflow.jobs["draft-release"].steps[1];
    uploadStep.run = uploadStep.run
      .replace("release-assets/Relic-macOS-arm64.dmg.sha256", "")
      .replace("release-assets/Relic-macOS-arm64.dmg", "");
    const errors = validateDraftReleaseWorkflowPolicy(workflow);

    expect(errors).toContain(
      ".github/workflows/draft-release.yml: draft-release job must upload release-assets/Relic-macOS-arm64.dmg."
    );
    expect(errors).toContain(
      ".github/workflows/draft-release.yml: draft-release job must upload release-assets/Relic-macOS-arm64.dmg.sha256."
    );
  });

  it("ドラフト配布の書込jobがrelease環境を経由しない場合は報告する", () => {
    const draftWorkflow = parseWorkflow(`
name: Draft
on: push
permissions:
  contents: read
concurrency:
  group: draft
  cancel-in-progress: false
jobs:
  draft-release:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: gh release upload
`, "draft-release.yml");
    const errors = validateRepositoryWorkflowPolicy(new Map([
      [".github/workflows/draft-release.yml", draftWorkflow]
    ]), {
      engines: { node: ">=22 <27" },
      packageManager: "pnpm@10.10.0"
    });

    expect(errors).toContain(
      ".github/workflows/draft-release.yml: draft-release job must use the protected release environment."
    );
  });

  it("arm64確認より先にmacOS buildを実行するjobを報告する", () => {
    const packageWorkflow = parseWorkflow(`
name: Package
on: workflow_dispatch
permissions:
  contents: read
concurrency:
  group: package
  cancel-in-progress: false
jobs:
  build:
    runs-on: macos-latest
    steps:
      - run: pnpm build:mac:safe
      - run: test "$(uname -m)" = arm64
      - run: pnpm smoke:package
`);
    const errors = validateRepositoryWorkflowPolicy(new Map([
      [".github/workflows/ci.yml", packageWorkflow],
      [".github/workflows/pre-release-verification.yml", packageWorkflow],
      [".github/workflows/draft-release.yml", packageWorkflow]
    ]), {
      engines: { node: ">=22 <27" },
      packageManager: "pnpm@10.10.0"
    });

    expect(errors).toContain(
      ".github/workflows/pre-release-verification.yml: job build must verify an arm64 runner before pnpm build:mac:safe."
    );
    expect(errors).toContain(
      ".github/workflows/draft-release.yml: job build must verify an arm64 runner before pnpm build:mac:safe."
    );
  });

  it("現行Release Checklistのtag・版数・添付条件を満たすfixtureを受理する", () => {
    expect(validateDraftReleaseWorkflowPolicy(
      parseWorkflow(validDraftReleaseWorkflow)
    )).toEqual([]);
  });

  it.each([
    {
      expected: ".github/workflows/draft-release.yml: Draft Release must run only for tag pushes.",
      mutate(workflow) {
        workflow.on.push.branches = ["main"];
      },
      name: "tag限定trigger"
    },
    {
      expected: ".github/workflows/draft-release.yml: validate-release-tag job must compare the pushed tag with app/package.json version.",
      mutate(workflow) {
        workflow.jobs["validate-release-tag"].steps[0].run = "test \"$GITHUB_REF_TYPE\" = tag";
      },
      name: "package versionとのtag照合"
    },
    {
      expected: ".github/workflows/draft-release.yml: verify-release-dependencies job must check the SBOM and third-party notices with pnpm licenses:check.",
      mutate(workflow) {
        workflow.jobs["verify-release-dependencies"].steps = [];
      },
      name: "SBOMと第三者通知書の生成確認"
    },
    {
      expected: ".github/workflows/draft-release.yml: draft-release job must recheck the tag ref and app/package.json version before writing.",
      mutate(workflow) {
        workflow.jobs["draft-release"].steps.shift();
      },
      name: "Release書込直前のtag再照合"
    },
    {
      expected: ".github/workflows/draft-release.yml: draft-release job must upload THIRD_PARTY_NOTICES.md.",
      mutate(workflow) {
        workflow.jobs["draft-release"].steps[1].run = workflow.jobs["draft-release"].steps[1].run
          .replace("THIRD_PARTY_NOTICES.md", "");
      },
      name: "第三者通知書upload"
    },
    {
      expected: ".github/workflows/draft-release.yml: draft-release job must upload sbom/relic-dependencies.cdx.json.",
      mutate(workflow) {
        workflow.jobs["draft-release"].steps[1].run = workflow.jobs["draft-release"].steps[1].run
          .replace("sbom/relic-dependencies.cdx.json", "");
      },
      name: "SBOM upload"
    }
  ])("$name stepの欠落をfixtureで検出する", ({ expected, mutate }) => {
    const workflow = parseWorkflow(validDraftReleaseWorkflow);
    mutate(workflow);

    expect(validateDraftReleaseWorkflowPolicy(workflow)).toContain(expected);
  });
});
