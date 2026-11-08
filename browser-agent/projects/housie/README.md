# Housie browser project configuration

This directory contains project-specific configuration examples. The shared runner in `../../framework` has no Housie assumptions.

1. Copy `config.example.json` to `../../browser-agent.config.json`. The local config file is git-ignored.
2. Set `BROWSER_AGENT_BASE_URL`, `BROWSER_AGENT_START_URL` and `HOUSIE_PUBLIC_SITE_URL` in your shell or CI variable/secret store. Never commit frontdoor URLs, session IDs, JWT keys or credentials.
3. Housie routes belong under `project.routes`; selectors and test data belong in Housie scenario modules. The generic framework treats `project` as opaque configuration and does not interpret Housie values.
4. Run a standalone scenario with `npm run browser:scenario -- scenarios/capture-org-home.scenario.ts`.

The existing `core/` fixture and `utilities/salesforce.ts` remain as a compatibility layer for legacy Housie Playwright specs. New reusable scenarios should import from `framework/scenario`.
