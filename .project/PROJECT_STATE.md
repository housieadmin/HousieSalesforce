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
- Board Hub purchase, preview, withdrawal UI and purchase-stage diagnostics.
- Durable ticket-command prepare / Big Object persist / completion flow with per-game command gate.
- Transaction-order correction merged in [PR #24](https://github.com/housieadmin/HousieSalesforce/pull/24).

These are implementation observations, not claims that the complete game is playable.

## Completed recent milestone

**Ticket-purchase transaction-boundary fix — complete (2026-11-04).** PR #24 merged at `2e440605ec2ffe9954c7436e771af27a00f855e5`. PR validation, targeted Developer Edition deployment, public Experience Cloud purchase regression and fixture cleanup all passed. The browser test created two distinct active tickets and did not reproduce the pending-uncommitted-work error. See [session evidence](sessions/2026-11-04-ticket-purchase-transaction-fix-status.md).

Do not rerun this verification as routine setup. Reopen only if a later change causes a regression or new evidence identifies a specific defect.

## Major incomplete product areas

Game-start approvals and wallet capture; bot offers/funding/cancellation; number calling and marking; automatic play; administrator rotation and pause/recovery; claims and validation; category closure, payouts and settlement; secure session lifecycle; chat/presence and progression; durable repair processing; broader integration/security/concurrency/load coverage.

## Important architecture constraints

- Big Object writes are non-transactional; the journal protocol provides fail-closed visibility, not native rollback or multi-record atomicity.
- Account keys currently act as bearer secrets. Do not expose them or enable broad public account-specific access without proper session controls.
- Do not describe the product as end-to-end playable or process production points until the required game lifecycle, settlement and security controls are implemented.

## Navigation

- `.project/MILESTONES.md` — next deliverables, order and acceptance criteria.
- `.project/README.md` — session continuity and working rules.
- `docs/BUILD_STATUS.md` — detailed implementation/release status.
- `docs/SPEC.md`, `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md` — product and technical contracts.
