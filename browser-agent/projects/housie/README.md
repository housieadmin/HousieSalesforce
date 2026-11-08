# Housie browser project configuration

This directory contains project-specific configuration examples. The shared runner in `../../framework` has no Housie assumptions.

1. Copy `../../config.example.json` to `../../browser-agent.config.json`.
2. Set `BROWSER_AGENT_BASE_URL` and `BROWSER_AGENT_START_URL` in your shell or CI secret/variable store. Do not commit frontdoor URLs, session IDs, JWT keys or credentials.
3. Put Housie routes, selectors and test data in Housie scenario modules or the `project` configuration object, not in framework code.
4. Run a standalone scenario with `npm run browser:scenario -- scenarios/capture-org-home.scenario.ts`.

The existing `core/` fixture and `utilities/salesforce.ts` are retained as a compatibility layer for legacy Housie Playwright specs. New project-independent scenarios should import from `framework/scenario`.
