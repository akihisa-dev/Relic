import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@relic-app": path.resolve(__dirname, "../app/src")
    }
  },
  server: { port: 5174, strictPort: true }
});
