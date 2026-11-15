import { defineConfig } from "vite";
export default defineConfig({
  root: ".",
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 100000000, cssCodeSplit: false, modulePreload: false, chunkSizeWarningLimit: 100000,
    rollupOptions: { output: { codeSplitting: false } } },
  logLevel: "warn",
});
