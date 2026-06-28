import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { productionDependencies, repositoryRoot } from "./dependency-metadata.mjs";

const outputPath = path.join(repositoryRoot, "THIRD_PARTY_NOTICES.md");
const isCheck = process.argv.includes("--check");

const dependencies = await productionDependencies();
const content = renderNotices(dependencies);

if (isCheck) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== content) {
    console.error("THIRD_PARTY_NOTICES.md is out of date. Run pnpm licenses:generate in app/.");
    process.exit(1);
  }
} else {
  await writeFile(outputPath, content, "utf8");
}

function renderNotices(items) {
  return [
    "# Third Party Notices",
    "",
    "Relic 本体は AGPL-3.0-or-later で公開されています。",
    "このファイルは、配布物に含まれ得る `app/package.json` の production dependencies を確認するための一覧です。",
    "開発時だけ使う `devDependencies` はこの一覧に含めません。",
    "",
    "この一覧は法的な最終判断ではありません。依存更新や配布前には、必要に応じて各パッケージの公式ライセンス情報を人が確認してください。",
    "",
    "| Package | Version | License | Repository |",
    "|---------|---------|---------|------------|",
    ...items.map((item) => [
      "| ",
      markdownCode(item.name),
      " | ",
      markdownCode(item.version),
      " | ",
      escapeTable(item.license),
      " | ",
      item.repository ? `[link](${item.repository})` : "",
      " |"
    ].join("")),
    ""
  ].join("\n");
}

function markdownCode(value) {
  return `\`${String(value).replace(/`/g, "\\`")}\``;
}

function escapeTable(value) {
  return String(value).replace(/\|/g, "\\|");
}
