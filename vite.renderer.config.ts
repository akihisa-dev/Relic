import react from "@vitejs/plugin-react";
import { mergeConfig } from "vite";

import baseConfig from "./vite.base.config";

export default mergeConfig(baseConfig, {
  optimizeDeps: {
    entries: ["index.html"]
  },
  plugins: [react()]
});
