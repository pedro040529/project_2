import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 1200
  },
  server: {
    port: 5173,
    strictPort: false
  },
  preview: {
    port: 4173
  }
});
