import { readFile, rename } from "node:fs/promises";
import path from "node:path";

import { writePrivateSettingsTextFile } from "./secureSettingsFile";

export interface SettingsMigrationResult<TRaw> {
  didMigrate: boolean;
  settings: TRaw;
}

export interface SecureVersionedJsonCodec<TRaw extends object, TValue> {
  createCorruptError: (settingsPath: string) => Error;
  defaultValue: TValue;
  migrate: (raw: TRaw, settingsPath: string) => SettingsMigrationResult<TRaw>;
  parse: (raw: TRaw) => TValue;
  parseObject: (raw: unknown) => TRaw | null;
  serialize: (value: TValue) => TRaw;
}

type SerializedUpdate = Promise<unknown>;
const settingsUpdateQueues = new Map<string, SerializedUpdate>();

export class SecureVersionedJsonStore<TRaw extends object, TValue> {
  constructor(
    private readonly codec: SecureVersionedJsonCodec<TRaw, TValue>,
    private readonly writeSettingsFile = writePrivateSettingsTextFile
  ) {}

  async read(settingsPath: string): Promise<TValue> {
    return this.readInternal(settingsPath, true);
  }

  async write(settingsPath: string, value: TValue): Promise<void> {
    await queueSettingsUpdate(settingsPath, async () => {
      await this.writeRaw(settingsPath, this.codec.serialize(value));
    });
  }

  update(
    settingsPath: string,
    update: (current: TValue) => Promise<TValue> | TValue
  ): Promise<TValue> {
    return queueSettingsUpdate(settingsPath, async () => {
      const current = await this.readInternal(settingsPath, false);
      const next = await update(current);
      await this.writeRaw(settingsPath, this.codec.serialize(next));
      return next;
    });
  }

  private async readInternal(settingsPath: string, persistMigration: boolean): Promise<TValue> {
    try {
      const rawSettings = await readFile(settingsPath, "utf8");
      const parsedJson = parseSettingsJson(rawSettings);

      if (!parsedJson.ok) {
        await backupCorruptedSettingsFile(settingsPath);
        throw this.codec.createCorruptError(settingsPath);
      }

      const parsedObject = this.codec.parseObject(parsedJson.value);
      if (!parsedObject) return this.codec.defaultValue;

      const migrated = this.codec.migrate(parsedObject, settingsPath);
      if (migrated.didMigrate && persistMigration) {
        try {
          await this.persistLatestMigration(settingsPath);
        } catch {
          // 書き戻し失敗時も読み込み結果は捨てず、正規化した値で続行する。
        }
      }

      return this.codec.parse(migrated.settings);
    } catch (error) {
      if (isMissingFileError(error)) return this.codec.defaultValue;
      throw error;
    }
  }

  private persistLatestMigration(settingsPath: string): Promise<void> {
    return queueSettingsUpdate(settingsPath, async () => {
      const rawSettings = await readFile(settingsPath, "utf8");
      const parsedJson = parseSettingsJson(rawSettings);
      if (!parsedJson.ok) return;

      const parsedObject = this.codec.parseObject(parsedJson.value);
      if (!parsedObject) return;

      const migrated = this.codec.migrate(parsedObject, settingsPath);
      if (!migrated.didMigrate) return;

      await this.writeRaw(settingsPath, migrated.settings);
    });
  }

  private async writeRaw(settingsPath: string, raw: TRaw): Promise<void> {
    await this.writeSettingsFile(
      settingsPath,
      `${JSON.stringify(raw, null, 2)}\n`
    );
  }
}

function queueSettingsUpdate<T>(settingsPath: string, task: () => Promise<T>): Promise<T> {
  const currentQueue = settingsUpdateQueues.get(settingsPath) ?? Promise.resolve();
  const next = currentQueue.catch(() => undefined).then(task);
  const settled = next.finally(() => undefined);

  settingsUpdateQueues.set(settingsPath, settled);
  void settled.finally(() => {
    if (settingsUpdateQueues.get(settingsPath) === settled) {
      settingsUpdateQueues.delete(settingsPath);
    }
  }).catch(() => undefined);

  return next;
}

function parseSettingsJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

async function backupCorruptedSettingsFile(settingsPath: string): Promise<void> {
  const parsedPath = path.parse(settingsPath);
  const backupPath = path.join(parsedPath.dir, `${parsedPath.name}.corrupt-${Date.now()}.json`);
  await rename(settingsPath, backupPath);
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
