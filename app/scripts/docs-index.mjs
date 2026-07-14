import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, "../..");
const indexRepoPath = "docs/INDEX.md";
const indexPath = path.join(repoRoot, indexRepoPath);

export const catalogStartMarker = "<!-- docs-catalog:start -->";
export const catalogEndMarker = "<!-- docs-catalog:end -->";

const requiredRootDocuments = new Set([
  ".github/RELEASE_CHECKLIST.md",
  "AGENTS.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "docs/INDEX.md",
  "docs/development.md",
]);

export function compareNames(a, b) {
  return a.localeCompare(b, "en");
}

export function parseTrackedFiles(output) {
  return output.split("\0").filter(Boolean).sort(compareNames);
}

export function readTrackedFiles(root = repoRoot) {
  const output = execFileSync("git", ["-C", root, "ls-files", "-z"], {
    encoding: "utf8",
  });
  return parseTrackedFiles(output);
}

export function isRequiredDocument(file) {
  return requiredRootDocuments.has(file)
    || /^docs\/(project|features|design|engineering)\/.+\.md$/u.test(file);
}

export function requiredDocuments(trackedFiles) {
  return trackedFiles.filter(isRequiredDocument).sort(compareNames);
}

export function buildTree(files) {
  const root = new Map();

  for (const file of files) {
    const parts = file.split("/");
    let children = root;

    parts.forEach((part, index) => {
      if (!children.has(part)) {
        children.set(part, { children: new Map(), isFile: false });
      }

      const node = children.get(part);
      if (index === parts.length - 1) {
        node.isFile = true;
      }
      children = node.children;
    });
  }

  return root;
}

export function renderTree(files) {
  return renderChildren(buildTree(files), 0).join("\n");
}

function renderChildren(children, depth) {
  const entries = [...children.entries()].sort(([a], [b]) => compareNames(a, b));
  const directories = entries.filter(([, node]) => !node.isFile);
  const files = entries.filter(([, node]) => node.isFile);
  const lines = [];
  const indent = "  ".repeat(depth);

  for (const [name, node] of directories) {
    lines.push(`${indent}- ${markdownCode(`${name}/`)}`);
    lines.push(...renderChildren(node.children, depth + 1));
  }

  for (const [name] of files) {
    lines.push(`${indent}- ${markdownCode(name)}`);
  }

  return lines;
}

function markdownCode(value) {
  const visibleValue = value.replaceAll("\r", "\\r").replaceAll("\n", "\\n");
  const longestRun = Math.max(0, ...[...visibleValue.matchAll(/`+/gu)].map((match) => match[0].length));
  const delimiter = "`".repeat(longestRun + 1);
  return `${delimiter}${visibleValue}${delimiter}`;
}

export function extractMarkdownLinks(content) {
  const links = [];
  const pattern = /!?\[[^\]]*\]\(([^)]+)\)/gu;
  const visibleContent = stripMarkdownCodeAndComments(content);

  for (const match of visibleContent.matchAll(pattern)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    } else {
      target = target.split(/\s+/u, 1)[0];
    }
    links.push(target);
  }

  return links;
}

function stripMarkdownCodeAndComments(content) {
  return stripMarkdownFencesAndComments(content)
    .split("\n")
    .map((line) => line.replace(/(`+)(.*?)\1/gu, ""))
    .join("\n");
}

function stripMarkdownFencesAndComments(content) {
  const withoutComments = content.replace(/<!--[\s\S]*?-->/gu, "");
  const lines = withoutComments.split("\n");
  let fenceCharacter = "";
  let fenceLength = 0;

  return lines.map((line) => {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/u)?.[1] ?? "";
    if (fenceCharacter) {
      if (fence.startsWith(fenceCharacter.repeat(fenceLength))) {
        fenceCharacter = "";
        fenceLength = 0;
      }
      return "";
    }
    if (fence) {
      fenceCharacter = fence[0];
      fenceLength = fence.length;
      return "";
    }
    return line;
  }).join("\n");
}

function markerRange(content) {
  const starts = [...content.matchAll(new RegExp(catalogStartMarker, "gu"))];
  const ends = [...content.matchAll(new RegExp(catalogEndMarker, "gu"))];

  if (starts.length !== 1 || ends.length !== 1) {
    return {
      errors: [`正本文書カタログの開始・終了マーカーは1組必要です（start=${starts.length}, end=${ends.length}）。`],
      content: "",
    };
  }

  const start = starts[0].index + catalogStartMarker.length;
  const end = ends[0].index;
  if (start >= end) {
    return {
      errors: ["正本文書カタログの終了マーカーが開始マーカーより前にあります。"],
      content: "",
    };
  }

  return { errors: [], content: content.slice(start, end) };
}

function localRepositoryPath(target, sourceRepoPath = indexRepoPath) {
  if (!target || /^[a-z][a-z\d+.-]*:/iu.test(target)) {
    return null;
  }

  const hashIndex = target.indexOf("#");
  const rawPath = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
  const rawAnchor = hashIndex >= 0 ? target.slice(hashIndex + 1) : "";
  let decodedTarget;
  let decodedAnchor;
  try {
    decodedTarget = decodeURIComponent(rawPath);
    decodedAnchor = decodeURIComponent(rawAnchor);
  } catch {
    return { error: `リンク先をURLデコードできません: ${target}` };
  }

  if (decodedTarget.startsWith("/")) {
    return { error: `リポジトリ外を指す絶対リンクは使えません: ${target}` };
  }

  const resolved = decodedTarget === ""
    ? sourceRepoPath
    : path.posix.normalize(path.posix.join(path.posix.dirname(sourceRepoPath), decodedTarget));
  if (resolved === ".." || resolved.startsWith("../")) {
    return { error: `リポジトリ外を指すリンクは使えません: ${target}` };
  }

  return { path: resolved, anchor: decodedAnchor };
}

function headingSlug(heading) {
  return heading
    .replace(/<[^>]*>/gu, "")
    .replace(/[`*_~]/gu, "")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[^\p{Letter}\p{Number}\p{Mark}\s_-]/gu, "")
    .replace(/\s+/gu, "-");
}

export function markdownHeadingAnchors(content) {
  const anchors = new Set();
  const counts = new Map();
  const visibleContent = stripMarkdownFencesAndComments(content);
  for (const line of visibleContent.split("\n")) {
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/u)?.[1];
    if (!heading) continue;
    const base = headingSlug(heading);
    if (!base) continue;
    const count = counts.get(base) ?? 0;
    anchors.add(count === 0 ? base : `${base}-${count}`);
    counts.set(base, count + 1);
  }
  return anchors;
}

export function validateMarkdownDocuments(trackedFiles, options = {}) {
  const tracked = new Set(trackedFiles);
  const isTrackedPath = (repoPath) => tracked.has(repoPath)
    || trackedFiles.some((file) => file.startsWith(`${repoPath}/`));
  const pathExists = options.pathExists
    ?? ((repoPath) => existsSync(path.join(repoRoot, repoPath)));
  const readContent = options.readContent
    ?? ((repoPath) => readFileSync(path.join(repoRoot, repoPath), "utf8"));
  const errors = [];

  for (const sourceRepoPath of trackedFiles.filter((file) => /\.md$/iu.test(file))) {
    if (!pathExists(sourceRepoPath)) continue;
    const content = readContent(sourceRepoPath);
    for (const target of extractMarkdownLinks(content)) {
      const resolved = localRepositoryPath(target, sourceRepoPath);
      if (resolved === null) continue;
      if (resolved.error) {
        errors.push(`${sourceRepoPath}: ${resolved.error}`);
        continue;
      }
      if (!pathExists(resolved.path)) {
        errors.push(`${sourceRepoPath}: リンク先が存在しません: ${target} -> ${resolved.path}`);
        continue;
      }
      if (!isTrackedPath(resolved.path)) {
        errors.push(`${sourceRepoPath}: リンク先がGitで追跡されていません: ${target} -> ${resolved.path}`);
        continue;
      }
      if (resolved.anchor && /\.md$/iu.test(resolved.path)) {
        const anchors = markdownHeadingAnchors(readContent(resolved.path));
        if (!anchors.has(resolved.anchor)) {
          errors.push(`${sourceRepoPath}: リンク先の見出しが存在しません: ${target}`);
        }
      }
    }
  }

  return errors;
}

export function validateIndexContent(content, trackedFiles, options = {}) {
  const tracked = new Set(trackedFiles);
  const pathExists = options.pathExists
    ?? ((repoPath) => existsSync(path.join(repoRoot, repoPath)));
  const errors = [];

  for (const target of extractMarkdownLinks(content)) {
    const resolved = localRepositoryPath(target);
    if (resolved === null) {
      continue;
    }
    if (resolved.error) {
      errors.push(resolved.error);
      continue;
    }
    if (!pathExists(resolved.path)) {
      errors.push(`リンク先が存在しません: ${target} -> ${resolved.path}`);
    } else if (!tracked.has(resolved.path)) {
      errors.push(`リンク先がGitで追跡されていません: ${target} -> ${resolved.path}`);
    }
  }

  const catalog = markerRange(content);
  errors.push(...catalog.errors);
  if (catalog.errors.length > 0) {
    return errors;
  }

  const catalogPaths = [];
  for (const target of extractMarkdownLinks(catalog.content)) {
    const resolved = localRepositoryPath(target);
    if (resolved?.path) {
      catalogPaths.push(resolved.path);
    }
  }

  const counts = new Map();
  for (const repoPath of catalogPaths) {
    counts.set(repoPath, (counts.get(repoPath) ?? 0) + 1);
  }

  for (const [repoPath, count] of counts) {
    if (count > 1) {
      errors.push(`正本文書カタログに重複があります: ${repoPath} (${count}件)`);
    }
  }

  const expected = requiredDocuments(trackedFiles);
  const catalogSet = new Set(catalogPaths);
  for (const repoPath of expected) {
    if (!catalogSet.has(repoPath)) {
      errors.push(`正本文書カタログに掲載されていません: ${repoPath}`);
    }
  }

  const expectedSet = new Set(expected);
  for (const repoPath of catalogSet) {
    if (!expectedSet.has(repoPath)) {
      errors.push(`正本文書カタログの対象外です: ${repoPath}`);
    }
  }

  return errors;
}

export function main(args = process.argv.slice(2)) {
  const mode = args[0];
  if (mode !== "--check" && mode !== "--tree") {
    console.error("Usage: node scripts/docs-index.mjs --check|--tree");
    return 2;
  }

  const trackedFiles = readTrackedFiles();
  if (mode === "--tree") {
    console.log(renderTree(trackedFiles));
    return 0;
  }

  const content = readFileSync(indexPath, "utf8");
  const errors = [
    ...validateIndexContent(content, trackedFiles),
    ...validateMarkdownDocuments(trackedFiles),
  ];
  if (errors.length > 0) {
    console.error("docs/INDEX.md の検証に失敗しました。");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    return 1;
  }

  const markdownCount = trackedFiles.filter((file) => /\.md$/iu.test(file)).length;
  console.log(`Documentation is valid (${requiredDocuments(trackedFiles).length} canonical documents, ${markdownCount} Markdown files).`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exitCode = main();
}
