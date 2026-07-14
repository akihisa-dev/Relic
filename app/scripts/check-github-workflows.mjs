import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSON_SCHEMA, load } from "js-yaml";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, "../..");
const workflowDirectory = path.join(repoRoot, ".github/workflows");
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

export function workflowFiles(directory = workflowDirectory) {
  return readdirSync(directory)
    .filter((name) => /\.ya?ml$/u.test(name))
    .sort()
    .map((name) => path.join(directory, name));
}

export function main() {
  const errors = [];
  const files = workflowFiles();
  for (const file of files) {
    const source = path.relative(repoRoot, file);
    try {
      errors.push(...validateWorkflow(parseWorkflow(readFileSync(file, "utf8"), source), source));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${source}: ${String(error)}`);
    }
  }
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
