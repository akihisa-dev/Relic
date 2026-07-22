import { readFile, rename } from "node:fs/promises";
import path from "node:path";

import { writePrivateSettingsTextFile } from "./secureSettingsFile";

export interface SecureVersionedJsonCodec<TRaw extends object, TValue> {
  createCorruptError: (settingsPath: string) => Error;
  createDefaultValue: () => TValue;
  parse: (raw: TRaw) => TValue;
  parseObject: (raw: unknown, settingsPath: string) => TRaw | null;
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
    return this.readInternal(settingsPath);
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
      const current = await this.readInternal(settingsPath);
      const next = await update(current);
      await this.writeRaw(settingsPath, this.codec.serialize(next));
      return next;
    });
  }

  private async readInternal(settingsPath: string): Promise<TValue> {
    try {
      const rawSettings = await readFile(settingsPath, "utf8");
      const parsedJson = parseSettingsJson(rawSettings);

      if (!parsedJson.ok) {
        await backupCorruptedSettingsFile(settingsPath);
        throw this.codec.createCorruptError(settingsPath);
      }

      const parsedObject = this.codec.parseObject(parsedJson.value, settingsPath);
      if (!parsedObject) return this.codec.createDefaultValue();

      return this.codec.parse(parsedObject);
    } catch (error) {
      if (isMissingFileError(error)) return this.codec.createDefaultValue();
      throw error;
    }
  }

  private async writeRaw(settingsPath: string, raw: TRaw): Promise<void> {
    await this.writeSettingsFile(
      settingsPath,
      `${JSON.stringify(raw, null, 2)}\n`
    );
  }
}

export function assertCurrentSettingsSchemaVersion(
  raw: Record<string, unknown>,
  currentVersion: number,
  settingsPath: string,
  scope: string,
  errorName: string
): void {
  if (raw.schemaVersion === currentVersion) return;

  const error = new Error(
    `${scope}の形式に対応していません: ${settingsPath} ` +
    `(schemaVersion: ${String(raw.schemaVersion)}、対応version: ${currentVersion})。設定ファイルは変更していません。`
  );
  error.name = errorName;
  throw error;
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
