# Build status and release gate

This project is delivered in reviewable vertical slices. The ticket-purchase transaction-order defect and related lock-order corrections are complete in [PR #24](https://github.com/housieadmin/HousieSalesforce/pull/24); its description links the accepted validation, targeted-deployment and public Experience Cloud regression evidence. The ordered next work and acceptance criteria live only in [the delivery milestones](../.project/MILESTONES.md). Recovery states, scheduling and operator diagnostics are documented in [the recovery runbook](RECOVERY.md). This file is the implementation inventory and verification snapshot—not a second roadmap.

## Implemented source slices

- Salesforce DX project layout, package manifests, deploy/bootstrap scripts and Apex test runner.
- `Housie_Account__c`, the singleton infrastructure lock, the 15 logical Big Objects and the technical operation journal.
- Big Object persistence through `Database.insertImmediate()` with PENDING/COMMITTED journal visibility. The writer does **not** take the standard-object infrastructure lock and does not provide generic cross-request serialization.
- Milestone 1 branch adds a time-bucketed Big Object recovery index/cursor. Incomplete PENDING journals are discovered in bounded batches and changed to QUARANTINED; the original Big Object rows remain physically present but invisible. The original write payload is not persisted, so generic partial operations are not auto-replayed.
- Milestone 1 branch adds bounded PREPARED ticket-command recovery: separate Big-Object-only retry and DML-only finalization Queueables, three bounded Big Object retry attempts plus three bounded DML finalization attempts, persisted recovery diagnostics, and a QUARANTINED per-game gate when ownership/state is inconsistent. The scheduler now dispatches this work instead of logging a heartbeat. These changes are on the unmerged feature branch. PR metadata dry-run and org-resident RunLocalTests passed, but the feature branch is not deployed and its branch-only tests/runtime behavior are not yet validated.
- Selected DML-only preparation/finalization paths use the infrastructure lock. Ticket purchase/withdrawal additionally use a durable per-game command gate and a prepared-command outbox.
- Account creation through flat Apex parameters, pending-setup state, four immutable signup grant ledger records written in a separate Apex request, and DML-only activation.
- Route-context lookup by opaque account key.
- Board lifecycle: create a board with a game configuration snapshot and initial WAITING game; create the owner's BOARD_ADMIN membership; list active memberships; join private boards using the board ID invitation token; list/search public boards and join them; leave only when active human participation and funded bot-contribution checks permit it.
- Human ticket purchase in a WAITING game: server-generated 90-ball layouts, duplicate-layout prevention within a game, one/two-ticket account limit from the game snapshot, manual/automatic mode selection, fee reservation, immutable account resource transactions, and automatic-token consumption only for a committed automatic-mode purchase.
- Human-ticket purchase retries use stable request-derived IDs and a durable command record so the same request does not reserve the fee twice.
- Human ticket withdrawal while the game is WAITING: void active human tickets through append-only events, release their wallet holds with immutable ledger transactions, return reserved points only after the Big Object release is committed, record the withdrawn participant state, and permit board leave after withdrawal completes.
- Board Hub UI for board management, ticket purchase, ticket preview, pending-command retry and pre-start human withdrawal. Purchase-stage diagnostics identify prepare, commit or complete failures.

These are implementation observations. They do not establish that every path is runtime-verified or that the full game is playable.

## Not implemented

- **Pre-start reliability:** Milestone 1 recovery implementation is in progress on the feature branch; failure-injection/concurrency tests, runtime verification, and operator repair tooling remain incomplete.
- **Bot lifecycle:** bot offer creation, contribution funding/holds, equal-share revisions and acceptance, cancellation when any contributor withdraws, and release of all contributors' holds.
- **Ticket pre-start actions:** flip/regenerate a ticket before start and consume/audit the account flip resource.
- **Game start:** minimum-participation enforcement, eligible-admin checks, START approval requests/responses, expiry/stale-request handling, freezing participation/tickets/offers, and capture of human and bot holds into the Game Wallet with immutable ledger evidence.
- **Game runtime:** ordered number calling, manual marking, automatic marking and automatic claims, fixes, admin rotation, pause/resume approvals, missed-call detection and recovery.
- **Claims and settlement:** manual claims, authoritative validation, category closure, disqualification/disputes, cancellation voting/settlement, prize payouts, refunds, completion rewards and automatic creation of the next WAITING game.
- **Security:** authenticated scoped sessions, expiry/revocation/replay protection and rate limiting. The account key is currently a bearer secret; do not expose it or grant broad guest access.
- **Complete Experience Cloud setup:** site/page routing, guest profile, sharing and org-specific activation/configuration.
- Paging beyond the current 200-board directory/membership query limits.
- Full integration, failure-injection, concurrency, load and security coverage in the target Developer Org.

Do not describe the product as end-to-end playable or process production points until the required game lifecycle, financial recovery, settlement and security controls are implemented and verified.

## Validation status

- PR #24 validation run [#41770869570](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770869570) succeeded: metadata dry-run validation and the workflow's `RunLocalTests` step both completed successfully. Important limitation: `RunLocalTests` executes tests already deployed in the Developer Edition; this workflow does not execute Apex test classes that exist only in the PR branch.
- Targeted deployment run [#41760108157](https://github.com/housieadmin/HousieSalesforce/actions/runs/41760108157) successfully validated and deployed the four selected transaction-boundary Apex classes, then completed its selected Apex test step.
- Public Experience Cloud purchase regression runs [#41770200570](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770200570) and [#41770555276](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770555276) succeeded on the dedicated `test-user-3` fixture. The scenario created two distinct active tickets; Aura actions returned SUCCESS and no pending-uncommitted-work error was observed.
- Cleanup run [#41770878933](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770878933) succeeded and removed a duplicate scenario-owned board.
- These checks close the agreed ticket-purchase transaction-boundary defect. They do not verify bot funding, game start, gameplay, claims, settlement, generic journal repair, concurrency or security.

No routine rerun of the completed ticket-purchase evidence is required. Reopen that fix only for a concrete regression or a specific new evidence gap. Future milestones must run the tests and runtime checks in their own acceptance criteria.

## Consistency note

Big Object writes are non-transactional. The operation journal's COMMITTED marker controls application visibility but cannot undo physical rows from a partial `insertImmediate()` operation. The writer does not hold the standard-object infrastructure lock. Cross-request ordering must be implemented by the relevant caller using a durable coordination mechanism; the existing per-game command gate covers the ticket purchase/withdrawal command flow only.
