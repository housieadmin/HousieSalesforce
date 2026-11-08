# Salesforce Browser Agent

A reusable Playwright-based browser execution framework with a compatibility layer for existing Housie tests. The generic framework is project-independent; org URLs, authentication and project behavior are supplied at runtime.

## Architecture

- `framework/`: generic scenario contract, sequential workflow composition, configuration loader and standalone runner. No Housie URLs, selectors, credentials or product assumptions.
- `scenarios/`: scenario modules. Existing `.spec.ts` files remain supported by Playwright; new `.scenario.ts` and `.workflow.ts` modules use the lightweight framework.
- `projects/<project>/`: project-specific configuration examples and extensions.
- `core/` and `utilities/`: legacy Housie Playwright fixture and helpers, retained so existing workflows remain usable.
- `artifacts/`: local-only execution output; never commit generated evidence.

## Configure another Salesforce project

1. Copy `config.example.json` to `browser-agent.config.json` (keep the copied file out of Git).
2. Supply `BROWSER_AGENT_BASE_URL` and, when an initial landing page is useful, `BROWSER_AGENT_START_URL`. Values can also be written as `${ENV_VAR}` references in the JSON config.
3. Authenticate outside generic framework code. For local use, authenticate with Salesforce CLI or another approved method, then supply a session/frontdoor start URL through the environment. In CI, use the project's existing secure authentication workflow and mask sensitive URLs.
4. Put org-specific routes, selectors, test data and behavior in project config or project scenario modules. Keep credentials in environment secrets; never commit them.
5. Install dependencies with `npm install` and run the commands below from `browser-agent/`.

The generic runner does not assume a particular Salesforce domain, org alias, login flow, object model or application.

## Create scenarios and workflows

A scenario exports `defineScenario({ id, run })`. It receives `page`, `config`, `navigate()`, `screenshot()`, `log()` and `note()`. It may perform one action, navigate, inspect, capture evidence or throw on a failed condition. Assertions are optional; a scenario that completes without throwing is recorded as completed; this is not an assertion-based pass.

```ts
import { defineScenario } from "../framework/scenario";

export default defineScenario({
  id: "capture-home",
  async run({ page, screenshot, log }) {
    log("Current page", { title: await page.title(), url: page.url() });
    await screenshot("home");
  }
});
```

Run one scenario independently:

```bash
npm run browser:scenario -- scenarios/capture-org-home.scenario.ts
```

Compose scenarios without copying their logic:

```ts
import { defineWorkflow } from "../framework/scenario";
import captureHome from "./capture-org-home.scenario";
import inspectHome from "./inspect-home.scenario";

export default defineWorkflow({
  id: "home-inspection",
  scenarios: [captureHome, inspectHome]
});
```

Run one or more scenario/workflow modules in order:

```bash
npm run browser:scenario -- scenarios/capture-org-home.scenario.ts scenarios/home-inspection.workflow.ts
```

Relative navigation uses `baseUrl`; absolute URLs work without it. The runner starts at `startUrl` when configured. Each input file receives a fresh browser context. Scenarios inside one workflow share that workflow's page/session and execute sequentially.

## Legacy Playwright scenarios

Existing `*.spec.ts` files continue to run through `npm run browser:run -- scenarios/<name>.spec.ts`. They use the Housie compatibility fixture from `core/`; this is not the recommended contract for new reusable tasks. Existing Housie-specific utilities and selectors remain outside generic framework code.

## Configuration

Supported environment overrides: `BROWSER_AGENT_CONFIG`, `BROWSER_AGENT_BASE_URL`, `BROWSER_AGENT_START_URL`, `BROWSER_AGENT_HEADLESS`, `BROWSER_AGENT_SLOW_MO`, `BROWSER_AGENT_NAVIGATION_TIMEOUT_MS`, `BROWSER_AGENT_ACTION_TIMEOUT_MS`, and `BROWSER_AGENT_ARTIFACT_DIR`. Defaults are generic Chromium settings. No Salesforce credentials are read by the framework.

## Evidence and diagnostics

Each execution creates a unique artifact directory containing `result.json`, `events.json`, screenshots and, when explicitly enabled with `browser.traceOnFailure: true`, a Playwright trace on failure. Traces can contain page data and should be enabled only when the target data is safe to retain. Console errors, page errors, failed requests and HTTP error responses are recorded with URL/token redaction. Evidence capture is available directly from any scenario and is not coupled to assertions or full workflows.

## CI execution and security

The repository's trusted browser workflow can execute legacy specs and new framework scenario/workflow modules from a selected trusted ref. The selected source ref supplies scenario code only; authentication and the target org remain controlled by CI configuration. Scenario files are executable code: only trusted collaborators should trigger runs. Do not log secrets or bearer credentials.
