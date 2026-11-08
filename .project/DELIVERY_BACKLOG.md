# Delivery backlog — first complete human-playable game

This backlog contains only the cohesive implementation packages required to deliver one complete human-playable Housie game. Product rules remain in `docs/SPEC.md`; this file defines implementation order and package boundaries, not duplicate business rules.

## Pre-start setup baseline

- [PR #42](https://github.com/housieadmin/HousieSalesforce/pull/42) is merged. It contains the board-leave safeguard, invitation-context handling and revised two-human ticket acceptance scenario.
- PR #43 was closed without merge because its only useful scenario change was incorporated into #42. Its session-only tracker changes were discarded.
- Source for the newer history-state invitation reload handling is on `main`, but that LWC change has not been deployed or verified after reload. The revised two-human combined browser lifecycle has also not passed yet. These are recorded accurately in PR #42 and do not block implementation of the independent start service.
- Do not claim the entire WAITING-game browser lifecycle is accepted. Keep the remaining browser/deployment verification as a follow-up, without reopening a session-only PR.

## Package 1 — Start and fund a human-only game

**Status: READY TO BEGIN**

**Deliverable:** one cohesive start-service capability, including the Apex service boundary, the minimum Board Hub integration and focused tests. It must take a valid WAITING game through request/approval, ticket freeze and human-hold capture into RUNNING exactly once.

### Required behaviour

Implement the complete ordinary and super-admin start paths in SPEC §§3.3–3.5, 4.1, 5.1–5.4, 6.4 and 8.2–8.4:

- A start may be requested by an authorized game participant or board administrator. Enforce the platform role and board/game membership rules server-side.
- Validate that the game is WAITING, the minimum number of distinct human accounts each own at least one committed active paid human ticket, and an eligible game admin is available. Multiple tickets from one account count once.
- Establish the initial game admin according to SPEC: the first eligible human ticket owner by participant join order. The current ticket-purchase path writes participant rows but does not populate `Game__b.Current_Admin_Account_Id__c`; do not assume this field is already correct.
- Define the start-time availability check explicitly. There is no persisted presence/heartbeat field in the current Game or Board Member model. For ordinary start, an eligible admin's valid approval is the positive availability signal; a platform super-admin may act using inherited administrative authority. Do not build ongoing online/offline tracking or admin succession here—that belongs in Package 2.
- Ordinary start requires two distinct role approvals: one eligible admin (current game admin or participating board admin) and one different non-admin human participant. A requester may count for their own role category, but one account cannot satisfy both.
- A participating board admin may provide the admin approval. A non-participating board admin may initiate but cannot count as a participating approver.
- A platform super-admin may execute start immediately without joining or ordinary approvals. Record actor, action, game, timestamp and reason in the required audit record.
- Persist open requests and actual responses; do not pre-create response rows. Record rejection without prematurely vetoing a request while the required approval threshold remains achievable.
- Enforce the configured request expiry (default 60 seconds), and revalidate expected game state and reviewer eligibility at execution time. Expired or stale requests must never start a game.
- On approval, freeze active human participation, ticket layouts and ticket modes. For this first human-only slice, do not fund bot tickets or contributions; reject or safely prevent start if unsupported active bot commitments are present rather than silently ignoring them.
- Capture every eligible active human ticket hold exactly once. Update account balance and reserved balance, append immutable account resource transactions and Game Ledger capture entries, and reconcile Game Wallet totals/obligations.
- Transition the game to RUNNING only after all required captures and ledger writes are committed. Append the authoritative game events and make post-start ticket withdrawal impossible.
- Expose the minimum Board Hub experience to request start, review/approve/reject an open request, and see the resulting game state. Do not build unrelated game-admin runtime or notification infrastructure here.

### Design and implementation constraints

Before coding, inspect the current source and metadata and settle the service contract and transaction protocol in the PR:

- Prefer a dedicated `HousieGameStartService` boundary (request, response and execution/query operations) over expanding the current `HousieGameService.submitCommand()`, which only appends `COMMAND_RECEIVED`.
- Preserve the existing Big Object `PENDING/COMMITTED` journal semantics. `HousieOperationService.executeOperation()` journals a Big Object batch but does not provide cross-request serialization or business idempotency.
- Big Object `insertImmediate()` writes are not atomic with standard-object DML. Do not claim a native cross-store transaction. Define a durable per-game command/coordinator protocol with deterministic idempotency keys, explicit prepared/committed/finalized states, safe retry behaviour and a clear response to partial failure.
- Do not reuse the ticket-specific `Housie_Ticket_Command__c` outbox for start commands without proving its schema and lifecycle safely support them. Reuse or extend the per-game lock only if its semantics are appropriate; otherwise add the narrowest required coordinator metadata.
- Protect concurrent starts and ticket purchases/withdrawals with a consistent per-game serialization rule. Lock account projections in a deterministic order when multiple accounts are captured.
- Handle record-count/batch limits without exposing a partially RUNNING game. Replays must not double-capture a hold, double-write a financial transaction or duplicate the start event.
- Keep financial source-of-truth in immutable holds/transactions/ledger records; cached account and Game Wallet fields are projections that must reconcile.
- Do not introduce a general recovery scheduler or broad recovery framework as part of this package.

### Acceptance and stop condition

- Focused Apex tests cover distinct-human minimum boundaries, duplicate tickets from one account, requester/approver role combinations, board-admin edge cases, super-admin bypass/audit, expiry, stale state, duplicate/concurrent requests, partial failures/retries and exact wallet/account ledger reconciliation.
- The implementation is complete when the service and minimum UI flow are present, focused tests pass, and no invalid path can transition the game to RUNNING or duplicate a capture.
- Run one org/browser acceptance after implementation to prove two humans can approve a real start and the persisted game, holds, account balances and Game Ledger reconcile. This verification can be a follow-up execution against the completed service; do not split the service implementation across sessions.
- Stop this package after implementation and focused validation. Do not start number calling in the same PR/session.

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
