# Build status

This is a concise snapshot of implementation, not a roadmap or activity log. Detailed changes and verification evidence belong in the relevant GitHub PR.

## Product state

**Housie is not yet end-to-end playable.** Main contains account/signup provisioning, board creation/joining, WAITING-game creation, human ticket purchase/withdrawal flows and Board Hub UI. It does not contain the complete game-start, runtime, marking, claims or settlement engine.

## Implemented on main

- Salesforce DX project and curated Housie metadata.
- Account creation/activation with signup grants and immutable resource transactions.
- Opaque account-key route context (bearer-key model; not a complete authenticated session).
- Board creation, invitation join, membership listing and board-leave checks.
- WAITING-game creation with configuration snapshot.
- Human ticket purchase and WAITING withdrawal, including 90-ball layouts, duplicate-layout prevention, point holds and immutable account-resource ledger writes.
- Board Hub UI for board setup, join/search, ticket purchase/preview and pre-start withdrawal.

## Not implemented on main

- Complete authorized start/approval/funding transition to RUNNING.
- Authoritative number-calling runtime, game-admin succession, pause/resume and missed-call handling.
- Manual/automatic ticket marking.
- Claim validation, prize payout, refund and exactly-once settlement.
- Bot lifecycle, optional social/progression features and general recovery dispatch.
- Complete authenticated session security (expiry, revocation, replay protection and rate limiting).

Important boundary: `HousieGameService.submitCommand()` currently appends a `COMMAND_RECEIVED` event; it is not a game-command processor. Simulation audit records are not product gameplay.

## Active pre-start setup PRs

- [PR #42](https://github.com/housieadmin/HousieSalesforce/pull/42) contains the board-leave safeguard and invitation-context changes. It remains open; the updated history-state LWC is not yet deployed or runtime-verified.
- [PR #43](https://github.com/housieadmin/HousieSalesforce/pull/43) contains an acceptance-harness adjustment and is stacked on #42. It adds no production Apex/LWC behaviour.

Do not infer org deployment or runtime acceptance from source presence or passing Apex/manifest validation. See each PR for exact deployment and browser evidence.

## Architecture constraints

- Big Object writes use `Database.insertImmediate()` and are not transactional with ordinary Salesforce DML. Preserve the operation-journal visibility gate and actual transaction boundaries.
- Preserve ticket-command idempotency, wallet hold accounting, append-only events/ledgers, game configuration snapshots, authorization and concurrency controls.
- General recovery infrastructure remains deferred; do not replace existing correctness mechanisms as part of unrelated feature work.
- Experience Cloud remains under construction. No Network/ExperienceBundle deployment or site activation is authorized. The detailed security decision is in [the route/security review](../.project/MILESTONE_1_ROUTE_SECURITY_REVIEW.md).
