# Build status and release gate

This file is the implementation inventory and verification snapshot. The ordered delivery plan is in [the reset milestones](../.project/MILESTONES.md); product behaviour remains defined by [the SPEC](SPEC.md) and [logical data model](DATA_MODEL.md).

## Current product position

**The product is not yet end-to-end playable.** The current positive-path evidence ends at ticket purchase. There is no implemented start-and-play engine or winner-settlement path on `main`.

The current priority is to reconcile the actual org schema into GitHub and prove the two-human WAITING-game setup. Then implement start, runtime, claims and settlement in that order. General recovery infrastructure is deferred until the positive business path is established.

## Implemented source

- Salesforce DX project layout, package manifests, deploy/bootstrap scripts and Apex test runner.
- 20 custom-object definitions (16 logical Housie entities plus four existing infrastructure objects).
- Big Object persistence through `Database.insertImmediate()` with PENDING/COMMITTED journal visibility. Readers reject records whose operation journal is not COMMITTED.
- Selected DML-only preparation/finalization paths use `Housie_Operation_Lock__c`. Ticket purchase/withdrawal additionally use `Housie_Game_Command_Lock__c` and the `Housie_Ticket_Command__c` outbox.
- Account creation APIs: create a PENDING_SETUP account, write four immutable signup grants in a separate Big Object transaction, then activate only after all grants are committed.
- `HousieAccountAdmin` LWC exposes account creation for Lightning App Pages and Record Pages.
- Route-context lookup through an opaque account key. This is currently a bearer-key model, not a complete authenticated session.
- Board creation with a game configuration snapshot and initial WAITING game; owner BOARD_ADMIN membership; active membership listing; private invitation join; public board search/join; and leave checks.
- Human ticket purchase in a WAITING game: server-generated 90-ball layouts, duplicate-layout prevention, configured per-account ticket limit, manual/automatic mode selection, point reservation, immutable account resource transactions and automatic-token consumption for committed automatic purchases.
- Human-ticket withdrawal while WAITING: append-only ticket void events, wallet-hold release, immutable ledger transactions, point release after the Big Object operation commits, withdrawn participation state and board-leave eligibility after withdrawal.
- `HousieBoardHub` UI for board creation/join/search, ticket purchase/preview, pending purchase actions and pre-start withdrawal.

These are source capabilities. Except where explicit runtime evidence is listed below, they are not proof that every path works in the target org.

## Not implemented on main

- **Game start:** minimum-human enforcement, eligible-admin checks, START approvals/responses/expiry, freezing participants and tickets, and capturing human holds into the Game Wallet.
- **Game runtime:** number calling, manual/automatic marking, automatic claims, fixes, game-admin rotation, pause/resume and missed-call handling.
- **Claims and settlement:** authoritative claim validation, category closure, disqualification, payouts, refunds, completion rewards, cancellation voting/settlement and automatic creation of the next WAITING game.
- **Bot lifecycle:** bot offers, contribution funding/holds, share revision/re-acceptance, cancellation and bot winnings.
- **Pre-start ticket flips.**
- **General recovery:** `HousieScheduler` on main currently logs a heartbeat only. It does not dispatch recovery work.
- **Security:** authenticated scoped sessions, expiry/revocation/replay protection and rate limiting. Do not treat possession of an account key as sufficient authentication for public launch.

Important implementation boundary: `HousieGameService.submitCommand()` currently records a `COMMAND_RECEIVED` event. It is not an action processor. `HousieSimulationController` writes developer simulation audit records; the scenario names in its UI are not implemented product actions.

## Developer Org reconciliation findings

- **Correction to the earlier audit:** main stores object fields and Big Object indexes inline in each `*.object-meta.xml`. Salesforce CLI retrieve emits the same definitions as separate `fields/` and `indexes/` files. The earlier claim that 213 fields and 16 indexes were missing was incorrect.
- Compared all 20 object definitions: embedded field counts and names match the org-retrieved field files for every object. All 16 retrieved Big Object indexes match the repository's ordered index fields. The proposed Salesforce DX split-format branch has been retrieved back from the org and compared byte-for-byte: 249 expected files, 249 retrieved, zero missing, zero unexpected and zero content differences.
- [PR #35](https://github.com/housieadmin/HousieSalesforce/pull/35) is closed as superseded. It added duplicate split-form metadata alongside the existing inline definitions. Do not merge it.
- Draft [PR #38](https://github.com/housieadmin/HousieSalesforce/pull/38) converts all 20 objects to Salesforce DX split source format: 20 object-level files, 213 field files and 16 index files copied from the org retrieve. This is a representation normalization, not a schema addition. Metadata dry-run, all 39 org-resident Apex tests and byte-for-byte org retrieve round-trip passed ([#41944571299](https://github.com/housieadmin/HousieSalesforce/actions/runs/41944571299), [#41944754055](https://github.com/housieadmin/HousieSalesforce/actions/runs/41944754055)). Merge still requires review; no deployment performed.
- The repository has 20 custom objects: the 16 logical model entities (one standard custom object, `Housie_Account__c`, and 15 Big Objects) plus four technical infrastructure objects. No other custom business entities were found outside the agreed model.
- Technical object audit:
  - `Operation_Journal__b`: keep. It provides the PENDING/COMMITTED visibility gate used by Big Object readers; removing it means redesigning all operation writes and reads.
  - `Housie_Ticket_Command__c`: keep. It is the durable outbox for the existing two-request ticket purchase/withdrawal transaction.
  - `Housie_Game_Command_Lock__c`: keep. It is the per-game concurrency gate for ticket commands.
  - `Housie_Operation_Lock__c`: keep provisionally, but mark as a removal candidate. It is a global DML-only lock; account, command and game-specific locks already exist for most operations. Account creation currently uses it to serialize duplicate-email check-and-insert. Remove only after validating a unique-email constraint against current org data and passing concurrency tests with the narrower locks.
- No additional recovery-index or cursor objects are part of the current design. General recovery remains deferred to Milestone 5.
- Broad org retrieve [PR #34](https://github.com/housieadmin/HousieSalesforce/pull/34) was closed as superseded after its object metadata was curated into PR #38 and its ExperienceBundle/Network metadata into PR #37. Salesforce-generated controllers/tests and incidental formatting changes were excluded.
- Combined ExperienceBundle and Network retrieve [PR #37](https://github.com/housieadmin/HousieSalesforce/pull/37) now exists after the user enabled ExperienceBundle Metadata API. It identifies site `Housie`, URL prefix `housie`, status `UnderConstruction`, and a standard starter ExperienceBundle with standard login/register routes. Treat it as review-only; verify route, guest and sender settings before adopting any of it.
- Permissions/tabs retrieve [PR #36](https://github.com/housieadmin/HousieSalesforce/pull/36) includes Housie permissions and tabs plus unrelated Salesforce-managed permission sets. Keep audit-only; curate only Housie-specific metadata after access review.
- ExperienceBundle and Network retrieval succeeded in PR #37. A separate read-only FlexiPage retrieval is still running to identify the internal Account Admin page.
- Lightning App Builder showed two similarly named `House Account Admin` App Pages and a `Housie_Account_Admin` tab. Verify the actual LWC placement and active page from retrieved FlexiPage metadata before creating or deleting any page.
- Housie Experience Cloud root renders the welcome screen; the existing account-specific route renders Board Hub for the `test-user-3` fixture.

## Runtime and validation evidence

- [PR #24](https://github.com/housieadmin/HousieSalesforce/pull/24) completed the ticket-purchase transaction-order correction.
- [PR validation #41770869570](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770869570) passed metadata dry-run and its org-resident `RunLocalTests` step.
- [Targeted deployment #41760108157](https://github.com/housieadmin/HousieSalesforce/actions/runs/41760108157) deployed the four selected transaction-boundary Apex classes and completed its selected Apex test step.
- Public Experience Cloud ticket-purchase browser runs [#41770200570](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770200570) and [#41770555276](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770555276) succeeded against the dedicated `test-user-3` fixture. They created two distinct active tickets and observed no pending-uncommitted-work error. Cleanup run [#41770878933](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770878933) succeeded.
- Current main contains one Housie Apex test class, `HousieDomainRulesTest`. The org-resident RunLocalTests step executed 39 tests in total, including 7 Housie domain-rule tests and Salesforce-generated community tests.
- Read-only browser inspection [#41937082691](https://github.com/housieadmin/HousieSalesforce/actions/runs/41937082691) confirmed Lightning App Builder lists two Housie Account Admin App Pages and the community root renders. It did not yet prove which page has the admin component.
- First isolated board-creation browser attempt [#41937185918](https://github.com/housieadmin/HousieSalesforce/actions/runs/41937185918) did not observe a new board card after clicking Create Board. The screenshot showed the form remained visible with no success/error message. This is an unresolved runtime result, not a pass. A diagnostic retry is being run.
- The browser framework is already present under `browser-agent/`: Playwright, Chromium, JWT authentication, scenario diagnostics, screenshots, traces and artifacts. Existing main scenarios cover record inspection and ticket-purchase regression; the rebaseline branch adds org inspection and board setup. Account creation, join, ticket purchase and withdrawal setup scenarios still need to be made independently repeatable.

## Release gate

Do not describe Housie as end-to-end playable or enable public/real-value operation until the human game path, financial reconciliation, security and operational controls pass their milestone acceptance criteria.

Do not merge or deploy draft [PR #31](https://github.com/housieadmin/HousieSalesforce/pull/31) as part of the positive-path work. It is deferred for a later recovery design review. PR #36 remains an audit-only permissions/tab retrieve; PRs #33, #34 and #35 are closed as superseded.
