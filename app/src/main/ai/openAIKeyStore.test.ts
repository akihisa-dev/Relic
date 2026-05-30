import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const safeStorageMock = vi.hoisted(() => ({
  decryptString: vi.fn((value: Buffer) => value.toString("utf8")),
  encryptString: vi.fn((value: string) => Buffer.from(value, "utf8")),
  isEncryptionAvailable: vi.fn(() => true)
}));

vi.mock("electron", () => ({
  safeStorage: safeStorageMock
}));

import { deleteOpenAIAPIKey, hasOpenAIAPIKey, readOpenAIAPIKey, saveOpenAIAPIKey } from "./openAIKeyStore";

let userDataPath = "";

beforeEach(async () => {
  userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-ai-key-"));
  vi.clearAllMocks();
  safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
});

afterEach(async () => {
  await rm(userDataPath, { force: true, recursive: true });
});

describe("OpenAI API key store", () => {
  it("encrypts and reads the OpenAI API key outside app-settings.json", async () => {
    await saveOpenAIAPIKey(userDataPath, "sk-test-openai-key-1234567890");

    expect(safeStorageMock.encryptString).toHaveBeenCalledWith("sk-test-openai-key-1234567890");
    await expect(readOpenAIAPIKey(userDataPath)).resolves.toBe("sk-test-openai-key-1234567890");
    await expect(hasOpenAIAPIKey(userDataPath)).resolves.toBe(true);
    await expect(readFile(path.join(userDataPath, "app-settings.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("deletes the saved OpenAI API key", async () => {
    await saveOpenAIAPIKey(userDataPath, "sk-test-openai-key-1234567890");
    await deleteOpenAIAPIKey(userDataPath);

    await expect(readOpenAIAPIKey(userDataPath)).resolves.toBeNull();
  });

  it("rejects saving when secure storage is unavailable", async () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    await expect(saveOpenAIAPIKey(userDataPath, "sk-test-openai-key-1234567890")).rejects.toThrow("安全に保存できません");
  });
});
