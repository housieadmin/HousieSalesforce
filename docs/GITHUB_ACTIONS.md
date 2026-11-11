# GitHub Actions

## Workflows

| Workflow | Purpose |
|---|---|
| Node tests | Runs unit tests for Housie and `sf-augment` |
| Salesforce PR Validation | Metadata dry run and org-local Apex tests |
| Salesforce Manual Validation | Validates a selected ref and manifest |
| Salesforce AI Iteration Deploy | Deploys selected feature-branch metadata |
| Salesforce Deploy and Browser Verification | Deploys, then runs selected E2E tests |
| Salesforce AI Iteration Restore | Restores selected metadata from a known-good ref |
| Salesforce Controlled Deployment | Deploys a reviewed release manifest from `main` |
| Salesforce Org Metadata Sync | Retrieves selected metadata and opens a PR |
| Salesforce Issue Commands | Validates and dispatches `/sf` commands |
| Housie E2E | Runs selected Playwright tests |

Workflows are orchestration only. Application logic is in `src/`; reusable Salesforce functions are in `packages/sf-augment/src/`.

## E2E tests

- Playwright config: `playwright.config.ts`
- Scenarios: `tests/e2e/`
- Fixtures/helpers: `tests/`
- Unit tests: `tests/unit/`
- Run locally: `npm install`, then `npm test` or `npm run e2e`

Issue #9 accepts:

```text
/e2e run
ref: feature/my-change
scenarios:
- tests/e2e/inspect-housie-account.spec.ts
description: Verify the account flow
```

The E2E workflow checks out trusted runtime code from `main`, checks out the requested scenario ref separately, stages only selected tests, then runs Playwright. Use only trusted refs; test code executes with access to the workflow environment.

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
- tests/e2e/inspect-housie-account.spec.ts
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
- No E2E run has occurred as part of this PR; run against the configured test org before relying on it.
