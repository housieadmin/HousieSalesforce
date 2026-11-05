# Scenario authoring

AI sessions create Playwright files in this directory. One workflow execution can run multiple files.

Import the shared fixture:
import { test, expect } from "../core";

Each test receives the standard Playwright page and a housie helper:
- housie.login() opens the authenticated Salesforce frontdoor session.
- housie.navigate(pathOrUrl) navigates to an absolute URL or a path relative to the configured Salesforce org.
- housie.screenshot(name) saves and attaches a full-page screenshot.
- housie.note(message) adds context to the diagnostics file.

Use normal Playwright APIs for all other actions and observations. Scenarios may contain multiple test blocks. Adapt selectors and URLs to the actual application; no sample selectors are assumed to work.

Never put credentials, access tokens or other secrets in scenario files.

## Milestone 1 acceptance scenarios

- `inspect-public-housie-app-route.spec.ts` — confirms the public site root mounts HousieApp.
- `verify-signup-grants.spec.ts` — creates an isolated account, verifies ACTIVE status, exact resource balances and four signup resource-ledger index rows; redacts the bearer key before retained artifacts.
- `two-human-waiting-board-setup.spec.ts` — creates two synthetic ACTIVE accounts, creates a private board, joins the second human, reloads both token sessions and verifies both memberships plus one WAITING game.
- `deploy-ticket-service-apex.spec.ts` — user-authorized, narrowly scoped deployment of only `ApexClass:HousieGameTicketService`; performs a dry-run before the real deployment and runs `RunLocalTests`. It records structured component/test/coverage diagnostics even when the Salesforce CLI exits non-zero. Do not broaden its metadata selection.
- `two-human-ticket-purchase.spec.ts` — run only after the targeted Apex deployment succeeds. Verifies two distinct MANUAL tickets/layouts, reserved balances, wallet-hold/resource rows, participant records, withdrawal of both tickets, release ledger rows and a fresh repurchase.
- `ticket-withdrawal-regression.spec.ts` — separate fixed-fixture regression for WAITING withdrawal and repurchase; same Apex deployment gate.
- `suspend-milestone1-synthetic-accounts.spec.ts` — suspends only accounts created by these Milestone 1 scenarios; it never reads account keys or emails.
- `validate-housie-code-source-roundtrip.spec.ts` — read-only curated retrieve. It allows only the explicitly documented comment-only difference in `HousieOperationService.cls`; every other Apex delta remains a failure.

Big Object queries must use Bulk API 2.0 and index columns only. Do not use REST `sf data query` or `sf sobject describe` for Big Objects.
