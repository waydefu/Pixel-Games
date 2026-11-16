import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/harbour",
  // First remote trace: mobile boot 27 s, real touch dispatches 21-30 s each,
  // UI actionability 15-32 s each on SwiftShader; save+reload needs a 360 s bound.
  // This changes no scene/resolution and is not a device-performance acceptance.
  timeout: 360_000,
  expect: { timeout: 12_000 },
  workers: process.env.CI ? 1 : undefined,
  retries: 0,
  reporter: process.env.CI ? "line" : "list",
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"] } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], launchOptions: { args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"] } } },
  ],
  use: { baseURL: "http://127.0.0.1:4173/", trace: "retain-on-failure" },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
