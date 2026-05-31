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

import { deleteOpenAIAPIKey, hasOpenAIAPIKey, readOpenAIAPIKey, saveOpenAIAPIKey, setOpenAIKeyStoreChmodForTest } from "./openAIKeyStore";

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

  it("restricts the saved OpenAI API key file permissions outside Windows", async () => {
    const chmodMock = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const restoreChmod = setOpenAIKeyStoreChmodForTest(chmodMock);

    try {
      await saveOpenAIAPIKey(userDataPath, "sk-test-openai-key-1234567890");

      if (process.platform === "win32") {
        expect(chmodMock).not.toHaveBeenCalled();
      } else {
        expect(chmodMock).toHaveBeenCalledWith(path.join(userDataPath, "ai-openai-key.json"), 0o600);
      }
    } finally {
      restoreChmod();
    }
  });

  it("saves the OpenAI API key even when restricting file permissions fails", async () => {
    const restoreChmod = setOpenAIKeyStoreChmodForTest(vi.fn<() => Promise<void>>(() => Promise.reject(new Error("chmod failed"))));

    try {
      await expect(saveOpenAIAPIKey(userDataPath, "sk-test-openai-key-1234567890")).resolves.toBeUndefined();
      await expect(readOpenAIAPIKey(userDataPath)).resolves.toBe("sk-test-openai-key-1234567890");
    } finally {
      restoreChmod();
    }
  });

  it("skips restricting the saved OpenAI API key file permissions on Windows", async () => {
    const originalPlatform = process.platform;
    const chmodMock = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const restoreChmod = setOpenAIKeyStoreChmodForTest(chmodMock);
    Object.defineProperty(process, "platform", { value: "win32" });

    try {
      await saveOpenAIAPIKey(userDataPath, "sk-test-openai-key-1234567890");
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform });
      restoreChmod();
    }

    expect(chmodMock).not.toHaveBeenCalled();
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
