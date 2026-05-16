export { collectMarkdownPaths } from "../shared/workspaceTree";

export const joinWorkspacePath = (folder: string, name: string): string => {
  const normalizedFolder = folder.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const normalizedName = name.trim().replace(/\\/g, "/").replace(/^\/+/, "");

  return normalizedFolder ? `${normalizedFolder}/${normalizedName}` : normalizedName;
};

export const parentFolderOf = (path: string): string => {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
};

export const displayNameFromPath = (path: string): string => {
  const name = path.split("/").at(-1) ?? path;
  return name.replace(/\.md$/i, "");
};
