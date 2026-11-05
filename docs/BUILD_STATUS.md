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


## Additional reconciliation and storage decisions (2026-11-05)

- Scoped source manifests now separate Housie custom objects, Apex classes, LWC bundles, Experience Cloud/page metadata, and custom permissions/permission sets/tabs (`package-housie-access.xml`). They enumerate Housie-owned members rather than retrieving every org component. This intentionally excludes Salesforce standard/generated classes, LWCs and unrelated metadata.
- A reusable Playwright Salesforce utility now owns authenticated Lightning-tab navigation and immediate account-key redaction. Account creation and admin-tab inspection scenarios consume that module. A focused round-trip scenario now retrieves only the curated Housie Apex and LWC members and compares source files byte-for-byte with the Developer Org; it has been authored but still needs an executed browser-agent run.
- Browser run [#41945104195](https://github.com/housieadmin/HousieSalesforce/actions/runs/41945104195): the Account Admin tab mounted and its form rendered. The create-account UI returned an account key and showed `Status: ACTIVE`; the scenario failed only because it asserted a nonexistent `Created: ...` line. The assertion was corrected to verify the actual ACTIVE lifecycle state. The corrected scenario has not yet been rerun.
- The duplicate `House_Account_Admin` page was deleted by the user. The `Housie_Account_Admin` tab remains the verified admin entry point. Do not recreate the duplicate page. The current broad guest-profile and System Administrator access is temporary test scaffolding, not the intended security design; permission-set hardening remains deferred to Milestone 5.
- PR #38 was merged after its representation-only object metadata conversion passed metadata dry-run, 39 org-resident Apex tests and byte-for-byte object retrieve round-trip. No deployment was performed.

### Developer Edition storage constraints and retention

Salesforce currently documents Developer Edition at **5 MB standard data storage** and **20 MB file storage**, with a separate allocation of **1 million Big Object records per org**. These are different quotas: Big Object records do not consume the ordinary 5 MB data-storage pool. The 16 Big Objects in this model share the org's Big Object record allocation, so adding more Big Objects does not create more capacity. See [Salesforce Data and File Storage Allocations](https://help.salesforce.com/s/articleView?id=limits.htm&language=en_US&type=5) and [Developer Edition Allocations](https://help.salesforce.com/s/articleView?id=xcloud.overview_limits_developer.htm&language=en_US&type=5).

- Reducing the count of custom object definitions does not by itself reduce record storage. Moving records to a standard object would still consume standard data storage and would weaken the domain model; it is not a storage fix.
- Keep high-volume append-only ledgers/history in Big Objects where their indexed access pattern fits. Their separate 1-million-record allocation is the scarce resource to manage.
- Big Object retention is technically possible with `Database.deleteImmediate()`, but deletion requires the complete index key and is limited to 50,000 records per batch. Retention must therefore be designed around each object's index and tested before any purge job is enabled. See [Delete Data in a Custom Big Object](https://developer.salesforce.com/docs/platform/big-object-impl-guide/guide/big-object-delete.html).
- Do not add technical Big Objects or duplicate audit streams without a record-volume/retention estimate. Keep the four existing technical objects provisionally; evaluate whether the two lock objects can be consolidated into one keyed lock table only after concurrency tests. The durable ticket-command outbox and operation journal currently protect correctness and should not be removed without a replacement.
- Before production-like testing, measure org storage usage and estimate records per game/account for every Big Object. Define retention windows for disposable test data separately from permanent financial/game history. Never purge financial ledgers or audit history merely to reclaim Developer Org capacity.

## Session continuity and browser-agent findings (2026-11-05)

- Session handoff: [`.project/SESSION_2026-11-05.md`](../.project/SESSION_2026-11-05.md). Read this first when resuming work; it records project rules, verified decisions, PR state, browser-agent architecture and next steps.
- Browser-agent workflow runtime/source staging was fixed in [PR #39](https://github.com/housieadmin/HousieSalesforce/pull/39). It now stages only allowlisted regular TypeScript utility modules from the requested source ref and tolerates both array/object Salesforce CLI JSON response shapes. Workflow validation passed in [run #41953738127](https://github.com/housieadmin/HousieSalesforce/actions/runs/41953738127).
- Shared browser diagnostics now include reusable Aura response parsing (`captureAuraErrors`) consumed by the board-create scenario. Board creation failure is now understood from the Playwright trace [run #41937185918](https://github.com/housieadmin/HousieSalesforce/actions/runs/41937185918): public `HousieApp` passes `account-key` to `c-housie-board-hub`, but BoardHub lacked an `@api accountKey` property and relied on `recordId`/record wire. Guest route has no recordId, so Apex receives null and throws `Account context is required.`. Source fix is on `project/rebaseline`; it still needs validation and authorized deployment before the org browser test can pass.
- Latest curated Apex/LWC run [#41953176751](https://github.com/housieadmin/HousieSalesforce/actions/runs/41953176751) did not execute tests because the runtime lacked staged utility imports. This is addressed by PR #39; rerun the same scenarios after the board context fix is ready.


- Detailed storage policy: [`docs/STORAGE_RETENTION.md`](STORAGE_RETENTION.md). It classifies financial/history/audit/idempotency/chat/outbox/lock data, defines safe cleanup gates and explicitly authorizes no purge job.

- Latest PR #32 validation [run #41954479347](https://github.com/housieadmin/HousieSalesforce/actions/runs/41954479347) passed metadata validation without deployment and all 39 org-resident Apex tests (100% pass rate). This validates the current branch metadata, including the Board Hub account-context source change, but does not deploy it.


## Follow-up acceptance evidence (2026-11-05)

- Withdrawal browser run [#41962935952](https://github.com/housieadmin/HousieSalesforce/actions/runs/41962935952) reached the withdrawal path but exposed a real Apex defect. The UI reported: `SObject row was retrieved via SOQL without querying the requested field: Housie_Ticket_Command__c.Mode__c`. The withdrawal command was left PREPARED, the game-command lock remained active, and repurchase was correctly blocked. Root cause: `completeTicketCommand()` passed its queried command row to `commandResult()` without selecting `Mode__c` (and other result fields). The source SOQL now selects `Mode__c`, `Entry_Fee__c` and `Layout__c`. This fix is in PR #32 and its Salesforce validation is running. The org has not been deployed; live withdrawal remains blocked until an authorized targeted deployment.
- Curated source/org parity run [#41963078143](https://github.com/housieadmin/HousieSalesforce/actions/runs/41963078143) executed after regex correction. All curated files were present with no missing/unexpected entries. Remaining source/org differences are substantive: `HousieOperationService.cls`; `housieBoardHub.js` (source has `_accountKey`/public setter, org has legacy `accountKey` field); two custom permission descriptions; and class access differences in all three Housie permission sets. Tab metadata matched. Do not normalize these differences away. Inspect and reconcile them deliberately.
- ExperienceBundle metadata in review-only PR #37 confirms the Housie Account Detail route is a record-detail route for `Housie_Account__c` and mounts `c:housieBoardHub` with `recordId: {!recordId}`. Preserve the record-ID path; the account-key input is a separate HousieApp integration. Do not deploy PR #37 wholesale.
