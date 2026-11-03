# Project state

**Last reviewed baseline:** `main` at `5637e00fd0461ecc02f89c3db7b74d2407ee4ea9`  
**Review date:** 2026-11-03  
**Purpose:** Compact orientation only. Re-verify branch and commit before relying on this snapshot.

## Product
Build an automated multiplayer Housie/Tambola platform. Product behaviour is specified in `docs/SPEC.md`; the technology-independent logical model is in `docs/DATA_MODEL.md`.

## Repository at the reviewed baseline
Salesforce DX project with Apex services, four LWC bundles, permission sets, custom/Big Object metadata and GitHub Actions for validation, deployment, browser-agent execution and metadata sync. The reviewed tree had no committed Flow, Apex trigger, Aura or ExperienceBundle source.

## Implemented source slices observed
- Account setup and signup resource grants.
- Board creation, owner membership, private join by board ID, public directory/join and membership operations.
- Human ticket generation and purchase in WAITING games.
- Manual/automatic mode selection, wallet holds/ledger records and automatic-token consumption.
- WAITING-game human-ticket withdrawal and release.
- Board Hub purchase, preview and withdrawal UI.

These are source observations, not claims of full runtime verification.

## Major incomplete product areas observed
Full game lifecycle and start approvals; bot offers/funding; number calling and marking; claims and validation; category closure, payouts and settlement; admin rotation and recovery; secure session lifecycle; chat/presence and progression; durable repair processing; comprehensive integration/security/concurrency/load testing.

## Verification limits
The baseline review found one Apex test class focused mainly on domain helpers and ticket-layout rules. Browser-agent infrastructure existed, but navigation smoke coverage did not establish end-to-end gameplay. Live org automation and Experience Cloud configuration were not inspected.

## Detailed references
Read these only when the task needs them:
- `IMPLEMENTATION_STATUS.md` — feature-level implementation assessment.
- `REQUIREMENTS_TRACEABILITY.md` — requirement-to-source mapping.
- `ARCHITECTURE_DECISIONS.md` — integrity and design invariants.
- `KNOWN_ISSUES.md` — confirmed discrepancies.

## Snapshot maintenance
Update this file only when a material repository/product baseline change makes the summary misleading. Record the new main SHA/date and re-check evidence. Do not infer the state of independently managed workstreams.
