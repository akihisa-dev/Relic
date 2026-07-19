import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writePrivateSettingsTextFile } from "./secureSettingsFile";
import {
  type SecureVersionedJsonCodec,
  SecureVersionedJsonStore
} from "./secureVersionedJsonStore";

interface TestSettings {
  value: number;
}

const testCodec: SecureVersionedJsonCodec<TestSettings, TestSettings> = {
  createCorruptError: () => new Error("設定ファイルが壊れています。"),
  createDefaultValue: () => ({ value: 0 }),
  migrate: (raw) => ({ didMigrate: false, settings: raw }),
  parse: (raw) => raw,
  parseObject: (raw) => (
    typeof raw === "object"
    && raw !== null
    && "value" in raw
    && typeof raw.value === "number"
      ? { value: raw.value }
      : null
  ),
  serialize: (value) => value
};

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {
    promise,
    resolve: () => resolve?.()
  };
}

describe("SecureVersionedJsonStore", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryPaths.splice(0).map((temporaryPath) => rm(temporaryPath, {
      force: true,
      recursive: true
    })));
  });

  async function createSettingsPath(name = "settings.json"): Promise<string> {
    const temporaryPath = await mkdtemp(path.join(os.tmpdir(), "relic-versioned-store-"));
    temporaryPaths.push(temporaryPath);
    return path.join(temporaryPath, name);
  }

  async function readValue(settingsPath: string): Promise<number> {
    return (JSON.parse(await readFile(settingsPath, "utf8")) as TestSettings).value;
  }

  it("設定ファイルがない場合は読み込みごとに独立した既定値を返す", async () => {
    const settingsPath = await createSettingsPath();
    const store = new SecureVersionedJsonStore(testCodec);

    const first = await store.read(settingsPath);
    first.value = 99;
    const second = await store.read(settingsPath);

    expect(second).toEqual({ value: 0 });
    expect(second).not.toBe(first);
  });

  it("同じ設定パスへのwriteを開始順に直列化する", async () => {
    const settingsPath = await createSettingsPath();
    const firstWriteStarted = deferred();
    const releaseFirstWrite = deferred();
    let writeCount = 0;
    const store = new SecureVersionedJsonStore(testCodec, async (filePath, content) => {
      writeCount += 1;
      if (writeCount === 1) {
        firstWriteStarted.resolve();
        await releaseFirstWrite.promise;
      }
      await writePrivateSettingsTextFile(filePath, content);
    });

    const firstWrite = store.write(settingsPath, { value: 1 });
    await firstWriteStarted.promise;
    const secondWrite = store.write(settingsPath, { value: 2 });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(writeCount).toBe(1);
    releaseFirstWrite.resolve();
    await Promise.all([firstWrite, secondWrite]);
    await expect(readValue(settingsPath)).resolves.toBe(2);
  });

  it("同じ設定パスへのwrite完了後にupdateを実行する", async () => {
    const settingsPath = await createSettingsPath();
    await writePrivateSettingsTextFile(settingsPath, "{\"value\":0}\n");
    const firstWriteStarted = deferred();
    const releaseFirstWrite = deferred();
    let writeCount = 0;
    const store = new SecureVersionedJsonStore(testCodec, async (filePath, content) => {
      writeCount += 1;
      if (writeCount === 1) {
        firstWriteStarted.resolve();
        await releaseFirstWrite.promise;
      }
      await writePrivateSettingsTextFile(filePath, content);
    });

    const write = store.write(settingsPath, { value: 1 });
    await firstWriteStarted.promise;
    const update = store.update(settingsPath, (current) => ({ value: current.value + 10 }));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(writeCount).toBe(1);
    releaseFirstWrite.resolve();
    await Promise.all([write, update]);
    await expect(readValue(settingsPath)).resolves.toBe(11);
  });

  it("同じ設定パスへのupdate完了後にwriteを実行する", async () => {
    const settingsPath = await createSettingsPath();
    await writePrivateSettingsTextFile(settingsPath, "{\"value\":0}\n");
    const updateStarted = deferred();
    const releaseUpdate = deferred();
    let writeCount = 0;
    const store = new SecureVersionedJsonStore(testCodec, async (filePath, content) => {
      writeCount += 1;
      await writePrivateSettingsTextFile(filePath, content);
    });

    const update = store.update(settingsPath, async (current) => {
      updateStarted.resolve();
      await releaseUpdate.promise;
      return { value: current.value + 10 };
    });
    await updateStarted.promise;
    const write = store.write(settingsPath, { value: 2 });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(writeCount).toBe(0);
    releaseUpdate.resolve();
    await Promise.all([update, write]);
    expect(writeCount).toBe(2);
    await expect(readValue(settingsPath)).resolves.toBe(2);
  });

  it("異なる設定パスへのwriteは互いの完了を待たない", async () => {
    const firstPath = await createSettingsPath("first.json");
    const secondPath = await createSettingsPath("second.json");
    const firstWriteStarted = deferred();
    const releaseFirstWrite = deferred();
    const store = new SecureVersionedJsonStore(testCodec, async (filePath, content) => {
      if (filePath === firstPath) {
        firstWriteStarted.resolve();
        await releaseFirstWrite.promise;
      }
      await writePrivateSettingsTextFile(filePath, content);
    });

    const firstWrite = store.write(firstPath, { value: 1 });
    await firstWriteStarted.promise;
    const secondWrite = store.write(secondPath, { value: 2 });

    await secondWrite;
    await expect(readValue(secondPath)).resolves.toBe(2);
    releaseFirstWrite.resolve();
    await firstWrite;
  });

  it("先行writeが失敗しても同じ設定パスの後続writeを実行する", async () => {
    const settingsPath = await createSettingsPath();
    const firstWriteStarted = deferred();
    const releaseFirstWrite = deferred();
    let writeCount = 0;
    const store = new SecureVersionedJsonStore(testCodec, async (filePath, content) => {
      writeCount += 1;
      if (writeCount === 1) {
        firstWriteStarted.resolve();
        await releaseFirstWrite.promise;
        throw new Error("意図した書き込み失敗");
      }
      await writePrivateSettingsTextFile(filePath, content);
    });

    const firstWrite = store.write(settingsPath, { value: 1 });
    await firstWriteStarted.promise;
    const secondWrite = store.write(settingsPath, { value: 2 });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(writeCount).toBe(1);
    releaseFirstWrite.resolve();
    await expect(firstWrite).rejects.toThrow("意図した書き込み失敗");
    await secondWrite;
    expect(writeCount).toBe(2);
    await expect(readValue(settingsPath)).resolves.toBe(2);
  });
});
