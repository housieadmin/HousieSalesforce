import { defineConfig } from "@playwright/test";
import path from "node:path";

const artifactDir = path.resolve(process.env.E2E_ARTIFACT_DIR || "artifacts/e2e");

export default defineConfig({
  testDir: "./tests/e2e",
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
