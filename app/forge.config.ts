import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerZIP } from "@electron-forge/maker-zip";
import { VitePlugin } from "@electron-forge/plugin-vite";

import { ignoreRelicPackagePath, relicPackageExtraResources } from "./build-tools/packageContents";

const config = {
  outDir: process.env.RELIC_FORGE_OUT_DIR,
  packagerConfig: {
    asar: true,
    appBundleId: "app.relic.desktop",
    extraResource: relicPackageExtraResources(process.cwd()),
    icon: "assets/icon",
    ignore: ignoreRelicPackagePath,
    name: "Relic",
    osxUniversal: {
      mergeASARs: true
    }
  },
  makers: [
    new MakerZIP({}, ["darwin"]),
    new MakerDMG({}),
    new MakerZIP({}, ["win32"])
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main/main.ts",
          config: "vite.main.config.ts"
        },
        {
          entry: "src/preload/preload.ts",
          config: "vite.preload.config.ts"
        }
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts"
        }
      ]
    })
  ]
};

export default config;
