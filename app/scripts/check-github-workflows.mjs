import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSON_SCHEMA, load } from "js-yaml";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, "../..");
const workflowDirectory = path.join(repoRoot, ".github/workflows");
const packagePath = path.join(repoRoot, "app/package.json");
const writePermissionNames = new Set([
  "actions",
  "attestations",
  "checks",
  "contents",
  "deployments",
  "discussions",
  "id-token",
  "issues",
  "packages",
  "pages",
  "pull-requests",
  "repository-projects",
  "security-events",
  "statuses",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function workflowTriggers(workflow) {
  const trigger = workflow.on;
  if (typeof trigger === "string") return new Set([trigger]);
  if (Array.isArray(trigger)) return new Set(trigger);
  if (isObject(trigger)) return new Set(Object.keys(trigger));
  return new Set();
}

function writePermissions(permissions) {
  if (!isObject(permissions)) return [];
  return Object.entries(permissions)
    .filter(([name, access]) => writePermissionNames.has(name) && access === "write")
    .map(([name]) => name);
}

function supportedNodeMajors(packageJson) {
  const range = packageJson.engines?.node;
  const match = /^>=(\d+)\s+<(\d+)$/u.exec(range ?? "");
  if (!match || Number(match[2]) <= Number(match[1])) return null;
  return { maximumExclusive: Number(match[2]), minimum: Number(match[1]) };
}

function workflowCommands(workflow) {
  return Object.values(workflow.jobs ?? {}).flatMap((job) =>
    Array.isArray(job?.steps)
      ? job.steps.map((step) => typeof step?.run === "string" ? step.run : "")
      : []);
}

export function parseWorkflow(content, source = "workflow") {
  const parsed = load(content, { schema: JSON_SCHEMA });
  if (!isObject(parsed)) throw new Error(`${source}: workflow root must be a mapping.`);
  return parsed;
}

export function validateWorkflow(workflow, source = "workflow") {
  const errors = [];
  const triggers = workflowTriggers(workflow);
  if (typeof workflow.name !== "string" || workflow.name.trim() === "") {
    errors.push(`${source}: name is required.`);
  }
  if (triggers.size === 0) errors.push(`${source}: on trigger is required.`);
  if (!isObject(workflow.permissions)) {
    errors.push(`${source}: top-level permissions must be explicit.`);
  }
  if (!isObject(workflow.concurrency)
    || typeof workflow.concurrency.group !== "string"
    || !(typeof workflow.concurrency["cancel-in-progress"] === "boolean"
      || typeof workflow.concurrency["cancel-in-progress"] === "string")) {
    errors.push(`${source}: concurrency group and cancel-in-progress are required.`);
  }
  if (!isObject(workflow.jobs) || Object.keys(workflow.jobs).length === 0) {
    errors.push(`${source}: jobs are required.`);
    return errors;
  }

  const pullRequestWorkflow = triggers.has("pull_request") || triggers.has("pull_request_target");
  if (triggers.has("pull_request_target")) {
    errors.push(`${source}: pull_request_target requires a separate explicit security review.`);
  }
  const topLevelWrites = writePermissions(workflow.permissions);
  if (pullRequestWorkflow && topLevelWrites.length > 0) {
    errors.push(`${source}: pull request workflow grants top-level write permissions: ${topLevelWrites.join(", ")}.`);
  }

  for (const [jobName, job] of Object.entries(workflow.jobs)) {
    if (!isObject(job)) {
      errors.push(`${source}: job ${jobName} must be a mapping.`);
      continue;
    }
    const jobWrites = writePermissions(job.permissions);
    if (pullRequestWorkflow && jobWrites.length > 0) {
      errors.push(`${source}: pull request job ${jobName} grants write permissions: ${jobWrites.join(", ")}.`);
    }
    if (!Array.isArray(job.steps)) continue;

    for (const [stepIndex, step] of job.steps.entries()) {
      if (!isObject(step) || typeof step.uses !== "string") continue;
      const location = `${source}: job ${jobName} step ${stepIndex + 1}`;
      if (!step.uses.startsWith("./") && !step.uses.startsWith("docker://")) {
        const separator = step.uses.lastIndexOf("@");
        const reference = separator >= 0 ? step.uses.slice(separator + 1) : "";
        if (separator <= 0 || reference === "" || /^(HEAD|main|master)$/iu.test(reference)) {
          errors.push(`${location} uses a missing or mutable Action reference: ${step.uses}.`);
        }
      }
      if (step.uses.startsWith("actions/checkout@")) {
        const persistCredentials = isObject(step.with) ? step.with["persist-credentials"] : undefined;
        if (persistCredentials !== false && persistCredentials !== "false") {
          errors.push(`${location} must set checkout persist-credentials to false.`);
        }
      }
    }
  }
  return errors;
}

export function validateRepositoryWorkflowPolicy(workflows, packageJson) {
  const errors = [];
  const supportedNodeVersions = supportedNodeMajors(packageJson);
  if (supportedNodeVersions === null) {
    errors.push("app/package.json: engines.node must define a bounded Node.js major range.");
  }
  if (!/^pnpm@\d+\.\d+\.\d+$/u.test(packageJson.packageManager ?? "")) {
    errors.push("app/package.json: packageManager must pin an exact pnpm version.");
  }

  for (const [source, workflow] of workflows) {
    for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
      if (!Array.isArray(job?.steps)) continue;
      const setupNodeSteps = job.steps.filter((step) => step?.uses?.startsWith("actions/setup-node@"));
      for (const step of setupNodeSteps) {
        const actualMajor = Number(step.with?.["node-version"]);
        if (supportedNodeVersions !== null
          && !(actualMajor >= supportedNodeVersions.minimum
            && actualMajor < supportedNodeVersions.maximumExclusive)) {
          errors.push(`${source}: job ${jobName} Node.js ${step.with?.["node-version"] ?? "missing"} is outside app/package.json engines.node.`);
        }
      }
      const commands = job.steps.map((step) => typeof step?.run === "string" ? step.run : "");
      const installIndex = commands.findIndex((command) => command.includes("pnpm install"));
      if (installIndex >= 0) {
        if (!commands[installIndex].includes("--frozen-lockfile")) {
          errors.push(`${source}: job ${jobName} must install with --frozen-lockfile.`);
        }
        if (!commands.slice(0, installIndex).some((command) => command.includes("corepack enable"))) {
          errors.push(`${source}: job ${jobName} must enable Corepack before pnpm install.`);
        }
      }
    }
  }

  const codeCi = workflows.get(".github/workflows/ci.yml");
  if (!codeCi || !workflowTriggers(codeCi).has("push")
    || !codeCi.on?.push?.branches?.includes("main")) {
    errors.push(".github/workflows/ci.yml: Code CI must run for pushes to main.");
  } else if (!workflowCommands(codeCi).some((command) => command.includes("pnpm verify:ci"))) {
    errors.push(".github/workflows/ci.yml: Code CI must run pnpm verify:ci.");
  } else if (!workflowCommands(codeCi).some((command) => command.includes("pnpm smoke:electron"))) {
    errors.push(".github/workflows/ci.yml: Code CI must run the development Electron smoke.");
  } else if (!workflowCommands(codeCi).some((command) => (
    command.includes("chrome-sandbox") && command.includes("chmod 4755")
  ))) {
    errors.push(".github/workflows/ci.yml: Code CI must configure the Electron sandbox helper before startup smoke.");
  }

  const preRelease = workflows.get(".github/workflows/pre-release-verification.yml");
  if (!preRelease || workflowTriggers(preRelease).size !== 1
    || !workflowTriggers(preRelease).has("workflow_dispatch")) {
    errors.push(".github/workflows/pre-release-verification.yml: pre-release verification must be manual-only.");
  }
  const draftRelease = workflows.get(".github/workflows/draft-release.yml");
  for (const command of ["pnpm build:mac:safe", "pnpm build:win:safe"]) {
    if (!preRelease || !workflowCommands(preRelease).some((entry) => entry.includes(command))) {
      errors.push(`.github/workflows/pre-release-verification.yml: missing shared safe build command ${command}.`);
    }
    if (!draftRelease || !workflowCommands(draftRelease).some((entry) => entry.includes(command))) {
      errors.push(`.github/workflows/draft-release.yml: missing shared safe build command ${command}.`);
    }
  }
  for (const [source, workflow] of [
    [".github/workflows/pre-release-verification.yml", preRelease],
    [".github/workflows/draft-release.yml", draftRelease]
  ]) {
    for (const [jobName, job] of Object.entries(workflow?.jobs ?? {})) {
      const commands = Array.isArray(job?.steps)
        ? job.steps.map((step) => typeof step?.run === "string" ? step.run : "")
        : [];
      if (commands.some((command) => command.includes("pnpm build:") && command.includes(":safe"))
        && !commands.some((command) => command.includes("pnpm smoke:package"))) {
        errors.push(`${source}: package build job ${jobName} must run the package Electron smoke.`);
      }
    }
  }
  return errors;
}

export function workflowFiles(directory = workflowDirectory) {
  return readdirSync(directory)
    .filter((name) => /\.ya?ml$/u.test(name))
    .sort()
    .map((name) => path.join(directory, name));
}

export function main() {
  const errors = [];
  const files = workflowFiles();
  const workflows = new Map();
  for (const file of files) {
    const source = path.relative(repoRoot, file);
    try {
      const workflow = parseWorkflow(readFileSync(file, "utf8"), source);
      workflows.set(source, workflow);
      errors.push(...validateWorkflow(workflow, source));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${source}: ${String(error)}`);
    }
  }
  errors.push(...validateRepositoryWorkflowPolicy(
    workflows,
    JSON.parse(readFileSync(packagePath, "utf8"))
  ));
  if (errors.length > 0) {
    console.error("GitHub workflow validation failed.");
    for (const error of errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`GitHub workflows are valid (${files.length} files).`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exitCode = main();
}
