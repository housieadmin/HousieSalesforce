# Housie delivery milestones

This is the cross-session roadmap. Work on the first actionable milestone; keep implementation details in its PR and session notes. Update status and evidence when a milestone is completed. Do not rerun completed milestones unless a regression, changed requirement or concrete evidence gap appears.

## Milestone 0 — Ticket-purchase transaction boundaries

<badge>COMPLETE · 2026-11-04</badge>

- [x] Fix pending-uncommitted-work failure in ticket-command completion.
- [x] Correct related Big Object / standard-object lock ordering in account, board and ticket flows.
- [x] Retain purchase-stage diagnostics in Board Hub.
- [x] PR validation, targeted Developer Edition deployment and public Experience Cloud purchase regression passed.
- [x] Browser regression created two distinct tickets; no pending-uncommitted-work error.
- Evidence: [PR #24](https://github.com/housieadmin/HousieSalesforce/pull/24), [session record](sessions/2026-11-04-ticket-purchase-transaction-fix-status.md).

No routine revalidation required. Handle regressions if future work introduces one.

## Milestone 1 — Game start and wallet capture

<badge color="info">NEXT</badge>

**Goal:** Turn a WAITING game with funded human tickets into a correctly started game with captured ticket fees.

Acceptance criteria:
- Start eligibility and minimum participation rules follow `docs/SPEC.md`.
- Required participant/admin approvals are recorded and enforced.
- Start is idempotent; retries cannot capture fees twice.
- Active ticket wallet holds are captured into the Game Wallet exactly once with immutable ledger evidence.
- Invalid, withdrawn or unfunded participants cannot be captured.
- Apex tests cover approval rules, insufficient/changed holds, duplicate requests and interrupted start.
- A focused browser scenario proves the approved start path and resulting game state.

## Milestone 2 — Bot offers and contribution lifecycle

**Goal:** Add funded bot participation without breaking account wallet invariants.

Acceptance criteria:
- Bot offer creation, equal-share revision and acceptance follow the specification.
- Contributions create auditable holds and immutable transactions.
- Participant withdrawal/cancellation releases all affected bot contributions correctly.
- Duplicate/retried actions are idempotent; concurrent contribution attempts cannot overspend.
- Apex tests cover funding, revision, cancellation, withdrawal and retry paths; focused browser flow passes.

## Milestone 3 — Core game runtime

**Goal:** Make a started game progress independently of a player's browser.

Acceptance criteria:
- Number calling persists an ordered, unique call history and respects configured interval.
- Manual marking and automatic marking derive from authoritative call history.
- Automatic mode actually plays; it is not merely a ticket preference/token spend.
- Game admin availability, rotation, pause and resume rules are enforced.
- Recovery after interrupted jobs does not duplicate calls or markings.
- Domain tests cover ordering, idempotency and pause/recovery; browser test covers a short playable round.

## Milestone 4 — Claims, category closure and settlement

**Goal:** Complete the prize lifecycle with auditable, exactly-once payouts.

Acceptance criteria:
- Claims are checked against ticket layouts and official called-number history.
- Category closure and winner limits follow the game configuration snapshot.
- Disqualification and dispute paths are explicit and auditable.
- Payout calculation and wallet credits are idempotent and cannot exceed the Game Wallet.
- Game completion reconciles all holds, prizes and refunds.
- Tests cover invalid/duplicate claims, multiple winners, payout rounding and interrupted settlement.

## Milestone 5 — Security and public-launch readiness

**Goal:** Replace bearer-key-only account context with controlled public sessions.

Acceptance criteria:
- Account-specific actions require authenticated, scoped sessions.
- Session expiry, revocation, replay protection and rate limiting are enforced.
- Experience Cloud guest permissions and record/data access are reviewed and tested.
- Secrets are never exposed in rendered UI, logs or browser diagnostics.
- Security tests cover unauthorized cross-account access and expired/replayed sessions.
- Production points/public access remain disabled until this milestone and settlement are complete.

## Milestone 6 — Operational readiness and product expansion

**Goal:** Support reliable operation and broader player experience.

Acceptance criteria:
- Durable repair/retry processing for pending operation journals and stale command gates.
- Integration, concurrency and load testing for critical game/wallet flows.
- Monitoring and actionable diagnostics for failed game operations.
- Paging beyond current directory/membership limits.
- Chat, presence, progression, achievements and leaderboards delivered against prioritized product requirements.

---

## Session operating rule

At session start: read this tracker, select the first milestone not marked complete, inspect only its relevant specification/source/tests, and state the milestone's acceptance criteria. At session end: update status/evidence and identify the next action. Long debugging is fine; a new session does not restart a completed milestone.

A milestone is complete when its stated acceptance criteria pass and the evidence is recorded. Completion means the agreed scope passed at that point in time—not that the entire application is bug-free. New defects are handled when discovered; do not reopen unrelated completed work.
