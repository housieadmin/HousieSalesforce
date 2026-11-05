# Housie Browser Agent

This is a browser execution framework, not a QA suite or autonomous testing agent. AI coding sessions author Playwright scenario files. The framework launches Chromium, authenticates to the configured Salesforce org, executes selected files, and publishes evidence.

## Repository conventions
- core/: stable shared Playwright fixture and framework-wide diagnostics.
- utilities/: small reusable modules that accept Playwright objects and expose explicit functions.
- scenarios/: independently runnable setup, inspection and regression specs.
- artifacts/: local-only output. Never commit generated execution artifacts.

Prefer a utility when two or more scenarios share a real operation. Keep utilities focused and explicit: document arguments, side effects, credential handling and example usage. Do not hide test assertions or product decisions inside generic helpers.

## Reusable Salesforce utilities
Import `openLightningTab(page, path, targetOrg?)` from `../utilities/salesforce` to open a Lightning route through an authenticated Salesforce CLI frontdoor session. Import `redactAccountKey(page)` immediately after account creation; the account key is a bearer route credential and must be redacted before assertions, screenshots, traces or failure artifacts.

## Writing scenarios
Import test and expect from ../core in files directly under scenarios/. Use a deeper relative import for nested folders.

Each test receives:
- page: normal Playwright page.
- housie.login(): opens the authenticated Salesforce frontdoor session.
- housie.navigate(pathOrUrl): navigates to an absolute URL or a path relative to the configured org.
- housie.screenshot(name): saves and attaches a full-page screenshot.
- housie.note(message): adds context to browser diagnostics.

Use standard Playwright APIs for all other interactions. A scenario can contain multiple test blocks. One workflow run can execute up to 10 scenario files.

## Trigger from an AI session
Post a comment on this dedicated execution issue: https://github.com/housieadmin/HousieSalesforce/issues/9

Use this format:

/browser-agent run
ref: feature/my-change
scenarios:
- browser-agent/scenarios/account-flow.spec.ts
- browser-agent/scenarios/callout-check.spec.ts
description: Observe account creation after the callout fix

The ref must already be pushed. Scenario paths must be committed on that ref and live under browser-agent/scenarios/. Only repository owners, members and collaborators can trigger runs.

The ref selects scenario source code. It does not deploy that ref to Salesforce. The browser always operates against the org configured in the GitHub development environment. The workflow definition itself is loaded from the default branch.

## Evidence
One GitHub Actions artifact is uploaded per execution, containing the Playwright JSON report and Markdown summary, screenshots, failure traces and videos, console errors, page errors, failed requests, HTTP error responses, run metadata and scenario notes. Artifacts are not committed to Git; retention is 14 days.

## Authentication and setup
The workflow reuses the Salesforce JWT configuration used by the deployment workflows: SF_JWT_KEY, SF_CLIENT_ID, SF_USERNAME and SF_INSTANCE_URL. These must be available as repository-level GitHub Actions secrets and variables, matching the scope used by the existing Salesforce AI iteration deployment workflow. Salesforce CLI JWT login generates a temporary frontdoor URL; it is masked and kept only in the runner environment. The browser workflow intentionally does not depend on an environment approval gate.

The workflow has contents:read and issues:write permissions. The browser runner does not have repository write permission.

## Safety
Scenario files are executable code. Only trusted repository collaborators may request execution, and only trusted code should be placed on an execution ref. Never include secrets in scenario source, screenshots, console output or notes. The runner does not commit generated files.

The browser observes the live org, not the checked-out source tree. Record the deployed commit or deployment run in the execution description when relevant.
