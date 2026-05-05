import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const githubKeychainService = "Relic GitHub OAuth";
const githubKeychainAccount = "default";

export interface StoredGitHubAuth {
  accessToken: string;
  login: string;
  scopes: string[];
  tokenType: string;
}

export async function readGitHubAuthFromKeychain(): Promise<StoredGitHubAuth | null> {
  try {
    const { stdout } = await execFileAsync("/usr/bin/security", [
      "find-generic-password",
      "-s",
      githubKeychainService,
      "-a",
      githubKeychainAccount,
      "-w"
    ]);

    return parseStoredGitHubAuth(stdout);
  } catch (error) {
    if (isMissingKeychainItem(error)) {
      return null;
    }

    throw error;
  }
}

export async function saveGitHubAuthToKeychain(auth: StoredGitHubAuth): Promise<void> {
  await execFileAsync("/usr/bin/security", [
    "add-generic-password",
    "-U",
    "-s",
    githubKeychainService,
    "-a",
    githubKeychainAccount,
    "-w",
    JSON.stringify(auth)
  ]);
}

export async function deleteGitHubAuthFromKeychain(): Promise<void> {
  try {
    await execFileAsync("/usr/bin/security", [
      "delete-generic-password",
      "-s",
      githubKeychainService,
      "-a",
      githubKeychainAccount
    ]);
  } catch (error) {
    if (isMissingKeychainItem(error)) {
      return;
    }

    throw error;
  }
}

function parseStoredGitHubAuth(raw: string): StoredGitHubAuth {
  const parsed = JSON.parse(raw) as Partial<StoredGitHubAuth>;

  if (
    typeof parsed.accessToken !== "string" ||
    typeof parsed.login !== "string" ||
    !Array.isArray(parsed.scopes) ||
    parsed.scopes.some((scope) => typeof scope !== "string") ||
    typeof parsed.tokenType !== "string"
  ) {
    throw new Error("GitHub認証情報の形式が不正です。");
  }

  return {
    accessToken: parsed.accessToken,
    login: parsed.login,
    scopes: parsed.scopes,
    tokenType: parsed.tokenType
  };
}

function isMissingKeychainItem(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: number; stderr?: string };

  return candidate.code === 44 || candidate.stderr?.includes("could not be found") === true;
}
