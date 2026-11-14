import { defineConfig } from "@playwright/test";
import path from "node:path";

const artifactDir = path.resolve(process.env.BROWSER_ARTIFACT_DIR || "artifacts/browser");

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 15000 },
  outputDir: path.join(artifactDir, "test-results"),
  reporter: [["list"], ["json", { outputFile: path.join(artifactDir, "playwright-report.json") }]],
  use: {
    browserName: "chromium",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20000,
    navigationTimeout: 45000
  }
});
