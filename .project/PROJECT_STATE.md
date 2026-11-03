# Project state

**Last reviewed baseline:** `main` at `188a6a397b5e5257b861ad27e08d71f760a0a6a3` (before this continuity-note update)  
**Review date:** 2026-11-03  
**Purpose:** Compact orientation only. Re-verify branch and commit before relying on this snapshot.

## Product

Build an automated multiplayer Housie/Tambola platform. Product behaviour is specified in `docs/SPEC.md`; the technology-independent logical model is in `docs/DATA_MODEL.md`.

## Repository at the reviewed baseline

Salesforce DX project with Apex services, LWC bundles, permission sets, custom/Big Object metadata and GitHub Actions for validation, deployment, browser-agent execution and metadata sync. The reviewed tree includes the project continuity router under `.project/`.

## Implemented source slices observed

- Account setup and signup resource grants.
- Board creation, owner membership, private join by board ID, public directory/join and membership operations.
- Human ticket generation, purchase in WAITING games, wallet holds/ledger records and automatic-token consumption.
- WAITING-game human-ticket withdrawal and release.
- Board Hub purchase, preview and withdrawal UI.

These are source observations, not claims of full runtime verification.

## Active defect investigation — ticket purchase transaction ordering

A public ticket-purchase failure reported Salesforce's pending-uncommitted-work error. The root cause was identified in `HousieGameTicketService` completion: `commandResult(command)` read Ticket and operation-journal Big Objects after standard-object DML. The correction materializes the result/Big Object reads before standard-object DML.

- Fix commit: [`e1aaac7e1f95c031033c8c7869048b901c919b1b`](https://github.com/housieadmin/HousieSalesforce/commit/e1aaac7e1f95c031033c8c7869048b901c919b1b), on `test/callout-transaction-e2e-v2`.
- Verified deployment and browser scenario: [combined run 41660185471](https://github.com/housieadmin/HousieSalesforce/actions/runs/41660185471).
- Fresh recovery + second-ticket purchase: [run 41658822433](https://github.com/housieadmin/HousieSalesforce/actions/runs/41658822433); repeat stability: [run 41659285721](https://github.com/housieadmin/HousieSalesforce/actions/runs/41659285721).
- **Important:** this correction was deployed to the Developer Edition from the feature branch but was not merged to `main` in the repository state reviewed. Do not describe it as part of main/release yet. PR #8 is an earlier transaction-boundary diagnostic branch, not the final fix.
- Test User 2 has two active tickets (configured cap); do not attempt another purchase on that fixture.

See [the originating session record](sessions/2026-11-03-ticket-purchase-transaction-fix.md) for root-cause detail, false leads, exact browser route, workflow invocation and next steps.

## Major incomplete product areas observed

Full game lifecycle and start approvals; bot offers/funding; number calling and marking; claims and validation; category closure, payouts and settlement; admin rotation and recovery; secure session lifecycle; chat/presence and progression; durable repair processing; comprehensive integration/security/concurrency/load testing.

## Verification limits

The ticket-purchase scenario verifies a narrow public purchase/recovery path, not end-to-end gameplay or all transaction paths. Deployment success, Apex test success, browser verification and feature-branch merge/release are separate facts. Live org automation and all Experience Cloud configuration have not been comprehensively inspected.

## Detailed references

Read these only when the task needs them:
- `docs/BUILD_STATUS.md` — feature-level implementation and release gate.
- `docs/ARCHITECTURE.md` — technical integrity constraints.
- `docs/DATA_MODEL_MAPPING.md` — Salesforce-to-logical-model mapping.
- `docs/DEPLOYMENT_ERRORS_FIXED.md` — deployment error mapping.
- `docs/GITHUB_ACTIONS.md` — workflow operations.

## Snapshot maintenance

Update this file only when a material repository/product baseline change makes the summary misleading. Re-check evidence and update the main SHA/date. Do not infer the state of independently managed workstreams.
