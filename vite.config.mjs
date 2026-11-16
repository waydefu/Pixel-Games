import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";

const commit = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
// Test and deploy the same standalone file, never the old public/ assets.
export default defineConfig({
  base: "./",
  publicDir: false,
  build: {
    target: "es2022",
    modulePreload: false,
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    rolldownOptions: { output: { codeSplitting: false } },
  },
  plugins: [{
    name: "mainline-provenance",
    transformIndexHtml: {
      order: "post",
      handler: () => [
        { tag: "meta", attrs: { name: "pixel-games-mainline", content: "saint-aldric" }, injectTo: "head" },
        { tag: "meta", attrs: { name: "pixel-games-build", content: commit }, injectTo: "head" },
      ],
    },
  }],
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
});
