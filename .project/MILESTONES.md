# Housie delivery milestones

This roadmap is reset around the **positive, human-only game path first**. The product must prove that a real game can be created, started, played, claimed and settled before we invest in a general recovery platform or optional features.

The Product Requirements Specification remains authoritative for behaviour. This roadmap changes implementation order, not product scope. Optional capabilities are deferred, not removed.

## Milestone 0 — Ticket-purchase transaction boundaries

**Status: COMPLETE — 2026-11-04**

- [x] Fix the pending-uncommitted-work failure in ticket-command completion.
- [x] Correct related Big Object / standard-object lock ordering in account, board and ticket flows.
- [x] Retain purchase-stage diagnostics in Board Hub.
- [x] PR validation and org-resident Apex test step passed.
- [x] Targeted deployment of the four transaction-boundary Apex classes passed.
- [x] Public Experience Cloud purchase regression created two distinct active tickets without the pending-uncommitted-work error.
- Evidence: [PR #24](https://github.com/housieadmin/HousieSalesforce/pull/24), [validation #41770869570](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770869570), [targeted deploy #41760108157](https://github.com/housieadmin/HousieSalesforce/actions/runs/41760108157), [browser runs #41770200570](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770200570) and [#41770555276](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770555276), [cleanup #41770878933](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770878933).

This closes the agreed transaction-boundary defect only. It does not mean the full ticket-to-settlement game path is implemented.

## Milestone 1 — Reconcile the org baseline and prove pre-start setup

**Status: IN PROGRESS — schema, LWC/access and signup grants verified; Apex parity, second-human membership and two-human paid-ticket acceptance remain open**

**Goal:** make the GitHub source reproducible against the Developer Org, then prove that two human accounts can prepare a WAITING game with paid tickets.

### 1A. Source and org reconciliation

- [x] Confirm the logical schema representation before comparing retrieve output. Main stores fields and Big Object indexes inline in each `*.object-meta.xml`; Salesforce CLI retrieve emits equivalent definitions as separate field/index files.
- [x] Compare all 20 object definitions: field counts and names match the org retrieve for every object; all 16 retrieved Big Object indexes match the repository's ordered index fields. No schema gap was established.
- [x] Git tree parity against the archived org-retrieve snapshot: all 249 object metadata files (20 object definitions, 213 field definitions, 16 Big Object indexes) have identical Git blob SHAs between main and `automation/org-retrieve-41937124487`.
- [x] Confirm live Developer Org schema parity via Metadata API retrieve/round-trip: [PR #38 run #41944754055](https://github.com/housieadmin/HousieSalesforce/actions/runs/41944754055) retrieved 249 object metadata files from the Developer Org and found 249 expected, zero missing, zero unexpected and zero content differences. This covers 20 objects, 213 fields and 16 Big Object indexes.
- [ ] Complete curated Apex reconciliation. Round-trip #41990232409 confirmed exact parity: LWC 14/14, custom permissions 2/2, permission sets 3/3, tabs 3/3; all file sets match. Apex 30/30 files present with no missing/unexpected paths, but two content differences remain: `HousieGameTicketService.cls` has a functional missing-field query delta; `HousieOperationService.cls` is comment-only transaction-boundary documentation. Do not suppress the functional difference.
- [x] Close [PR #35](https://github.com/housieadmin/HousieSalesforce/pull/35) as superseded. It would add duplicate split-form field/index metadata alongside the existing inline definitions. Do not merge it.
- [x] Adopt Salesforce DX split source format. [PR #38](https://github.com/housieadmin/HousieSalesforce/pull/38) merged after metadata dry-run, 39 org-resident Apex tests and a 249-file byte-for-byte object round-trip passed. No deployment was performed.
- [x] Curate Housie-owned custom permissions, permission sets and tabs from [PR #36](https://github.com/housieadmin/HousieSalesforce/pull/36) into merged PR #32; exclude Salesforce-managed `sfdcInternalInt__*` permission sets. This is source sync only, not permission assignment or deployment.
- [ ] Reconcile Housie Network/ExperienceBundle route and security configuration. [PR #37](https://github.com/housieadmin/HousieSalesforce/pull/37) is closed without merge; its guest-access, sender and site settings remain deferred pending a SPEC-reviewed curated route change.
- [ ] Retrieve the Aura site's ExperienceBundle now that **Enable ExperienceBundle Metadata API** has been enabled. Identify the actual public root and account routes.
- [x] Verify the authoritative Account Admin entry point. The `Housie_Account_Admin` tab mounts the `housieAccountAdmin` LWC. The user deleted the duplicate `House_Account_Admin` page; do not recreate it.
- [x] Keep Salesforce-generated community login/profile controllers and unrelated standard components out of Housie source. Broad retrieve [PR #34](https://github.com/housieadmin/HousieSalesforce/pull/34) was closed; scoped manifests now enumerate Housie-owned components only.

### 1A.1. Object inventory outside the logical model

The agreed logical model remains 16 entities. Main has 20 custom objects: those 16 plus four technical infrastructure objects. These four are not additional Housie business entities.

| Technical object | Current dependency | Milestone 1 decision |
|---|---|---|
| `Operation_Journal__b` | Every Big Object operation's PENDING/COMMITTED visibility gate; readers reject uncommitted operations. | **Keep.** Removing it requires redesigning all Big Object write/read visibility semantics. |
| `Housie_Ticket_Command__c` | Durable DML outbox for the two-request ticket purchase/withdrawal flow; stores payload and idempotency key across Big Object writes. | **Keep.** Ticket purchase is in the first playable setup path. |
| `Housie_Game_Command_Lock__c` | Per-game gate serializes ticket purchase/withdrawal and prevents overlapping commands. | **Keep.** It protects current ticket financial operations against concurrent requests. |
| `Housie_Operation_Lock__c` | Singleton DML lock used by account creation/activation and ticket command preparation/finalization. It does not serialize Big Object writes and is not held across `insertImmediate`. | **Keep provisionally; candidate for removal.** Existing per-account, per-command and per-game row locks cover most call sites, but account creation currently relies on the global lock to serialize its email check-then-insert. `Housie_Account__c.Email__c` is currently `unique=false`; keep the global lock until existing duplicate data is audited, a database uniqueness guarantee is introduced safely, and narrower locking passes concurrency tests. |

Developer Edition currently has 5 MB standard data storage and a separate 1-million-record Big Object allocation per org. All 16 Big Objects share that allocation. See the Salesforce storage documentation in `docs/BUILD_STATUS.md`; define per-object retention and test indexed `deleteImmediate()` purges before enabling cleanup. No extra recovery Big Objects are accepted into this milestone. General recovery remains deferred to Milestone 5. Do not remove the four existing technical objects simply because they are outside the logical business model; first remove their code dependencies safely, if and when a replacement is proven.

### 1B. Positive account, board and ticket journey

- [x] Account Admin tab and form render in the Developer Org. Browser run #41945104195 showed account creation returning a key and `Status: ACTIVE`; its test assertion was corrected because the UI does not render a `Created:` line. Re-run corrected scenario before treating this as repeatable acceptance evidence.
- [ ] The account invitation route resolves to the correct active account context.
- [x] The owner creates a private board through the public `HousieApp` token route and receives an initial WAITING game in BoardHub (run #41992096929). The record-page path also passed #41985201458. Persisted membership after reload is being verified separately.
- [ ] A second human joins through the private invitation board ID or public-board search.
- [ ] At least two distinct human accounts purchase valid tickets in the WAITING game. Ticket limits, mode selection, point holds and immutable resource-ledger entries reconcile.
- [ ] Ticket layouts are valid 90-ball layouts and no active duplicate layout is issued within the game.
- [ ] WAITING-game withdrawal releases tickets and holds correctly and completes before board leave is allowed. Runs #41962935952 and #41984570416 exposed an org Apex query defect in `completeTicketCommand()`: `Mode__c` (and related result fields `Entry_Fee__c`, `Layout__c`) are read but not selected, leaving the command PREPARED and lock active. Source fix merged in PR #32; targeted Apex deployment requires separate explicit authorization. The LWC-only deployment did not include Apex.
- [ ] Independent, reusable browser scenarios cover account creation, board creation, board join, ticket purchase and withdrawal. Scenarios verify persisted outcomes, not just successful clicks.
- [ ] Apex tests cover business invariants; the browser journey runs against dedicated Developer Org test accounts and scenario-owned data.

Scope discipline:
- This is the human-only path. Bot offers, bot funding, flips, fixes, chat and progression are not prerequisites for the first playable game.
- Keep the existing Big Object / DML transaction boundaries and ticket command idempotency already required for correct purchases. Do not expand into a general recovery dispatcher here.

## Milestone 2 — Start a human-only game

**Goal:** move a fully funded WAITING game to RUNNING exactly once, without bot funding in the first vertical slice.

Acceptance criteria:
- Start requires the configured minimum number of distinct human accounts with paid active tickets; multiple tickets from one account count once.
- An eligible game admin is available.
- Ordinary start follows the two distinct approval roles in SPEC §5.4: an eligible admin and a different non-admin human participant. A platform super-admin can execute immediately.
- Request expiry, rejection semantics, stale-request checks and open-request visibility follow SPEC §5.4.
- Starting freezes active participation, ticket layouts and ticket modes.
- Every valid human ticket hold is captured into the Game Wallet exactly once, with immutable account-resource and Game-Ledger evidence.
- Account balances, Game Wallet totals and obligations reconcile. Invalid, withdrawn, missing or already released holds cannot be captured.
- Duplicate requests and concurrent approvals cannot duplicate captures or leave the game RUNNING with unreconciled funds.
- Apex tests cover role combinations, expiry, stale requests, minimum-participant boundaries, duplicate/concurrent starts and capture accounting.
- A browser scenario proves the two-human approved start and verifies the frozen game state and wallet ledger.

## Milestone 3 — Run the authoritative game runtime

**Goal:** a started game progresses without depending on a player's browser staying open.

Acceptance criteria:
- Number calling persists a unique, ordered 1–90 history using the game configuration snapshot and configured interval.
- Manual marking is accepted only for the ticket owner and valid called numbers; client marking never changes official call history.
- Automatic human tickets are read-only to owners, mark from official call history and submit qualifying claims automatically.
- Game-admin succession follows participant join order and configured offline grace. If no eligible admin is available, the game pauses.
- Pause/resume follows the approval roles and state rules in SPEC §§5.3–5.5. Pause stops game-changing work; resume continues from persisted state and resets the next call interval.
- Missed-call handling applies the configured delay grace, never bursts missed calls and requires authorized resume.
- Apex tests cover ordered unique calls, idempotent scheduled execution, ticket ownership, manual/automatic marking, admin rotation, pause/resume and missed calls.
- Browser coverage proves a short playable round with persisted call history and ticket state.

## Milestone 4 — Claims, winners and complete settlement

**Goal:** complete a game with authoritative winner determination and correct financial settlement.

Acceptance criteria:
- Manual and automatic claims are validated against official ticket layouts and called-number history, not client markings.
- Claim ordering, timing, category closure, winner limits and disqualification follow the game configuration snapshot and SPEC.
- Completed-game settlement handles category awards, remaining prize-pool allocations, refunds, rewards and all outstanding obligations.
- Every payout, refund and adjustment is idempotent, recorded in immutable ledgers and bounded by Game Wallet funds.
- Completion retains permanent game history and creates the next WAITING game using current board settings.
- Apex tests cover invalid/duplicate/simultaneous claims, category closure, rounding, payouts, refunds, interrupted settlement and duplicate requests.
- Browser coverage proves a complete human-only game from board setup through final settlement and verifies account and game ledgers.

## Milestone 5 — Production hardening, recovery and security

**Goal:** harden proven business workflows against interruption, concurrency, misuse and operational failure.

Acceptance criteria:
- Define and implement safe retry, quarantine, repair and compensation for operations that actually exist in the completed game lifecycle.
- Recover PREPARED ticket commands and stale command gates safely. Define how generic PENDING journals are discovered; do not claim global discovery if the storage index cannot support it.
- Add bounded, durable background recovery only where operational evidence justifies it. Retries must not duplicate financial effects.
- Add authenticated, scoped sessions, expiry, revocation, replay protection and rate limiting; account-key possession alone is not sufficient authentication for public use.
- Review Experience Cloud guest access, sharing, Apex permissions and cross-account isolation.
- Add failure-injection, concurrency, load and operational diagnostics for purchase, start/capture, gameplay and settlement.
- Monitoring, alerts and deliberate operator repair procedures are documented and tested.
- Public launch and real-value points remain disabled until this milestone and all preceding milestones pass.

**Deferred work:** [PR #31](https://github.com/housieadmin/HousieSalesforce/pull/31) is closed without merge. Its general recovery infrastructure is not a prerequisite to the first positive game path and remains deferred to Milestone 5. Do not revive or deploy it as part of Milestone 1.

## Milestone 6 — Remaining product capabilities

**Goal:** complete the rest of the SPEC after the first human-only game is proven.

Acceptance criteria are taken from the corresponding SPEC sections and include:
- Bot offers, contributor holds, share revisions/re-acceptance, cancellation and bot winnings (SPEC §9).
- Pre-start ticket flips and fixes (SPEC §§6.4 and 7.1).
- Game cancellation voting and settlement (SPEC §11).
- Potential-winner visibility, chat, quick messages, presence and retention (SPEC §§12–13).
- Completion rewards, achievements, leaderboards and progression (SPEC §§7.2 and 14).
- Board/game history retention and directory/membership paging (SPEC §16 and current implementation limits).
- Each feature has business-rule tests, access-control tests and focused browser coverage.

---

## Session operating rule

At session start, also read [`.project/SESSION_2026-11-05.md`](SESSION_2026-11-05.md) for current implementation context, decisions and browser-agent workflow conventions.

At session start, read this tracker, inspect the relevant SPEC/DATA_MODEL sections and actual source/tests, then work on the first incomplete milestone. At session end, update status/evidence and identify the next action.

A milestone is complete only when its acceptance criteria pass and the evidence is recorded. Source code existing, metadata validation passing, or a button being clickable does not by itself prove a business workflow works in the Developer Org.


### New findings — 2026-11-05

- The ExperienceBundle's Housie Account Detail route explicitly binds `c:housieBoardHub` to `recordId: {!recordId}`. The record-ID architecture is intentional and must remain supported. The `HousieApp` account-key route is a separate entry path.
- Withdrawal run #41962935952 reached the actual Apex finalization and exposed a missing selected field in `completeTicketCommand()`. The source fix is committed to this PR branch; Salesforce PR validation #41963304619 is in progress. No deployment has occurred.
- Source/org parity run #41963078143 completed its comparison after parser correction. It found real source drift in `HousieOperationService.cls`, `housieBoardHub.js`, custom permission descriptions and permission-set class access; tab metadata matched. Keep these as explicit reconciliation items, not normalization exclusions.


### Session closure — 2026-11-05 (previous implementation session)

The previous Milestone 1 implementation session is closed as a work period, **not as a completed milestone**. All its confirmed source changes, handoff notes, and open acceptance gaps are carried forward in PR #32. The next session must resume from this checklist and the session tracker. No Milestone 1 acceptance gate is waived.


### Session closeout and continuation — 2026-11-05

- Previous Milestone 1 implementation session is closed as a work period only. Milestone 1 remains **IN PROGRESS**.
- [PR #32](https://github.com/housieadmin/HousieSalesforce/pull/32) merged as `8a060c91d1db46ee4e2162ce22d2ee4828470068`. Final validation [#41985724115](https://github.com/housieadmin/HousieSalesforce/actions/runs/41985724115) passed metadata validation and all 39 org-resident Apex tests.
- [PR #36](https://github.com/housieadmin/HousieSalesforce/pull/36) closed without merge; Housie-owned access metadata was curated into #32. [PR #37](https://github.com/housieadmin/HousieSalesforce/pull/37) closed without merge and remains deferred pending route/security review. [PR #31](https://github.com/housieadmin/HousieSalesforce/pull/31) closed without merge; recovery remains deferred to Milestone 5.
- BoardHub LWC-only deployment [#41984322994](https://github.com/housieadmin/HousieSalesforce/actions/runs/41984322994) succeeded. Record-page board-create [#41985201458](https://github.com/housieadmin/HousieSalesforce/actions/runs/41985201458) passed 1/1, creating a WAITING board. This proves the `recordId` path only.
- Withdrawal/repurchase remains unaccepted: [#41984570416](https://github.com/housieadmin/HousieSalesforce/actions/runs/41984570416) failed because org Apex omitted `Mode__c` from the completion query; the prepared withdrawal is unresolved. A separate Apex deployment approval is required.
- Remaining Milestone 1 work: finish the Apex source/org round-trip (one functional query delta; one comment-only delta); second-human board join; two-human ticket purchases; wallet hold/resource-ledger reconciliation; withdrawal/repurchase after authorized Apex sync.
- Active continuation branch: `milestone1/continuation`. Keep this as the single implementation PR for all remaining work.


### Verified schema and access parity update — 2026-11-05

- [x] Archived retrieve snapshot parity only: main matches `automation/org-retrieve-41937124487` for 249 object/field/index files. This is historical source-to-snapshot equality, **not live Developer Org schema acceptance**; see the correction below.
- [x] Housie-owned access metadata source parity is semantically established against org retrieve: two custom permissions, three permission sets and three tabs. XML byte differences in the three permission sets and two tabs are whitespace/formatting only; the normalized metadata elements match. Both Salesforce-managed `sfdcInternalInt__*` permission sets remain excluded.
- [ ] Functional Apex parity remains open for `HousieGameTicketService.completeTicketCommand()`; org missing selected `Mode__c`, `Entry_Fee__c`, `Layout__c`. `HousieOperationService` differs only in comments describing transaction boundaries.


### Public route inspection — 2026-11-05

- [x] Public site root inspection [#41990222465](https://github.com/housieadmin/HousieSalesforce/actions/runs/41990222465) passed 1/1: `/housie/s/` mounts `c:housie-app` and renders the Housie shell. This confirms the root LWC is mounted. It does **not** yet prove invitation token resolution or `accountKey` propagation.
- [x] Verify public `HousieApp` token resolution and BoardHub accountKey propagation: run #41992096929 resolved the synthetic account, rendered the welcome state and BoardHub, then created a private board with an initial WAITING game.
- [x] Verify signup activation balances and ledger row count: run #41994178363 passed the signup-grant scenario; one ACTIVE account had 100 points, 0 reserved, 1 auto token, 1 flip, 1 fix, and four distinct resource transaction index rows. The activation path verifies committed grants before ACTIVE.
- [x] LWC/access source-org round-trip [#41990232409](https://github.com/housieadmin/HousieSalesforce/actions/runs/41990232409) confirmed 14/14 LWC, 2/2 custom permissions, 3/3 permission sets and 3/3 tabs with no content differences. Apex remains open for two differences.


### Live schema parity correction — 2026-11-05

- PR #38's source was copied from a read-only Developer Org Metadata API retrieve (PR #34), and its round-trip run #41944754055 confirmed all 249 files byte-for-byte. This is the authoritative schema parity evidence.
- The later `sf sobject describe` diagnostic #41992465038 and `sf data query` attempts were invalid for Big Objects because they use REST API endpoints; Salesforce documents that Big Objects do not support the standard REST sObject API. Describe returned only index fields and SOQL queries reported those non-index fields as unavailable. This is not evidence of missing schema.
- Big Object acceptance queries use Bulk API 2.0 (`sf data export bulk`) with index fields only. Signup-grant acceptance passed #41994178363. Two-human membership run is pending after a test-harness `memberPage` initialization bug was fixed.


### Big Object API correction — 2026-11-05

- Object schema parity is **COMPLETE** for the org retrieve baseline: PR #38's round-trip [#41944754055](https://github.com/housieadmin/HousieSalesforce/actions/runs/41944754055) retrieved 249/249 object metadata files from the Developer Org with zero missing, unexpected or byte-different files (20 object definitions, 213 fields, 16 indexes).
- The apparent missing fields reported by #41991703460/#41992096929 were a test API misuse: `sf data query` and `sf sobject describe` use REST, which Salesforce does not support for Big Objects. The describe result only listed index fields; this did not indicate missing metadata. The incorrect REST describe scenario has been removed.
- Big Object data verification now uses Bulk API 2.0, which Salesforce supports for Big Object queries. Signup-grant, membership and ticket-ledger scenarios use `queryBigObject()`; results are pending.
