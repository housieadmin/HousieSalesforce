# Housie delivery milestones

This is the cross-session delivery roadmap. The order reflects dependencies in `docs/SPEC.md` and the current source—not just a feature wishlist. Work on the first actionable incomplete milestone. Keep implementation details in its PR and session notes; update status and evidence when it is complete.

## Milestone 0 — Ticket-purchase transaction boundaries

**Status: COMPLETE — 2026-11-04**

- [x] Fix the pending-uncommitted-work failure in ticket-command completion.
- [x] Correct related Big Object / standard-object lock ordering in account, board and ticket flows.
- [x] Retain purchase-stage diagnostics in Board Hub.
- [x] PR metadata validation and the configured org-resident Apex test step passed.
- [x] Targeted deployment of the four transaction-boundary Apex classes passed.
- [x] Public Experience Cloud purchase regression created two distinct active tickets without the pending-uncommitted-work error.
- Evidence: [PR #24](https://github.com/housieadmin/HousieSalesforce/pull/24), [validation #41770869570](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770869570), [targeted deploy #41760108157](https://github.com/housieadmin/HousieSalesforce/actions/runs/41760108157), [browser runs #41770200570](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770200570) and [#41770555276](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770555276), [cleanup #41770878933](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770878933), [session record](sessions/2026-11-04-ticket-purchase-transaction-fix-status.md).

This closes the agreed transaction-boundary defect only. The PR workflow's `RunLocalTests` step executes tests already deployed in the org; it does not execute branch-only Apex test classes. No routine revalidation is required. Reopen only for a concrete regression or a specific new evidence gap.

## Milestone 1 — Big Object operation recovery and command repair

**Status: NEXT**

**Why this comes first:** the current writer leaves a PENDING journal when an `insertImmediate` sequence fails, and the scheduler is only a heartbeat. Ticket purchase/withdrawal has a retryable command outbox, but there is no general repair worker. Bot funding and game-start capture add more multi-record financial operations; they should not be built on an undefined recovery contract.

Acceptance criteria:
- Define explicit recovery states and safe actions for PENDING journals, partially written Big Object operations, PREPARED ticket commands and stale per-game command gates.
- Implement a bounded, durable recovery dispatcher; `HousieScheduler` must do real recovery work rather than only log a heartbeat.
- Make retries and repair idempotent. Do not assume Big Object rows can be rolled back; preserve fail-closed visibility and provide a deliberate repair/compensation path for partial operations.
- Define when a command can be retried automatically, when it must be quarantined, and what operator-visible diagnostics are required.
- Preserve the DML-only / Big-Object-only transaction boundaries and avoid standard-object row locks across `insertImmediate`.
- Failure-injection tests cover failure after PENDING journal creation, partial record writes, failure before COMMITTED marker, interruption between ticket command phases, duplicate retry and stale-gate recovery.
- A focused operational test proves recovered commands become visible exactly once or remain safely quarantined without duplicating financial effects.

## Milestone 2 — Complete WAITING-game participation and bot funding

**Goal:** implement all required pre-start participation changes before the start flow freezes them and captures funds.

Acceptance criteria:
- Bot offers enforce per-game limits and eligibility; bot tickets remain distinct from human tickets and do not count toward minimum human participation.
- Contribution holds reserve account points without treating them as Game Wallet funds.
- Initial equal shares, two-decimal rounding and residual allocation follow the SPEC's deterministic acceptance-order rule.
- A proposed share revision is applied only after every affected contributor explicitly re-accepts it; no accepted amount changes silently.
- Any contributor's WAITING-game withdrawal cancels every offer they contributed to and releases every contributor's hold. Remaining contributors are not forced to absorb a larger share.
- Human withdrawal remains WAITING-only, releases human ticket holds and completes before board leave is allowed.
- Ticket flips regenerate a ticket only before start, preserve ticket mode, consume one flip and create immutable ledger evidence.
- Apex tests cover offer limits, funding, insufficient balance, revision/re-acceptance, rounding, duplicate requests, competing contributions, withdrawal/cancellation and all-hold release; focused browser flows prove offer acceptance and withdrawal outcomes.

## Milestone 3 — Game start approvals and wallet capture

**Goal:** transition a fully funded WAITING game into RUNNING exactly once.

Acceptance criteria:
- Start requires the configured minimum number of distinct human accounts with paid active tickets; multiple tickets from one account count once, and bot-only contributors/bot tickets do not count.
- An eligible game admin is available at start.
- Ordinary start requires the two distinct approval roles in SPEC §5.4: an eligible admin and a different non-admin human participant. Requester self-approval counts only for the requester's own role category; one account cannot satisfy both roles.
- A participating board admin can satisfy the admin role; a non-participating board admin may initiate but cannot act as a participating approver. A platform super-admin can execute immediately.
- Responses, rejection semantics, open-request visibility and the 60-second expiry follow SPEC §5.4. Expired or stale requests never execute.
- The game becomes RUNNING only after the journaled start operation has frozen active participants, human ticket layouts/modes and accepted bot offers, and captured every valid human ticket and bot contribution hold into the Game Wallet exactly once. The operation must be recoverable and idempotent; do not imply native Big Object atomicity.
- Capture writes immutable account-resource and Game-Ledger evidence; invalid, withdrawn, missing or already released holds cannot be captured. Account balances, Game Wallet totals and obligations reconcile.
- Duplicate requests, retries, concurrent approvals and interrupted capture cannot duplicate captures or leave a game RUNNING with unreconciled funds.
- Apex tests cover eligibility, each approval role combination, timeout/rejection/stale requests, minimum-participant boundaries, duplicate/concurrent start and interrupted capture. A browser scenario proves a full approved start and verifies the frozen state and wallet ledger.

## Milestone 4 — Authoritative game runtime

**Goal:** run a started game independently of any player's browser.

Acceptance criteria:
- Number calling persists a unique, ordered 1–90 history and uses the game configuration snapshot and configured interval.
- Manual marking is accepted only for the ticket owner and valid called numbers; it cannot alter official call history.
- Automatic human tickets are read-only to owners, mark from official call history and submit qualifying claims automatically. Bot tickets use automated play but retain separate ownership/economic treatment.
- Fixes synchronize a selected ticket with official call history, consume the account resource once and do not change the layout or call history.
- Game-admin rotation follows participant join order and the 90-second default/configured offline grace. If no eligible admin is available, the game pauses.
- Pause/resume requires the SPEC's approval roles and state checks. Pause stops game-changing work; resume continues from persisted state and resets the next call interval.
- Missed-call recovery applies the configured delay grace (300 seconds by default), never bursts missed calls, and requires authorized resume.
- Tests cover unique ordering, idempotent scheduled execution, ownership, automatic/manual behavior, admin rotation, pause/resume and missed-call recovery. Browser coverage proves a short playable round.

## Milestone 5 — Claims, cancellation and complete settlement

**Goal:** resolve every prize category and financial obligation with authoritative, exactly-once accounting.

Acceptance criteria:
- Manual and automatic claims are validated against official ticket layouts and called-number history, not client markings.
- Claim ordering, timing, category closure, winner limits and disqualification follow the game configuration snapshot and SPEC.
- Cancellation eligibility and the frozen-electorate 50% approval rule follow SPEC §11; platform super-admin override is audited.
- Cancellation settlement preserves finalized awards, distributes remaining unawarded value per paid ticket, handles bot allocations and refunds overpayments as specified.
- Completed-game settlement handles category awards, remaining pool allocations, bot contributor shares, refunds, consumable rewards and account completion rewards.
- All payouts/refunds/adjustments are idempotent, recorded in immutable ledgers, and cannot exceed Game Wallet funds or erase outstanding obligations.
- Completion/cancellation retains permanent history and creates the next WAITING game using then-current board settings.
- Tests cover invalid/duplicate claims, simultaneous claims, category closure, disqualification, cancellation votes, bot payout allocation, rounding, refunds, interrupted settlement and duplicate retries. Browser coverage proves a complete game and a cancellation path.

## Milestone 6 — Security and controlled public-launch readiness

**Goal:** remove the current bearer-key-only account context and prove the complete product is safe to expose.

Acceptance criteria:
- Account-specific actions require authenticated, scoped sessions rather than possession of a URL/account key alone.
- Session expiry, revocation, replay protection and rate limiting are enforced.
- Experience Cloud guest permissions, sharing, Apex access and cross-account data isolation are reviewed and tested.
- Secrets and account keys are never exposed in rendered UI, logs or browser diagnostics.
- Integration, failure-injection, concurrency and load tests cover purchase, withdrawal, bot funding, start/capture, gameplay and settlement.
- Monitoring, actionable alerts and operator repair procedures cover failed operations, stuck journals and stale command gates.
- Production points and broad public access remain disabled until all preceding milestones and this security gate pass.

## Milestone 7 — Product expansion

**Goal:** deliver non-core social and progression capabilities after the authoritative game and money lifecycle is complete.

Acceptance criteria:
- Board/game chat, quick messages and configurable retention follow SPEC.
- Presence reflects connection state only and does not change participation or prize entitlement.
- Potential-winner visibility exposes permitted progress without leaking other players' missing numbers.
- Streaks, achievements, leaderboards and rewards follow the confirmed eligibility rules.
- Directory and membership paging replace current fixed query limits.
- Each capability has prioritized product acceptance criteria, access controls and focused tests.

---

## Session operating rule

At session start: read this tracker, select the first incomplete milestone, inspect its relevant SPEC/DATA_MODEL sections and actual source/tests, and state its acceptance criteria. At session end: update status/evidence and identify the next action. Long debugging can remain in one session; a new session does not restart a completed milestone.

A milestone is complete when its stated acceptance criteria pass and the evidence is recorded. Completion means the agreed scope passed at that point in time—not that the entire application is bug-free. New defects are handled when discovered; do not reopen unrelated completed work.
