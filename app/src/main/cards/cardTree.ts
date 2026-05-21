import { readdir } from "node:fs/promises";
import path from "node:path";

import type { CardbookTreeNode } from "../../shared/ipc";
import { toCardbookRelativePath } from "./paths";

export async function readCardbookCardTree(cardbookPath: string): Promise<CardbookTreeNode[]> {
  return readDirectory(cardbookPath, "");
}

async function readDirectory(rootPath: string, relativeDirectory: string): Promise<CardbookTreeNode[]> {
  const absoluteDirectory = path.join(rootPath, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const nodes = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map(async (entry): Promise<CardbookTreeNode | null> => {
        const relativePath = toCardbookRelativePath(path.join(relativeDirectory, entry.name));

        if (entry.isDirectory()) {
          return {
            children: await readDirectory(rootPath, relativePath),
            name: entry.name,
            path: relativePath,
            type: "cardFolder"
          };
        }

        if (entry.isFile() && path.extname(entry.name) === ".md") {
          return {
            name: path.basename(entry.name, ".md"),
            path: relativePath,
            type: "card"
          };
        }

        return null;
      })
  );

  return nodes.filter(isTreeNode).sort(compareTreeNodes);
}

function compareTreeNodes(a: CardbookTreeNode, b: CardbookTreeNode): number {
  if (a.type !== b.type) {
    return a.type === "cardFolder" ? -1 : 1;
  }

  return a.name.localeCompare(b.name, "ja");
}

function isTreeNode(value: CardbookTreeNode | null): value is CardbookTreeNode {
  return value !== null;
}
