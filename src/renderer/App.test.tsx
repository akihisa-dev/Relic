import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the phase 0 two-column shell", async () => {
    window.relic = {
      createFolder: vi.fn(),
      getAppInfo: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          name: "Relic",
          platform: "darwin",
          version: "0.0.0"
        }
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: null,
          fileTree: [],
          workspaces: []
        }
      }),
      openWorkspace: vi.fn(),
      createMarkdownFile: vi.fn(),
      readMarkdownFile: vi.fn()
    };

    render(<App />);

    expect(screen.getByRole("navigation", { name: "ビュー切り替え" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ファイル" })).toBeInTheDocument();
    expect(await screen.findByText("ワークスペース未選択")).toBeInTheDocument();
    expect(await screen.findByText("IPC: Relic 0.0.0 / darwin")).toBeInTheDocument();
  });

  it("creates a markdown file from the sidebar form", async () => {
    const createMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: {
          id: "workspace-1",
          name: "Notes",
          path: "/tmp/Notes"
        },
        fileTree: [
          {
            name: "読書メモ",
            path: "読書メモ.md",
            type: "file"
          }
        ],
        workspaces: []
      }
    });

    window.relic = {
      createFolder: vi.fn(),
      createMarkdownFile,
      getAppInfo: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          name: "Relic",
          platform: "darwin",
          version: "0.0.0"
        }
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: {
            id: "workspace-1",
            name: "Notes",
            path: "/tmp/Notes"
          },
          fileTree: [],
          workspaces: []
        }
      }),
      openWorkspace: vi.fn(),
      readMarkdownFile: vi.fn()
    };

    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: "新規ノート名" }), {
      target: {
        value: "読書メモ"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "ノート作成" }));

    expect(createMarkdownFile).toHaveBeenCalledWith({ name: "読書メモ" });
    expect(await screen.findByText("読書メモ")).toBeInTheDocument();
  });

  it("creates a folder from the sidebar form", async () => {
    const createFolder = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: {
          id: "workspace-1",
          name: "Notes",
          path: "/tmp/Notes"
        },
        fileTree: [
          {
            children: [],
            name: "資料",
            path: "資料",
            type: "folder"
          }
        ],
        workspaces: []
      }
    });

    window.relic = {
      createFolder,
      createMarkdownFile: vi.fn(),
      getAppInfo: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          name: "Relic",
          platform: "darwin",
          version: "0.0.0"
        }
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: {
            id: "workspace-1",
            name: "Notes",
            path: "/tmp/Notes"
          },
          fileTree: [],
          workspaces: []
        }
      }),
      openWorkspace: vi.fn(),
      readMarkdownFile: vi.fn()
    };

    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: "新規フォルダ名" }), {
      target: {
        value: "資料"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "フォルダ作成" }));

    expect(createFolder).toHaveBeenCalledWith({ name: "資料" });
    expect(await screen.findByText("資料")).toBeInTheDocument();
  });

  it("opens a markdown file from the file tree", async () => {
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        content: "# 読書メモ\n本文です。",
        name: "読書メモ",
        path: "読書メモ.md"
      }
    });

    window.relic = {
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      getAppInfo: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          name: "Relic",
          platform: "darwin",
          version: "0.0.0"
        }
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: {
            id: "workspace-1",
            name: "Notes",
            path: "/tmp/Notes"
          },
          fileTree: [
            {
              name: "読書メモ",
              path: "読書メモ.md",
              type: "file"
            }
          ],
          workspaces: []
        }
      }),
      openWorkspace: vi.fn(),
      readMarkdownFile
    };

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));

    expect(readMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
    expect(await screen.findByText((_, element) => element?.textContent === "# 読書メモ\n本文です。"))
      .toBeInTheDocument();
  });
});
