import { chmod, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { safeStorage } from "electron";

import { atomicWriteTextFile } from "../files/atomicWrite";

interface StoredOpenAIKey {
  encryptedKey: string;
  savedAt: string;
}

const credentialsFileName = "ai-openai-key.json";
let chmodCredentialFile = chmod;

export function isOpenAIKeyStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export async function hasOpenAIAPIKey(userDataPath: string): Promise<boolean> {
  return (await readOpenAIAPIKey(userDataPath)) !== null;
}

export async function readOpenAIAPIKey(userDataPath: string): Promise<string | null> {
  if (!isOpenAIKeyStorageAvailable()) return null;

  try {
    const raw = await readFile(getOpenAIKeyPath(userDataPath), "utf8");
    const parsed = parseStoredKey(raw);
    if (!parsed) return null;

    return safeStorage.decryptString(Buffer.from(parsed.encryptedKey, "base64"));
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

export async function saveOpenAIAPIKey(userDataPath: string, apiKey: string): Promise<void> {
  if (!isOpenAIKeyStorageAvailable()) {
    throw new Error("この環境ではAPIキーを安全に保存できません。");
  }

  const trimmedKey = apiKey.trim();
  if (!isPlausibleOpenAIAPIKey(trimmedKey)) {
    throw new Error("OpenAI APIキーの形式を確認してください。");
  }

  const encryptedKey = safeStorage.encryptString(trimmedKey).toString("base64");
  const storedKey: StoredOpenAIKey = {
    encryptedKey,
    savedAt: new Date().toISOString()
  };

  const filePath = getOpenAIKeyPath(userDataPath);
  await mkdir(userDataPath, { recursive: true });
  await atomicWriteTextFile(filePath, `${JSON.stringify(storedKey, null, 2)}\n`);
  await restrictCredentialFilePermissions(filePath);
}

export async function deleteOpenAIAPIKey(userDataPath: string): Promise<void> {
  await rm(getOpenAIKeyPath(userDataPath), { force: true });
}

function getOpenAIKeyPath(userDataPath: string): string {
  return path.join(userDataPath, credentialsFileName);
}

async function restrictCredentialFilePermissions(filePath: string): Promise<void> {
  if (process.platform === "win32") return;

  try {
    await chmodCredentialFile(filePath, 0o600);
  } catch {
    // 保存自体は成功しているため、権限変更に失敗してもAPIキー保存は失敗扱いにしない。
  }
}

export function setOpenAIKeyStoreChmodForTest(chmodFile: typeof chmod): () => void {
  const previousChmodCredentialFile = chmodCredentialFile;
  chmodCredentialFile = chmodFile;

  return () => {
    chmodCredentialFile = previousChmodCredentialFile;
  };
}

function parseStoredKey(raw: string): StoredOpenAIKey | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.encryptedKey !== "string" || typeof record.savedAt !== "string") return null;

    return {
      encryptedKey: record.encryptedKey,
      savedAt: record.savedAt
    };
  } catch {
    return null;
  }
}

function isPlausibleOpenAIAPIKey(value: string): boolean {
  return value.startsWith("sk-") && value.length >= 24 && !/\s/.test(value);
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
