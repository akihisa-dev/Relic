import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2023"
  },
  clearScreen: false,
  optimizeDeps: {
    esbuildOptions: {
      target: "es2023"
    }
  }
});
