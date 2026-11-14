# GitHub Actions

## Workflow responsibilities

Workflows are thin orchestration layers. They define triggers and permissions, check out source, install required tools, map secrets, invoke application modules, and publish artifacts.

Application logic lives in `src/`. Reusable Salesforce functions live in `packages/sf-augment/src/`. Housie-specific test fixtures, browser tests and redaction rules stay in `tests/`.

| Workflow | Responsibility |
|---|---|
| Node tests | Unit tests for Housie modules and the shared package |
| Salesforce PR Validation | Metadata validation and org-local Apex tests |
| Salesforce Manual Validation | Validate a selected source ref and manifest |
| Salesforce AI Iteration Deploy | Deploy selected feature-branch metadata |
| Salesforce Deploy and Browser Verification | Deploy, then run selected browser tests |
| Salesforce AI Iteration Restore | Restore selected metadata from a known-good ref |
| Salesforce Controlled Deployment | Deploy a reviewed release manifest |
| Salesforce Org Metadata Sync | Retrieve selected org metadata and open a PR |
| Salesforce Issue Commands | Validate and dispatch owner-only `/sf` commands |
| Housie Browser | Run selected Playwright browser tests |

## Test layout and commands

- Unit tests: `tests/unit/`
- Browser tests: `tests/browser/`
- Shared test fixtures and Housie helpers: `tests/`
- Playwright configuration: `playwright.config.ts`

Run unit and shared-package tests with `npm test`. Run browser tests against the configured test org with `npm run test:browser`.

Issue #9 accepts the following command from repository owners, members or collaborators:

```text
/browser run
ref: feature/my-change
scenarios:
- tests/browser/inspect-housie-account.spec.ts
description: Verify the account flow
```

The browser workflow checks out trusted runtime code from `main`, checks out the requested test ref separately, stages only the selected test files, then runs Playwright. Browser test code executes with access to the workflow environment. Use only trusted refs.

## Salesforce commands

Issue #11 accepts owner-only commands. Paths must be explicit and under `force-app/`.

```text
/sf deploy
ref: feature/my-change
paths:
- force-app/main/default/classes/HousieAccountService.cls
tests: none
confirm: DEPLOY
```

```text
/sf deploy-and-verify
ref: feature/my-change
paths:
- force-app/main/default/classes/HousieAccountService.cls
scenarios:
- tests/browser/inspect-housie-account.spec.ts
confirm: DEPLOY
```

```text
/sf restore
ref: main
paths:
- force-app/main/default/classes/HousieAccountService.cls
confirm: RESTORE
```

```text
/sf retrieve
paths:
- force-app/main/default/classes/HousieBoardService.cls
create_pr: true
```

Retrieve can also use one XML manifest under `manifest/`. With no path, it uses `manifest/package-retrieve.xml`.

## Required GitHub configuration

Repository Actions secrets:
- `SF_CLIENT_ID`
- `SF_USERNAME`
- `SF_JWT_KEY`

Repository Actions variable:
- `SF_INSTANCE_URL`

Use a dedicated least-privilege Salesforce integration user. Keep the JWT private key only in GitHub Secrets. Configure the `development` Environment for controlled deployments and allow Actions to create PRs for org sync.

## Safety

- Push the source ref before dispatching. Workflows cannot use uncommitted local files.
- Deployment and restore require exact `DEPLOY` / `RESTORE` confirmation.
- Workflows serialize writes to the shared development org.
- Org retrieval creates a branch and PR; it never writes directly to `main`.
- A metadata dry run is not a deployment. `RunLocalTests` runs tests already deployed in the org, not test classes that exist only on the source branch.
- Live Salesforce deployment, retrieval and browser execution were not performed as part of this package redesign; those require configured org credentials and explicit execution.
