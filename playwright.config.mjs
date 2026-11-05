import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  // The software (SwiftShader) renderer in CI needs >1 s per frame on the full HD-2D scene, so the
  // longest flows (quality tiers x camera switch) take 30-36 s. A hung wait still fails: every poll
  // and expect below keeps its own, much shorter limit.
  timeout: 90_000,
  expect: { timeout: 12_000 },
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"] } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], launchOptions: { args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"] } } },
  ],
  use: { baseURL: "http://127.0.0.1:4173/Pixel-Games/", trace: "retain-on-failure" },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/Pixel-Games/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
