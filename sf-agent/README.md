# sf-agent

Project-independent Salesforce automation framework. The core owns config, scenario execution, plugin lifecycle, logging and evidence. Two independent importable engines are provided: `@sf-agent/cli` for the `sf` executable and `@sf-agent/browser` for Playwright. A scenario may use either engine or compose both.

## Layout
- `core/`: contracts, config loader, plugin host and runner
- `engines/sf-cli/`: CLI library
- `engines/sf-browser/`: browser library
- `scenarios/`: project-owned scenarios
- `sf-agent.config.yml`: one execution config, with named operation groups

Copy `sf-agent.config.example.yml` to `sf-agent.config.yml`. Plugins are registered explicitly; operations declare which engines they may access. Environment values use `${ENV:NAME}` and missing variables fail closed.

A scenario exports a default object created with `defineScenario`. It receives merged operation inputs, structured logging, evidence and typed access to enabled engines. See `scenarios/mixed-engine.example.ts`.

The engines can also be imported directly. The CLI library accepts argument arrays and starts processes with `shell:false`. The browser library owns a Playwright context and does not require an active CLI session.

## Plugin contract
A plugin module exports `createPlugin(options)` and returns `{ id, create(options, runtime) }`. Runtime services include config directory, cancellation signal, logger and evidence writer. Treat plugins and scenario modules as trusted executable code; no remote auto-discovery is performed.

## Build and execute
```bash
cd sf-agent
npm install
npm run typecheck
npm test
npm run build
node core/dist/cli.js run --config sf-agent.config.yml --operation deploy-and-verify
```

This is the framework foundation, not a claim that legacy operations have been migrated. Deploy/restore policy, authentication integration and workflow adapters are subsequent migration work. The browser engine deliberately does not assume CLI authentication; authenticated browser sessions must be provided through a separately reviewed integration.
