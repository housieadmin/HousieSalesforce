# Build status and release gate

This file is the implementation inventory and verification snapshot. The ordered delivery plan is in [the reset milestones](../.project/MILESTONES.md); product behaviour remains defined by [the SPEC](SPEC.md) and [logical data model](DATA_MODEL.md).

## Current product position

**The product is not yet end-to-end playable.** The current verified vertical slice ends at account/board/ticket setup. There is no implemented start-and-play engine or winner settlement path on `main`.

The current priority is to prove a two-human WAITING game setup, then implement start, runtime, claims and settlement in that order. General recovery infrastructure is deferred until the positive business path is established.

## Implemented source

- Salesforce DX project layout, package manifests, deploy/bootstrap scripts and Apex test runner.
- `Housie_Account__c`, the singleton DML infrastructure lock, the 15 logical Big Objects and technical `Operation_Journal__b`.
- Big Object persistence through `Database.insertImmediate()` with PENDING/COMMITTED journal visibility. The writer does not acquire the standard-object infrastructure lock and does not provide generic cross-request serialization.
- Selected DML-only preparation/finalization paths use `Housie_Operation_Lock__c`. Ticket purchase/withdrawal additionally use `Housie_Game_Command_Lock__c` and the `Housie_Ticket_Command__c` outbox.
- Account creation APIs: create a PENDING_SETUP account, write four immutable signup grants in a separate Big Object transaction, then activate only after all grants are committed.
- `HousieAccountAdmin` LWC exposes account creation for Lightning App Pages and Record Pages. **No FlexiPage definition is tracked in the repository**, so the actual org-side page placement and access still need verification.
- Route-context lookup through an opaque account key. This is currently a bearer-key model, not a complete authenticated session.
- Board creation with a game configuration snapshot and initial WAITING game; owner BOARD_ADMIN membership; active membership listing; private invitation join; public board search/join; and leave checks.
- Human ticket purchase in a WAITING game: server-generated 90-ball layouts, duplicate-layout prevention, configured per-account ticket limit, manual/automatic mode selection, point reservation, immutable account resource transactions and automatic-token consumption for committed automatic purchases.
- Human-ticket withdrawal while WAITING: append-only ticket void events, wallet-hold release, immutable ledger transactions, point release after the Big Object operation commits, withdrawn participation state and board-leave eligibility after withdrawal.
- `HousieBoardHub` UI for board creation/join/search, ticket purchase/preview, pending purchase actions and pre-start withdrawal.
- `HousieApp` is exposed for Experience Cloud and embeds the Board Hub for a resolved account context. The ExperienceBundle/Network configuration is org-specific and is not currently represented by a checked-in ExperienceBundle.

These are source capabilities. Except where explicit runtime evidence is listed below, they are not proof that every path works in the target org.

## Not implemented on main

- **Game start:** minimum-human enforcement, eligible-admin checks, START approvals/responses/expiry, freezing participants and tickets, and capturing human holds into the Game Wallet.
- **Game runtime:** number calling, manual/automatic marking, automatic claims, fixes, game-admin rotation, pause/resume and missed-call handling.
- **Claims and settlement:** authoritative claim validation, category closure, disqualification, payouts, refunds, completion rewards, cancellation voting/settlement and automatic creation of the next WAITING game.
- **Bot lifecycle:** bot offers, contribution funding/holds, share revision/re-acceptance, cancellation and bot winnings.
- **Pre-start ticket flips.**
- **General recovery:** `HousieScheduler` on main currently logs a heartbeat only. It does not dispatch recovery work.
- **Security:** authenticated scoped sessions, expiry/revocation/replay protection and rate limiting. Do not treat possession of an account key as sufficient authentication for public launch.
- Complete org-side Experience Cloud site/page routing, guest profile, sharing and activation verification.
- Full integration, failure-injection, concurrency, load and security coverage.

Important implementation boundary: `HousieGameService.submitCommand()` currently records a `COMMAND_RECEIVED` event. It is not an action processor. `HousieSimulationController` writes developer simulation audit records; accepted scenario names do not mean those product actions are implemented.

## Data model and infrastructure

- `docs/DATA_MODEL.md` defines 16 logical Housie entities.
- Existing infrastructure objects are `Housie_Ticket_Command__c`, `Housie_Game_Command_Lock__c`, `Housie_Operation_Lock__c` and `Operation_Journal__b`. They are not additional business entities.
- The two Big Objects proposed by draft PR #31 (`Operation_Recovery__b` and `Operation_Recovery_Cursor__b`) are not in the main branch's logical data model and are not deployed as part of the main baseline. They are deferred with the recovery milestone; no acceptance of those new objects is implied.

## Runtime and validation evidence

- [PR #24](https://github.com/housieadmin/HousieSalesforce/pull/24) completed the ticket-purchase transaction-order correction.
- [PR validation #41770869570](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770869570) passed metadata dry-run and its org-resident `RunLocalTests` step.
- [Targeted deployment #41760108157](https://github.com/housieadmin/HousieSalesforce/actions/runs/41760108157) deployed the four selected transaction-boundary Apex classes and completed its selected Apex test step.
- Public Experience Cloud ticket-purchase browser runs [#41770200570](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770200570) and [#41770555276](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770555276) succeeded against the dedicated `test-user-3` fixture. They created two distinct active tickets and observed no pending-uncommitted-work error. Cleanup run [#41770878933](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770878933) succeeded.
- The main branch contains only one Apex test class, `HousieDomainRulesTest`, covering domain helpers and ticket-layout structure. The PR workflow's `RunLocalTests` executes tests already deployed in the Developer Org; it does not execute test classes that exist only on a feature branch.
- A read-only Lightning record inspection attempt [#41936400195](https://github.com/housieadmin/HousieSalesforce/actions/runs/41936400195) failed at Salesforce Lightning navigation with `net::ERR_ABORTED`. Its page snapshot showed the Lightning shell, so it is inconclusive about the record page or component placement. A follow-up org-entrypoint inspection is running from `project/rebaseline`.

The browser framework is already present under `browser-agent/`: Playwright, Chromium, JWT authentication, scenario diagnostics, screenshots, traces and artifacts. Main currently has two scenarios (record inspection and ticket-purchase regression); the rebaseline branch adds an org-entrypoint inspection. Reusable account/board/ticket setup journeys still need to be authored and run.

## Release gate

Do not describe Housie as end-to-end playable or enable public/real-value operation until the human game path, financial reconciliation, security and operational controls pass their milestone acceptance criteria.

Do not merge or deploy draft [PR #31](https://github.com/housieadmin/HousieSalesforce/pull/31) as part of the positive-path work. It is deferred for a later recovery design review.
