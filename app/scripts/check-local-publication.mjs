import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const zeroCommit = /^0+$/u;
const publicationScript = "verify:local:push";
const releaseScript = "verify:local:release";

export function parsePrePushUpdates(input) {
  return input
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const fields = line.split(/\s+/u);
      if (fields.length !== 4) {
        throw new Error(`Invalid pre-push update at line ${index + 1}.`);
      }
      const [localRef, localSha, remoteRef, remoteSha] = fields;
      return {
        localRef,
        localSha,
        remoteRef,
        remoteSha
      };
    });
}

export function selectLocalPublicationScript(updates) {
  const activeUpdates = updates.filter(({ localSha }) => !zeroCommit.test(localSha));
  if (activeUpdates.length === 0) return null;
  return activeUpdates.some(({ localRef }) => localRef.startsWith("refs/tags/"))
    ? releaseScript
    : publicationScript;
}

export function assertLocalPublicationState(updates, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const exec = options.exec ?? execFileSync;
  const activeUpdates = updates.filter(({ localSha }) => !zeroCommit.test(localSha));
  if (activeUpdates.length === 0) return;

  const status = exec("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd,
    encoding: "utf8"
  }).trim();
  if (status) {
    throw new Error("Local publication requires a clean working tree.");
  }

  const head = exec("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8"
  }).trim();

  for (const update of activeUpdates) {
    const outgoingCommit = exec("git", ["rev-parse", `${update.localSha}^{commit}`], {
      cwd,
      encoding: "utf8"
    }).trim();
    if (outgoingCommit !== head) {
      throw new Error(`Outgoing ref must point to the checked-out HEAD: ${update.localRef}`);
    }
  }
}

async function main() {
  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  const updates = parsePrePushUpdates(input);
  const script = selectLocalPublicationScript(updates);
  if (!script) return;
  assertLocalPublicationState(updates);
  process.stdout.write(`${script}\n`);
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
