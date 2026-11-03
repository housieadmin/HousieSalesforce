# Project state

**Baseline branch:** `main`  
**Baseline commit:** `5637e00fd0461ecc02f89c3db7b74d2407ee4ea9`  
**Baseline date:** 2026-11-03  
**Purpose:** Cross-session project state snapshot. Re-verify before relying on it.

## Product objective

Build an automated multiplayer Housie/Tambola platform with persistent accounts and boards, paid human and bot tickets, automated/manual gameplay, claims, game wallets and settlement, administration, chat and progression. The complete behavioural requirements are in `docs/SPEC.md`.

## Authoritative baseline documents

- `docs/SPEC.md` — product requirements, version 1.0.
- `docs/DATA_MODEL.md` — logical data model, version 1.0, 16 entities.
- `docs/DATA_MODEL_MAPPING.md` — Salesforce mapping.
- `docs/ARCHITECTURE.md` — current documented architecture; verify against source before relying on details.
- `docs/BUILD_STATUS.md` — existing status document, but its opening and validation sections are stale as of this baseline.

## Repository shape observed

- Salesforce DX project.
- Apex services and one Apex test class.
- Four LWC bundles: account admin, application shell, board hub and simulation panel.
- Permission sets and custom/Big Object metadata.
- GitHub Actions for validation, deployment, browser-agent execution and metadata sync.
- No committed Flow metadata, Apex triggers, Aura source or ExperienceBundle source was present in the reviewed tree.

## Implemented vertical slices observed in source

- Account setup and signup resource grants.
- Board creation, owner membership, private invitation by board ID, public board directory/join, membership listing and leave checks.
- Human ticket layout generation and WAITING-game purchase.
- Manual/automatic ticket-mode selection, wallet hold/ledger records and automatic-token consumption.
- WAITING-game human-ticket withdrawal and release.
- Board Hub ticket purchase, preview and withdrawal UI.

These are implementation observations, not a claim that every path is runtime-verified or production-ready.

## Material incomplete product areas

- Game start approvals and capture of pre-game holds into the Game Wallet.
- Bot offers, contributor acceptance/revision workflow and bot funding.
- Number calling, manual marking, automatic marking, automatic claims and claim validation.
- Admin presence/rotation, pause/resume, missed-call recovery and game lifecycle orchestration.
- Category closure, disqualification, payout and settlement.
- Authentication/session lifecycle and secure invitation/session handling.
- Chat and presence, achievements and leaderboards.
- Durable repair processing and comprehensive integration/security/concurrency/load tests.

See `IMPLEMENTATION_STATUS.md` and `REQUIREMENTS_TRACEABILITY.md` for the more granular breakdown.

## Verification limits

- Static source review was performed for the baseline.
- The only Apex test class observed was `HousieDomainRulesTest`; it primarily tests domain helpers and ticket-layout rules.
- The repository test script runs that test class; this is not broad service or end-to-end coverage.
- Browser-agent infrastructure exists, but a passing navigation/smoke scenario is not proof that purchase, gameplay or settlement works end to end.
- No direct inspection of live Salesforce org automation, active Flows, or Experience Cloud configuration is asserted by this snapshot.

## Current-session exclusions

Separate workstreams remain independently managed. Do not infer their state, include their defects in this session's issue list, or make changes to them without an explicit status handoff from their owner.

## Update protocol

When the default branch changes materially:
1. Record the new commit SHA and date.
2. Recheck the source tree and changed code.
3. Update implementation status and traceability only where evidence supports a change.
4. Keep runtime verification separate from source/deployment validation.
5. Record unresolved discrepancies in `KNOWN_ISSUES.md`.
