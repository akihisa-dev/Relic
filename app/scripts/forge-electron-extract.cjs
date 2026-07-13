const { execFile } = require("node:child_process");
const Module = require("node:module");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const dittoPath = "/usr/bin/ditto";

function nodeMajorVersion(nodeVersion) {
  const major = Number.parseInt(String(nodeVersion).split(".")[0], 10);
  return Number.isFinite(major) ? major : 0;
}

function shouldUseDitto({
  enabled = process.env.RELIC_ELECTRON_EXTRACTOR,
  nodeVersion = process.versions.node,
  platform = process.platform
} = {}) {
  return enabled === "ditto" && platform === "darwin" && nodeMajorVersion(nodeVersion) >= 25;
}

async function extractWithDitto(zipPath, options = {}) {
  if (typeof zipPath !== "string" || typeof options.dir !== "string") {
    throw new TypeError("Electron ZIP path and extraction directory are required");
  }

  await execFileAsync(dittoPath, ["-x", "-k", zipPath, options.dir]);
}

function installDittoExtractor() {
  if (!shouldUseDitto()) {
    return false;
  }

  const originalLoad = Module._load;
  if (originalLoad.relicDittoExtractor === true) {
    return true;
  }

  const patchedLoad = function patchedLoad(request, parent, isMain) {
    if (request === "extract-zip") {
      return extractWithDitto;
    }

    return originalLoad.call(this, request, parent, isMain);
  };
  patchedLoad.relicDittoExtractor = true;
  Module._load = patchedLoad;
  return true;
}

installDittoExtractor();

module.exports = {
  extractWithDitto,
  nodeMajorVersion,
  shouldUseDitto
};
