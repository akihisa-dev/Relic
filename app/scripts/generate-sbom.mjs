import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { productionDependencies, repositoryRoot, readJson, appDir } from "./dependency-metadata.mjs";

const outputPath = path.join(repositoryRoot, "sbom", "relic-dependencies.cdx.json");
const isCheck = process.argv.includes("--check");

const appPackage = await readJson(path.join(appDir, "package.json"));
const dependencies = await productionDependencies();
const content = `${JSON.stringify(renderCycloneDx(appPackage, dependencies), null, 2)}\n`;

if (isCheck) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== content) {
    console.error("sbom/relic-dependencies.cdx.json is out of date. Run pnpm sbom:generate in app/.");
    process.exit(1);
  }
} else {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, "utf8");
}

function renderCycloneDx(appPackage, items) {
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      component: {
        type: "application",
        name: appPackage.name,
        version: appPackage.version,
        licenses: [
          {
            license: {
              id: appPackage.license
            }
          }
        ]
      }
    },
    components: items.map((item) => ({
      type: "library",
      name: item.name,
      version: item.version,
      purl: packageUrl(item.name, item.version),
      licenses: [
        {
          license: licenseObject(item.license)
        }
      ],
      externalReferences: item.repository
        ? [
            {
              type: "vcs",
              url: item.repository
            }
          ]
        : []
    }))
  };
}

function licenseObject(license) {
  return /^[A-Za-z0-9-.+]+$/.test(license)
    ? { id: license }
    : { name: license };
}

function packageUrl(name, version) {
  const encodedName = name.startsWith("@")
    ? `%40${name.slice(1).split("/").map(encodeURIComponent).join("/")}`
    : encodeURIComponent(name);

  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
}
