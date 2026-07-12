import { describe, expect, it, vi } from "vitest";

import { configureDevelopmentUserDataPath } from "./developmentUserData";

describe("configureDevelopmentUserDataPath", () => {
  it("開発server起動時だけ絶対pathの一時userDataへ切り替える", () => {
    const app = { setPath: vi.fn() };

    expect(configureDevelopmentUserDataPath(app, "http://localhost:5173", "/tmp/relic-smoke-user-data"))
      .toBe(true);
    expect(app.setPath).toHaveBeenCalledWith("userData", "/tmp/relic-smoke-user-data");
  });

  it("productionと未指定時は既定userDataを変更しない", () => {
    const app = { setPath: vi.fn() };

    expect(configureDevelopmentUserDataPath(app, undefined, "/tmp/relic-smoke-user-data")).toBe(false);
    expect(configureDevelopmentUserDataPath(app, "http://localhost:5173", undefined)).toBe(false);
    expect(app.setPath).not.toHaveBeenCalled();
  });

  it("相対pathを拒否する", () => {
    const app = { setPath: vi.fn() };

    expect(() => configureDevelopmentUserDataPath(app, "http://localhost:5173", "relative/path"))
      .toThrow("RELIC_DEV_USER_DATA_DIR must be an absolute path.");
    expect(app.setPath).not.toHaveBeenCalled();
  });
});
