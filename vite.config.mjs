import { defineConfig } from "vite";

// Single entry: visiting /Pixel-Games/ loads the immersive world immediately.
// Only original code is included in the build, and Pages base remains unchanged.
export default defineConfig({
  base: "/Pixel-Games/",
  build: { target: "es2022" },
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
});
