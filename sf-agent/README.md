# sf-agent

A project-independent Salesforce automation framework. The core owns configuration, scenario execution, plugin lifecycle, logging and evidence. Two independent importable engines are provided:

- `@sf-agent/sf-cli`: invokes the Salesforce CLI (`sf`) with argument-safe process execution and reusable org login, deploy, retrieve, Apex-test and frontdoor URL helpers.
- `@sf-agent/sf-browser`: owns an independent Playwright browser context and exposes navigation, page access and screenshot evidence.

Scenarios may use either engine, compose both in one run, or consume separately registered utility plugins.

## Workspace

- `core/`: contracts, config loader, plugin host and scenario runner
- `engines/sf-cli/`: CLI library
- `engines/sf-browser/`: browser library
- `plugins/`: reusable utility plugins
- `scenarios/operations/`: reusable operation scenarios
- `sf-agent.config.yml`: one config with named operation groups

Copy `sf-agent.config.example.yml` to `sf-agent.config.yml`. Register each plugin once, then allowlist the engines and utilities available to each operation. Environment values use `${ENV:NAME}`; optional values can use `${ENV:NAME:-default}`. Missing required values fail closed.

The operation scenarios cover deploy, restore, validation, retrieve, Apex tests and deploy-plus-browser-verification. They use neutral configuration and require explicit confirmation for org mutations. The project-tools utility validates paths against the checked-out project and constrains source and manifest selection.

## Plugin contract

An engine plugin exports `createPlugin(options)` returning `{ id, create(options, runtime) }`. A utility plugin uses the same factory shape but is registered with `kind: utility`. Both receive the config directory, cancellation signal, logger and evidence writer. Treat plugins and scenario modules as trusted executable code; there is no remote or implicit auto-discovery.

## Build and execute

```bash
cd sf-agent
npm install
npm run typecheck
npm test
npm run build
node core/dist/cli.js run --config sf-agent.config.yml --operation validate --inputs-json '{"targetOrg":"target-org","manifest":"manifest/package.xml"}'
```

The libraries can be imported independently. The CLI engine uses argument arrays and `shell:false`; the browser engine owns its own Playwright context and does not require a CLI session. Mixed scenarios explicitly hand off short-lived data such as a frontdoor URL.

The repository-level `.project/sf-agent.config.yml` wires the reusable framework to the checked-out project without embedding an org alias or credentials. GitHub Actions uses a single parameterized entry workflow for the common operations; retrieve artifact publication is separated from any later PR-writing workflow by permission boundary.
