import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// GitHub Project Pages path. Does NOT enable deployment by itself.
// Preview server respects the /Pixel-Games/ base after build.
export default defineConfig({
  base: "/Pixel-Games/",
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL("./index.html", import.meta.url)),
        lab: fileURLToPath(new URL("./lab/index.html", import.meta.url)),
      },
    },
  },
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
});
