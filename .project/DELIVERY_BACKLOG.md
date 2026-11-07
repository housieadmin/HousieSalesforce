# Delivery backlog — first complete human-playable game

This backlog contains only the cohesive implementation packages required to deliver one complete human-playable Housie game. Product rules remain in `docs/SPEC.md`; this file defines implementation order and package boundaries, not duplicate business rules.

## Current closeout — WAITING-game paid-ticket setup

- [PR #42](https://github.com/housieadmin/HousieSalesforce/pull/42): board-leave guard and invitation-context handling, with remaining deployment/runtime acceptance gates.
- [PR #43](https://github.com/housieadmin/HousieSalesforce/pull/43): focused two-human acceptance-harness adjustment; based on #42.
- Close these based on their actual scope and evidence. Do not rewrite them or hold later service design hostage to a browser check isolated to deployed invitation-context verification.

## Package 1 — Start a funded human game

**Deliverable:** one cohesive Apex service boundary (orchestrator plus necessary collaborators) that takes an eligible WAITING game through authorized start and funding into RUNNING, with safe, idempotent transaction semantics.

Include the complete path defined by SPEC §§3.3, 3.5, 4.1, 5.1–5.4, 6.4 and 8.2–8.4:
- Eligibility and distinct-human minimums; eligible game-admin checks.
- Start request, approvals, expiry/rejection and super-admin path.
- Stale-state and duplicate/concurrent request protection.
- Freeze participation and ticket state.
- Capture every eligible human ticket hold into the Game Wallet exactly once.
- Append immutable account/game ledger evidence and reconcile balances.
- Transition to RUNNING only after required operations commit; handle partial failure safely and idempotently.

**Acceptance:** focused Apex tests for eligibility, role/approval combinations, expiry/staleness, duplicate/concurrent starts and financial reconciliation. One org/browser scenario verifies a real two-human start after implementation. Do not split service implementation into session-sized fragments.

## Package 2 — Authoritative number-calling runtime and game administration

**Deliverable:** a cohesive runtime service that owns ordered number calls and game-admin availability, pause/resume and missed-call behaviour.

Include SPEC §§3.5, 5.1, 5.3, 5.5–5.7 and 15.1:
- Server-authoritative unique ordered calls from the game configuration snapshot.
- Runtime progression independent of a participant's browser.
- Eligible admin succession and offline grace.
- Pause when no eligible admin exists; resume only under specified eligibility/approval rules.
- Missed-call handling and recovery without duplicate or skipped sequence positions.
- Completion transition when authoritative game rules say the runtime is complete.

**Acceptance:** focused tests for call ordering/uniqueness, scheduler idempotency, admin succession, pause/resume and missed-call boundaries. One org/browser scenario verifies a real started game advances and pauses/resumes correctly.

## Package 3 — Human ticket marking

**Deliverable:** one cohesive ticket-marking service and minimum UI integration for manual and automatic human tickets.

Include SPEC §§6.1–6.3, 10.3 and 15.2:
- Owner-only manual marking against officially called numbers.
- Reject invalid, duplicate or not-yet-called numbers.
- Automatic marking derived only from authoritative call history.
- Read-only owner experience for automatic tickets.
- Persisted marking state that survives reconnect/reload and cannot alter official calls.

**Acceptance:** focused tests for authorization, invalid marks, called-number validation, automatic marking and replay/reconnect behaviour. One browser scenario proves manual and automatic human tickets update correctly during a running game.

## Package 4 — Claims, winner validation and settlement

**Deliverable:** one cohesive claim/settlement service that validates winners and closes a human-only game with reconciled funds.

Include SPEC §§5.7, 8.3–8.5, 10.1–10.5, 15.3 and 17:
- Manual and automatic claim intake.
- Authoritative claim validation, ordering, category closure and disqualification.
- Prize allocation and payout from the Game Wallet.
- Refund/unawarded allocation handling where required.
- Immutable game/account ledger evidence and exactly-once settlement.
- Completed game state and next WAITING game creation only after settlement commits.

**Acceptance:** focused tests for valid/invalid claims, claim timing/order, category closure, payout arithmetic, duplicate settlement and balance reconciliation. One end-to-end org/browser run proves a human-only game reaches COMPLETED with correct winner and wallet/account ledgers.

## Outside this first playable-game backlog

Bots, flips/fixes, cancellation voting, chat/presence, progression/leaderboards, general recovery infrastructure, broad test-coverage uplift, historical cleanup and public/real-value launch hardening are not prerequisites. Track them separately only when prioritized.
