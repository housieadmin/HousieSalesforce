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
- Board Hub UI for board setup/join/search, ticket purchase/preview and pre-start withdrawal.
- Pre-start board-leave safeguard and invitation-context source changes from [PR #42](https://github.com/housieadmin/HousieSalesforce/pull/42), now merged.

## Not implemented on main

- Complete authorized start/approval/funding transition to RUNNING.
- Authoritative number-calling runtime, game-admin succession, pause/resume and missed-call handling.
- Manual/automatic ticket marking.
- Claim validation, prize payout, refund and exactly-once settlement.
- Bot lifecycle, optional social/progression features and general recovery dispatch.
- Complete authenticated session security (expiry, revocation, replay protection and rate limiting).

Important boundary: `HousieGameService.submitCommand()` currently appends a `COMMAND_RECEIVED` event; it is not a game-command processor. Simulation audit records are not product gameplay.

## Pre-start verification limitations

- The older fragment-token `housieApp` version was deployed successfully. The newer history-state reload handling merged in PR #42 is source-only; it has not been deployed or verified after reload.
- The revised two-human acceptance scenario separates authenticated purchase/withdrawal assertions from reload transport. Manifest dry-run and 39/39 org-resident Apex tests passed in [run #42057730472](https://github.com/housieadmin/HousieSalesforce/actions/runs/42057730472), but that run did not execute the live browser scenario.
- Earlier live evidence passed two-human board creation, join, distinct MANUAL purchases and 90-ball layouts before failing at reload ([run #42051842060](https://github.com/housieadmin/HousieSalesforce/actions/runs/42051842060)). Fixed-fixture withdrawal/release/repurchase passed separately ([run #42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673)).
- These verification gaps are not evidence that the newer source works, and they do not block implementation of the independent start service. Record any later deployment/runtime validation in its relevant PR.

## Next delivery package

Package 1 in [the delivery backlog](../.project/DELIVERY_BACKLOG.md) is ready: implement the complete human-only start request/approval/funding service and minimum Board Hub flow. Do not begin number calling in that package.

## Architecture constraints

- Big Object writes use `Database.insertImmediate()` and are not transactional with ordinary Salesforce DML. Preserve the operation-journal visibility gate and actual transaction boundaries.
- `HousieOperationService.executeOperation()` journals individual Big Object batches but does not provide cross-request serialization or business idempotency.
- Preserve ticket-command idempotency, wallet hold accounting, append-only events/ledgers, game configuration snapshots, authorization and concurrency controls.
- General recovery infrastructure remains deferred; do not replace existing correctness mechanisms as part of unrelated feature work.
- Experience Cloud remains under construction. No Network/ExperienceBundle deployment or site activation is authorized. The detailed security decision is in [the route/security review](../.project/MILESTONE_1_ROUTE_SECURITY_REVIEW.md).
