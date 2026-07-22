export const macBuildTarget = Object.freeze({
  arch: "arm64",
  outputDirectory: "out/darwin",
  packageDirectoryName: "Relic-darwin-arm64",
  platform: "darwin"
});

const supportedCommands = new Set(["make", "package"]);

export function assertAppleSiliconHost(platform = process.platform, arch = process.arch) {
  if (platform !== macBuildTarget.platform || arch !== macBuildTarget.arch) {
    throw new Error(
      `Relic macOS builds require an Apple Silicon Mac. Actual host: ${platform}/${arch}`
    );
  }
}

export function forgeBuildArguments(command) {
  if (!supportedCommands.has(command)) {
    throw new Error("Usage: node scripts/run-forge-build.mjs <make|package>");
  }

  return [
    "exec",
    "electron-forge",
    command,
    "--platform",
    macBuildTarget.platform,
    "--arch",
    macBuildTarget.arch
  ];
}
