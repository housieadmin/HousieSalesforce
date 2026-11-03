# Housie Browser Agent

This is a browser execution framework, not a QA suite or autonomous testing agent. AI coding sessions author Playwright scenario files. The framework launches Chromium, authenticates to the configured Salesforce org, executes selected files, and publishes evidence.

## Repository conventions
- core/: small, stable shared browser fixture and framework helpers.
- utilities/: reusable helpers added when a real scenario needs them.
- scenarios/: AI-authored Playwright spec files.
- artifacts/: local-only output. Never commit generated execution artifacts.

Do not build utilities speculatively. Add helpers under utilities/ when a scenario needs reusable behavior. Extend core/ only for framework-wide capabilities. Document new utilities so later sessions can reuse them.

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
Post a comment on this dedicated execution issue:
https://github.com/housieadmin/HousieSalesforce/issues/9

Use this format:

/browser-agent run
ref: feature/my-change
scenarios:
- browser-agent/scenarios/account-flow.spec.ts
- browser-agent/scenarios/callout-check.spec.ts
description: Observe account creation after the callout fix

The ref must already be pushed. Scenario paths must be committed on that ref and live under browser-agent/scenarios/. Only repository owners, members and collaborators can trigger runs.

Important: the ref selects scenario source code. It does not deploy that ref to Salesforce. The browser always operates against the org configured in the GitHub development environment. The workflow definition itself is loaded from the default branch.

## Evidence
One GitHub Actions artifact is uploaded per execution, containing the Playwright JSON report and Markdown summary, screenshots, failure traces and videos, console errors, page errors, failed requests, HTTP error responses, run metadata and scenario notes.

Artifacts are not committed to Git. Each artifact name includes the workflow run ID and attempt number. Retention is 14 days.

## Authentication and setup
The workflow reuses the Salesforce JWT configuration used by the deployment workflows:
- Environment secret SF_JWT_KEY
- Environment secret SF_CLIENT_ID
- Environment secret SF_USERNAME
- Environment variable SF_INSTANCE_URL

These must be available as repository-level GitHub Actions secrets and variables, matching the scope used by the existing Salesforce AI iteration deployment workflow. Salesforce CLI JWT login generates a temporary frontdoor URL; it is masked and kept only in the runner environment. The browser workflow intentionally does not depend on an environment approval gate.

The workflow has contents:read and issues:write permissions. The browser runner does not have repository write permission.

## Safety
Scenario files are executable code. Only trusted repository collaborators may request execution, and only trusted code should be placed on an execution ref. Never include secrets in scenario source, screenshots, console output or notes. The runner does not commit generated files.

The browser observes the live org, not the checked-out source tree. Record the deployed commit or deployment run in the execution description when relevant.