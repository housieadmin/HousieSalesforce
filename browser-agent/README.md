# Housie Browser Agent

- Uses Playwright Test. No custom scenario runner.
- Housie pages, setup flows, assertions and scenarios stay in this repository.
- Scenarios live in `scenarios/` and import `test` and `expect` from `../core`.
- Housie wrappers live in `utilities/`. Reusable Salesforce browser helpers are implemented in `packages/sf-augment`.
- Redact account bearer keys before screenshots, traces, logs or other retained evidence.
- Configure the target org and credentials through the workflow environment. Never put secrets in scenario code.
- A browser run observes the deployed org; checking out a source ref does not deploy it.
- Only trusted repository collaborators may trigger runs. Treat scenario files as executable code.

Run locally from this directory with `npm install` and `npm run browser:run`.
