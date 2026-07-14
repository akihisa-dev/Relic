import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.resolve(scriptDirectory, "../package.json");

export function supportedNodeMajors(engineRange) {
  const match = /^>=(\d+)\s+<(\d+)$/u.exec(engineRange?.trim() ?? "");
  if (!match || Number(match[2]) <= Number(match[1])) {
    throw new Error(`app/package.json engines.node must use a bounded major range such as \">=22 <27\". Actual: ${engineRange ?? "missing"}`);
  }
  return { maximumExclusive: Number(match[2]), minimum: Number(match[1]) };
}

export function validateNodeRuntime(engineRange, nodeVersion = process.versions.node) {
  const supported = supportedNodeMajors(engineRange);
  const actualMajor = Number(nodeVersion.split(".")[0]);
  if (actualMajor >= supported.minimum && actualMajor < supported.maximumExclusive) return;
  throw new Error([
    `Unsupported Node.js v${nodeVersion}.`,
    `Relic development requires ${engineRange}.`,
    "Run `node --version`, switch Node.js, then run `corepack enable` and `pnpm install` again."
  ].join(" "));
}

export async function readRuntimePolicy() {
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  return {
    nodeEngine: packageJson.engines?.node,
    packageManager: packageJson.packageManager
  };
}

async function main() {
  const policy = await readRuntimePolicy();
  validateNodeRuntime(policy.nodeEngine);
  if (!/^pnpm@\d+\.\d+\.\d+$/u.test(policy.packageManager ?? "")) {
    throw new Error("app/package.json packageManager must pin pnpm with an exact version.");
  }
  console.log(`Runtime policy passed: Node.js ${process.versions.node}, ${policy.packageManager}.`);
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
