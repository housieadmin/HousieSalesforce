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

**Status: IN PROGRESS — object source format reconciled; Apex/LWC round-trip and remaining setup/runtime checks are open**

**Goal:** make the GitHub source reproducible against the Developer Org, then prove that two human accounts can prepare a WAITING game with paid tickets.

### 1A. Source and org reconciliation

- [x] Confirm the logical schema representation before comparing retrieve output. Main stores fields and Big Object indexes inline in each `*.object-meta.xml`; Salesforce CLI retrieve emits equivalent definitions as separate field/index files.
- [x] Compare all 20 object definitions: field counts and names match the org retrieve for every object; all 16 retrieved Big Object indexes match the repository's ordered index fields. No schema gap was established.
- [ ] Complete a property-level field metadata comparison for types, lengths, precision/scale, requiredness, uniqueness, defaults, relationships and picklist values before declaring full schema parity.
- [ ] Run isolated byte-for-byte org round-trips for curated Housie Apex, LWC, custom permissions, permission sets and tabs using the scoped manifests. The browser scenario is authored; runtime utility staging was fixed in merged PR #39, but org execution is pending.
- [x] Close [PR #35](https://github.com/housieadmin/HousieSalesforce/pull/35) as superseded. It would add duplicate split-form field/index metadata alongside the existing inline definitions. Do not merge it.
- [x] Adopt Salesforce DX split source format. [PR #38](https://github.com/housieadmin/HousieSalesforce/pull/38) merged after metadata dry-run, 39 org-resident Apex tests and a 249-file byte-for-byte object round-trip passed. No deployment was performed.
- [ ] Reconcile Housie Network, tabs and permission sets. [PR #37](https://github.com/housieadmin/HousieSalesforce/pull/37) remains review-only; [PR #36](https://github.com/housieadmin/HousieSalesforce/pull/36) remains audit-only and must be curated to exclude Salesforce-managed entries.
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
- [ ] The owner creates a public or private board. Board creation also creates its initial WAITING game and BOARD_ADMIN membership. Trace #41937185918 found a public-route context bug: BoardHub did not accept the account-key passed by HousieApp. Source fix added to `project/rebaseline`; deployment and browser verification pending.
- [ ] A second human joins through the private invitation board ID or public-board search.
- [ ] At least two distinct human accounts purchase valid tickets in the WAITING game. Ticket limits, mode selection, point holds and immutable resource-ledger entries reconcile.
- [ ] Ticket layouts are valid 90-ball layouts and no active duplicate layout is issued within the game.
- [ ] WAITING-game withdrawal releases tickets and holds correctly and completes before board leave is allowed.
- [ ] Independent, reusable browser scenarios cover account creation, board creation, board join, ticket purchase and withdrawal. Scenarios verify persisted outcomes, not just successful clicks.
- [ ] Apex tests cover business invariants; the browser journey runs against dedicated Developer Org test accounts and scenario-owned data.

Scope discipline:
- This is the human-only path. Bot offers, bot funding, flips, fixes, chat and progression are not prerequisites for the first playable game.
- Keep the existing Big Object / DML transaction boundaries and ticket command idempotency already required for correct purchases. Do not expand into a general recovery dispatcher here.


### Milestone 1 execution checklist (parallel work lanes)

Run independent lanes concurrently where they do not mutate the same test data or require an undeployed source change. Every browser run must identify its source ref and the org deployment state; selecting a source ref does not deploy it.

| Lane | Work item | Status / dependency |
|---|---|---|
| A — Source parity | Curated Apex, LWC, custom permission, permission set and tab round-trip; diagnose byte-level diffs without weakening assertions. | Retrieved all curated files with no missing/unexpected members. #41960912330 identified newline/XML serialization noise plus the expected undeployed BoardHub accountKey source delta. Normalize serialization and retain strict semantic/code checks. |
| B — Account setup | Account Admin tab, create a unique ACTIVE account, verify signup grants and safe key handling. | UI/create passed once; repeatability run pending. |
| C — Board lifecycle | Create private/public WAITING board; verify initial game and BOARD_ADMIN membership; join by invitation and public directory; leave rules. | Board creation source fix exists; org test blocked until explicit deployment. Join scenario still to author after a second dedicated account fixture is identified. |
| D — Ticket lifecycle | Purchase manual/automatic tickets, enforce per-account cap and token rules, validate unique 90-ball layout, withdraw all WAITING tickets, verify hold/point release, repurchase. | Purchase regression exists; new withdrawal/repurchase scenario authored on milestone1/acceptance-parallel; execution pending. |
| E — Data invariants | Apex tests for board creation/join, membership authorization, ticket limits, layout validity, holds/ledger, idempotency and concurrency. | Inspect current test coverage and add only uncovered invariants. |
| F — Evidence/docs | Keep this checklist and BUILD_STATUS aligned with actual runs, commits, deployment state and unresolved failures. | Ongoing. |

**Acceptance gate for Milestone 1:** source/org parity established; two distinct human accounts are active; one account creates a WAITING board; a second account joins; both purchase valid tickets; one can withdraw before start and repurchase; all active ticket/hold/resource-ledger totals reconcile. A browser click or source-only test is not sufficient evidence.

**Explicit deployment gate:** the BoardHub @api accountKey source fix is not in the org yet. Do not schedule a board-create/join acceptance run as if it can pass until the user authorizes deployment. Other independent work (source parity diagnostics, Apex test review, fixture design and existing ticket-path coverage) continues in parallel.

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

**Deferred work:** draft [PR #31](https://github.com/housieadmin/HousieSalesforce/pull/31) is recovery infrastructure work, not a prerequisite to the first positive game path. It remains unmerged and undeployed pending this milestone's later design review. Do not merge or deploy it as part of Milestone 1.

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
