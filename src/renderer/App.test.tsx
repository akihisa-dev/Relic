import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      duplicateMarkdownFile: vi.fn(),
      openWorkspace: vi.fn(),
      moveItemToTrash: vi.fn(),
      createMarkdownFile: vi.fn(),
      readMarkdownFile: vi.fn(),
      renameMarkdownFile: vi.fn(),
      renameFolder: vi.fn(),
      switchWorkspace: vi.fn()
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
      duplicateMarkdownFile: vi.fn(),
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
      moveItemToTrash: vi.fn(),
      readMarkdownFile: vi.fn(),
      renameMarkdownFile: vi.fn(),
      renameFolder: vi.fn(),
      switchWorkspace: vi.fn()
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
      duplicateMarkdownFile: vi.fn(),
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
      moveItemToTrash: vi.fn(),
      readMarkdownFile: vi.fn(),
      renameMarkdownFile: vi.fn(),
      renameFolder: vi.fn(),
      switchWorkspace: vi.fn()
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
      duplicateMarkdownFile: vi.fn(),
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
      moveItemToTrash: vi.fn(),
      readMarkdownFile,
      renameMarkdownFile: vi.fn(),
      renameFolder: vi.fn(),
      switchWorkspace: vi.fn()
    };

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));

    expect(readMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
    expect(await screen.findByText((_, element) => element?.textContent === "# 読書メモ\n本文です。"))
      .toBeInTheDocument();
  });

  it("switches between registered workspaces", async () => {
    const switchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: {
          id: "workspace-2",
          name: "Archive",
          path: "/tmp/Archive"
        },
        fileTree: [
          {
            name: "old",
            path: "old.md",
            type: "file"
          }
        ],
        workspaces: [
          {
            id: "workspace-1",
            name: "Notes",
            path: "/tmp/Notes"
          },
          {
            id: "workspace-2",
            name: "Archive",
            path: "/tmp/Archive"
          }
        ]
      }
    });

    window.relic = {
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      duplicateMarkdownFile: vi.fn(),
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
          workspaces: [
            {
              id: "workspace-1",
              name: "Notes",
              path: "/tmp/Notes"
            },
            {
              id: "workspace-2",
              name: "Archive",
              path: "/tmp/Archive"
            }
          ]
        }
      }),
      openWorkspace: vi.fn(),
      moveItemToTrash: vi.fn(),
      readMarkdownFile: vi.fn(),
      renameMarkdownFile: vi.fn(),
      renameFolder: vi.fn(),
      switchWorkspace
    };

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));

    expect(switchWorkspace).toHaveBeenCalledWith({ workspaceId: "workspace-2" });
    expect(await screen.findByText("/tmp/Archive")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /old/ })).toBeInTheDocument();
  });

  it("renames the active markdown file", async () => {
    const renameMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: {
          content: "# 読書メモ",
          name: "読書記録",
          path: "読書記録.md"
        },
        workspaceState: {
          activeWorkspace: {
            id: "workspace-1",
            name: "Notes",
            path: "/tmp/Notes"
          },
          fileTree: [
            {
              name: "読書記録",
              path: "読書記録.md",
              type: "file"
            }
          ],
          workspaces: []
        }
      }
    });

    window.relic = {
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      duplicateMarkdownFile: vi.fn(),
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
      moveItemToTrash: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "# 読書メモ",
          name: "読書メモ",
          path: "読書メモ.md"
        }
      }),
      renameMarkdownFile,
      renameFolder: vi.fn(),
      switchWorkspace: vi.fn()
    };

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.change(await screen.findByRole("textbox", { name: "リネーム後のノート名" }), {
      target: {
        value: "読書記録"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "名前変更" }));

    expect(renameMarkdownFile).toHaveBeenCalledWith({
      newName: "読書記録",
      path: "読書メモ.md"
    });
    expect(await screen.findByText("読書記録.md")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /読書記録/ })).toBeInTheDocument();
  });

  it("renames the selected folder", async () => {
    const renameFolder = vi.fn().mockResolvedValue({
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
            name: "Archive",
            path: "Archive",
            type: "folder"
          }
        ],
        workspaces: []
      }
    });

    window.relic = {
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      duplicateMarkdownFile: vi.fn(),
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
              children: [],
              name: "資料",
              path: "資料",
              type: "folder"
            }
          ],
          workspaces: []
        }
      }),
      openWorkspace: vi.fn(),
      moveItemToTrash: vi.fn(),
      readMarkdownFile: vi.fn(),
      renameMarkdownFile: vi.fn(),
      renameFolder,
      switchWorkspace: vi.fn()
    };

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /資料/ }));
    fireEvent.change(await screen.findByRole("textbox", { name: "リネーム後のフォルダ名" }), {
      target: {
        value: "Archive"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "フォルダ名変更" }));

    expect(renameFolder).toHaveBeenCalledWith({
      newName: "Archive",
      path: "資料"
    });
    expect(await screen.findByRole("button", { name: /Archive/ })).toBeInTheDocument();
  });

  it("duplicates the active markdown file", async () => {
    const duplicateMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: {
          content: "# 読書メモ",
          name: "読書メモ のコピー",
          path: "読書メモ のコピー.md"
        },
        workspaceState: {
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
            },
            {
              name: "読書メモ のコピー",
              path: "読書メモ のコピー.md",
              type: "file"
            }
          ],
          workspaces: []
        }
      }
    });

    window.relic = {
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      duplicateMarkdownFile,
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
      moveItemToTrash: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "# 読書メモ",
          name: "読書メモ",
          path: "読書メモ.md"
        }
      }),
      renameMarkdownFile: vi.fn(),
      renameFolder: vi.fn(),
      switchWorkspace: vi.fn()
    };

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(await screen.findByRole("button", { name: "複製" }));

    expect(duplicateMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
    expect(await screen.findByText("読書メモ のコピー.md")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /読書メモ のコピー/ })).toBeInTheDocument();
  });

  it("moves the active markdown file to trash after confirmation", async () => {
    const moveItemToTrash = vi.fn().mockResolvedValue({
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
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    window.relic = {
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      duplicateMarkdownFile: vi.fn(),
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
      moveItemToTrash,
      openWorkspace: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "# 読書メモ",
          name: "読書メモ",
          path: "読書メモ.md"
        }
      }),
      renameMarkdownFile: vi.fn(),
      renameFolder: vi.fn(),
      switchWorkspace: vi.fn()
    };

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(await screen.findByRole("button", { name: "ゴミ箱へ" }));

    expect(moveItemToTrash).toHaveBeenCalledWith({
      path: "読書メモ.md",
      type: "file"
    });
    expect(await screen.findByText("Relic")).toBeInTheDocument();
  });

  it("does not move a file to trash when confirmation is canceled", async () => {
    const moveItemToTrash = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    window.relic = {
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      duplicateMarkdownFile: vi.fn(),
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
      moveItemToTrash,
      openWorkspace: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "# 読書メモ",
          name: "読書メモ",
          path: "読書メモ.md"
        }
      }),
      renameMarkdownFile: vi.fn(),
      renameFolder: vi.fn(),
      switchWorkspace: vi.fn()
    };

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(await screen.findByRole("button", { name: "ゴミ箱へ" }));

    expect(moveItemToTrash).not.toHaveBeenCalled();
  });

  it("moves the selected folder to trash after confirmation", async () => {
    const moveItemToTrash = vi.fn().mockResolvedValue({
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
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    window.relic = {
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      duplicateMarkdownFile: vi.fn(),
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
              children: [],
              name: "資料",
              path: "資料",
              type: "folder"
            }
          ],
          workspaces: []
        }
      }),
      moveItemToTrash,
      openWorkspace: vi.fn(),
      readMarkdownFile: vi.fn(),
      renameMarkdownFile: vi.fn(),
      renameFolder: vi.fn(),
      switchWorkspace: vi.fn()
    };

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /資料/ }));
    fireEvent.click(await screen.findByRole("button", { name: "ゴミ箱へ" }));

    expect(moveItemToTrash).toHaveBeenCalledWith({
      path: "資料",
      type: "folder"
    });
    expect(await screen.findByText("Relic")).toBeInTheDocument();
  });
});
