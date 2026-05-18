import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerZIP } from "@electron-forge/maker-zip";
import { VitePlugin } from "@electron-forge/plugin-vite";

const config = {
  packagerConfig: {
    asar: true,
    appBundleId: "app.relic.desktop",
    icon: "assets/icon",
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
