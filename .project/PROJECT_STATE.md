# Project state

**Last reviewed baseline:** `main` at `2e440605ec2ffe9954c7436e771af27a00f855e5`  
**Review date:** 2026-11-04  
**Purpose:** Compact orientation only. The active roadmap is [MILESTONES.md](MILESTONES.md); verify current `main` before implementation.

## Product

Build an automated multiplayer Housie/Tambola platform. Product behaviour is specified in `docs/SPEC.md`; the technology-independent logical model is in `docs/DATA_MODEL.md`.

## Implemented source slices

- Account setup and signup resource grants.
- Board creation, owner membership, private join, public directory/join and membership operations.
- Human ticket generation, purchase and WAITING-game withdrawal.
- Wallet holds/ledger records and automatic-token consumption.
- Board Hub purchase, preview, withdrawal UI, pending-command retry and purchase-stage diagnostics.
- Durable ticket-command prepare / Big Object persist / completion flow with a per-game command gate.
- Transaction-order correction merged in [PR #24](https://github.com/housieadmin/HousieSalesforce/pull/24).

These are implementation observations, not claims that the complete game is playable.

## Current implementation boundary

- `HousieGameService.submitCommand()` currently records a `COMMAND_RECEIVED` event; it is not a game action engine.
- `HousieScheduler.execute()` currently logs a heartbeat; it does not call numbers or repair pending operations.
- `HousieSimulationController` writes developer simulation audit records; its scenario names are not implemented product features.

## Completed recent milestone

**Ticket-purchase transaction-boundary fix — complete (2026-11-04).** PR #24 merged at `2e440605ec2ffe9954c7436e771af27a00f855e5`. Metadata validation, the configured org-resident Apex test step, targeted deployment of four transaction-boundary Apex classes, public Experience Cloud purchase regression and fixture cleanup succeeded. The browser scenario created two distinct active tickets without the pending-uncommitted-work error. See [session evidence](sessions/2026-11-04-ticket-purchase-transaction-fix-status.md).

The PR validation workflow's `RunLocalTests` step executes tests already deployed in the Developer Edition; it does not execute branch-only Apex test classes. Do not overstate that evidence. Do not rerun the completed ticket-purchase checks routinely; reopen only for a concrete regression or specific new evidence gap.

## Major incomplete product areas

General PENDING-journal and stale-command recovery; bot offers/funding/revisions/cancellation; ticket flips; game-start approvals and wallet capture; number calling and marking; automatic play and claims; admin rotation, pause/resume and missed-call recovery; category closure, cancellation, payouts and settlement; secure session lifecycle; Experience Cloud public-launch configuration; chat/presence/progression; paging; integration/concurrency/load/security coverage.

## Important architecture constraints

- Big Object writes are non-transactional; the journal protocol provides fail-closed visibility, not native rollback or multi-record atomicity.
- The Big Object writer does not take the standard-object infrastructure lock. That lock is limited to selected DML-only transactions; the per-game command gate currently protects ticket purchase/withdrawal.
- Account keys currently act as bearer secrets. Do not expose them or enable broad public account-specific access without proper session controls.
- Do not describe the product as end-to-end playable or process production points until game execution, recovery, settlement and security controls are implemented.

## Navigation

- `.project/MILESTONES.md` — next deliverables, order and acceptance criteria.
- `.project/README.md` — session continuity and working rules.
- `docs/BUILD_STATUS.md` — detailed implementation/release status.
- `docs/SPEC.md`, `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md` — product and technical contracts.
