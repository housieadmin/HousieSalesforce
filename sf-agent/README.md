# sf-agent

A project-independent Salesforce automation framework. The core owns configuration, scenario execution, plugin lifecycle, logging and evidence. Two independent importable engines are provided:

- `@sf-agent/sf-cli`: invokes the Salesforce CLI (`sf`) with argument-safe process execution and reusable org/deploy/retrieve/test helpers.
- `@sf-agent/sf-browser`: owns an independent Playwright browser context and exposes navigation, page access and screenshot evidence.

Scenarios may use either engine, compose both in one run, or consume separately registered utility plugins.

## Workspace

- `core/`: contracts, config loader, plugin host and runner
- `engines/sf-cli/`: CLI library
- `engines/sf-browser/`: browser library
- `plugins/`: optional reusable utility plugins
- `scenarios/`: project-owned scenarios
- `sf-agent.config.yml`: one config with named operation groups

Copy `sf-agent.config.example.yml` to `sf-agent.config.yml`. Register each plugin once, then allowlist the engines and utilities available to each operation. Environment values use `${ENV:NAME}`; optional values can use `${ENV:NAME:-default}`. Missing required values fail closed.

A scenario exports a default object created with `defineScenario` from `@sf-agent/core`. It receives merged operation inputs, structured logging, evidence output, and typed access to only the engines and utilities declared by its operation.

## Plugin contract

An engine plugin exports `createPlugin(options)` returning `{ id, create(options, runtime) }`. A utility plugin uses the same factory shape but is registered with `kind: utility`. Both receive the config directory, cancellation signal, logger and evidence writer. Treat plugins and scenario modules as trusted executable code; there is no remote or implicit auto-discovery.

## Example

`scenarios/mixed-engine.example.ts` composes CLI validation, a short-lived Salesforce frontdoor URL and a separate browser session. The CLI library can also be imported directly without the framework runner:

```ts
import { SfCliEngine } from "@sf-agent/sf-cli";
const cli = new SfCliEngine({ binary: "sf" });
await cli.run(["org", "display", "--target-org", "target-org"]);
```

## Build and execute

```bash
cd sf-agent
npm install
npm run typecheck
npm test
npm run build
node core/dist/cli.js run --config sf-agent.config.yml --operation deploy-and-verify
```

The framework foundation is not yet a claim that legacy operations have been migrated. Workflow adapters, existing operation parity and browser authentication scenarios are subsequent migration work. The browser engine does not require an active CLI session; mixed scenarios explicitly hand off a URL or other data between independent contexts.
