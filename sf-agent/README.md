# sf-agent

Project-independent Salesforce automation framework. The core owns configuration, scenario execution, plugin lifecycle, logging and evidence. The two independent importable engines are `@sf-agent/sf-cli` (the `sf` executable) and `@sf-agent/sf-browser` (Playwright). Scenarios can use either engine or compose both.

## Layout
- `core/`: contracts, config loader, plugin host and runner
- `engines/sf-cli/`: CLI library
- `engines/sf-browser/`: browser library
- `scenarios/`: project-owned scenarios
- `sf-agent.config.yml`: one config with named operation groups

Copy `sf-agent.config.example.yml` to `sf-agent.config.yml`. Plugins are registered explicitly; operations declare which engines they may access. Environment values use `${ENV:NAME}`; missing variables fail closed. A scenario exports a default object created with `defineScenario` and receives operation inputs, logging, evidence and typed engine access.

A plugin module exports `createPlugin(options)` and returns `{ id, create(options, runtime) }`. Treat plugin and scenario modules as trusted executable code; no remote auto-discovery is performed.

## Build and execute
```bash
cd sf-agent
npm install
npm run typecheck
npm test
npm run build
node core/dist/cli.js run --config sf-agent.config.yml --operation deploy-and-verify
```

The libraries can be imported independently. The CLI engine uses argument arrays and `shell:false`. The browser engine owns its Playwright context and does not require a CLI session. Authentication must be supplied through an explicit integration; no org-specific credentials or aliases are embedded here.

This is the initial foundation, not a claim that legacy operations have been migrated. Deploy/restore policy, authentication integration and workflow adapters are subsequent work.