export { collectMarkdownCardPaths } from "../shared/cardbookTree";

export const joinCardbookPath = (cardFolder: string, name: string): string => {
  const normalizedCardFolder = cardFolder.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const normalizedName = name.trim().replace(/\\/g, "/").replace(/^\/+/, "");

  return normalizedCardFolder ? `${normalizedCardFolder}/${normalizedName}` : normalizedName;
};

export const parentCardFolderOf = (path: string): string => {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
};

export const displayNameFromPath = (path: string): string => {
  const name = path.split("/").at(-1) ?? path;
  return name.replace(/\.md$/i, "");
};
