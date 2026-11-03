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

## Open implementation work

- [PR #22 — ticket-purchase completion transaction ordering](https://github.com/housieadmin/HousieSalesforce/pull/22) carries the fix for Big Object result reads occurring after standard-object DML. Earlier feature-branch runtime runs demonstrated recovery and a fresh second-ticket purchase; the PR-head validation and runtime verification must be assessed separately.
- Do not treat a feature-branch deployment as a merge to `main` or as proof that unrelated ticket, withdrawal, gameplay or concurrency paths are verified.

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
