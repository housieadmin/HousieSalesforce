# Repository instructions

- Read `.project/README.md` and relevant product specifications before changing application behavior.
- Keep application modules in `src/`; each module has one responsibility.
- Put unit tests in `tests/unit/` and Playwright browser tests in `tests/browser/`.
- Put test fixtures and helpers under `tests/`. Do not create a separate browser-agent project.
- Keep project-specific pages, scenarios, org settings, manifests and business rules in Housie.
- Keep reusable Salesforce functions in `packages/sf-augment`. No Housie names, org aliases, paths, URLs, credentials or business rules in that package.
- Inspect existing code and dependencies before adding functionality. Reuse Salesforce CLI, Playwright and library capabilities before writing wrappers.
- Keep each reusable function small, explicit and independently testable. Pass orgs, paths and URLs as arguments.
- Keep workflows to triggers, permissions, checkout, setup, secrets, artifacts and calls into `src/`.
- Run `npm test` after Node changes. Run browser tests only against the configured test org.
- Do not deploy, merge or change org/security settings without explicit authorization.
