# PR #42 — Milestone 1 closeout tracker

**Status: IN PROGRESS — acceptance rerun required before merge.**  
**PR:** https://github.com/housieadmin/HousieSalesforce/pull/42  
**Branch:** `milestone1/paid-ticket-acceptance`  
**Base:** `main`

This tracker is the operational closeout checklist for PR #42. Keep the milestone open until the required evidence below is complete. Do not infer acceptance from a successful deploy or a passing metadata validation alone.

## Verified

- [x] Narrow NoTestRun dry-run and deployment of only `ApexClass:HousieGameTicketService` succeeded: [run #42011368389](https://github.com/housieadmin/HousieSalesforce/actions/runs/42011368389). No tests ran during deployment; this is not a test pass.
- [x] Narrow NoTestRun dry-run and deployment of only `ApexClass:HousieBoardService` succeeded: [run #42014362545](https://github.com/housieadmin/HousieSalesforce/actions/runs/42014362545).
- [x] Three narrow NoTestRun iterations of only `LightningComponentBundle:housieApp` succeeded; latest fragment-token iteration: [run #42042968124](https://github.com/housieadmin/HousieSalesforce/actions/runs/42042968124).
- [x] Curated source/org round-trip passed in [run #42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673): 30/30 Apex classes present; only the explicitly accepted comment-only `HousieOperationService.cls` drift remains; LWC/access metadata matched.
- [x] Fixed-fixture withdrawal regression passed in [run #42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673): original WAITING ticket withdrawn, hold released, a new ticket repurchased, and replacement ticket finally released. Unrelated account reservations were preserved.
- [x] ExperienceBundle/Network/FlexiPage inspection passed in [run #42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673). Verified routes: public root mounts `c:housieApp`; account detail mounts `c:housieBoardHub` with `recordId`; the Account Admin tab targets `Housie_Account_Admin`.
- [x] Current Network settings were read and recorded: `UnderConstruction`; sender `sumit.gupta@salesforce.com`; guest file access `true`; guest member visibility `false`; guest Chatter `false`; self-registration `false`; ExperienceBundle `isAvailableToGuests=true`. No Network or ExperienceBundle metadata was deployed.

## Remaining merge gates

- [ ] Pass the complete two-human purchase/withdrawal/repurchase/leave-guard scenario. In [run #42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673), the test failed before creating the board or purchasing tickets: the token-authenticated `openAccount` route called required account-key redaction, but that route does not render an `Account key:` label. No ticket purchase or 90-ball assertion ran. The current branch makes redaction optional on token routes and still requires it immediately after account creation. Retry [#42051842060](https://github.com/housieadmin/HousieSalesforce/actions/runs/42051842060) then passed board creation, second-human join, both ticket purchases and 90-ball layout assertions, but failed after a full page reload because the test had removed the bearer token and did not re-present it. No ledger/persistence assertions ran. The LWC now preserves the captured credential only in the current browser history entry, allowing same-tab reload without URL or localStorage persistence. The test asserts the URL is clean and history state is present before and after reload. Retry requested in issue #9 comment [6661570718](https://github.com/housieadmin/HousieSalesforce/issues/9#issuecomment-6661570718).
- [ ] Confirm persisted ticket rows, distinct ticket IDs/layouts, 10-point holds, participant rows and resource-ledger deltas for both humans.
- [ ] Confirm Leave Board is rejected while each human has an active ticket.
- [ ] Confirm withdrawal commits for both humans, reserved points return to zero, release rows append, repurchase uses a fresh ticket/hold, and final release permits board leave.
- [ ] Run current PR validation after the latest branch changes; require metadata dry-run and all 39 existing Apex tests.
- [ ] Update `.project/MILESTONE_1_CONTINUATION_CHECKLIST.md`, `.project/MILESTONES.md`, and `.project/SESSION_2026-11-05.md` with final run evidence.
- [ ] Refresh PR #42 description with exact evidence and merge only after all required gates pass.

## Explicitly deferred — do not pull into this PR

- [ ] Broad Apex coverage uplift (39 existing tests remain the baseline; org-wide coverage was 22.43%). User-directed post-Milestone 1 hardening.
- [ ] Delete historical artifacts containing synthetic bearer-key traces: #42011719670 / artifact 13407053087, #42012325312 / artifact 13406743940, #42012797427 / artifact 13407248997. Associated accounts were suspended. Deletion requires a separate authorized tooling/process task.
- [ ] Clean up synthetic accounts/boards/tickets created by failed or retried acceptance attempts. Defer until after Milestone 1, per user direction. Do not log or retain account keys, emails or record IDs.
- [ ] Network security remediation and any site availability/activation change. Do not deploy Network metadata, change guest access, or activate the site without a separate SPEC-reviewed plan and explicit approval. The current sender is not Housie-owned and guest file access is enabled; preserve the restrictive settings already false.

## Session execution log

- 2026-11-05: recovered PR #42 state, inspected Actions jobs/logs and current branch checklist.
- 2026-11-05: confirmed #42014618549 cleanup passed (two prior M1 Purchase accounts reconciled, left their boards and were suspended).
- 2026-11-05: integrated run #42043222673 passed source parity, fixed-fixture withdrawal regression and route/security inspection. Two-human scenario failed before board creation/purchase in `openAccount` because the redaction helper required a key label not rendered on token routes. No purchase/layout assertions ran. Helper fixed; retry requested in issue #9 comment #6661443528.


- 2026-11-05: route/security review artifact #13423708327 verified the current Network values and ExperienceBundle routes. Decision for this PR: keep Network `UnderConstruction`; no Network/ExperienceBundle deployment or activation.
- 2026-11-05: helper fix committed; account creation still requires key redaction, while token-route calls are optional. Run #42051842060 passed board creation, second-human join, both purchases and 90-ball layout checks, then failed after reload because the test did not re-present the token. LWC commit [17fc174](https://github.com/housieadmin/HousieSalesforce/commit/17fc174355eda3b6e19f265c7b860fd37f04380c) now stores the captured account token in the current history entry while stripping it from the URL; test commit [59ee3f3](https://github.com/housieadmin/HousieSalesforce/commit/59ee3f3930eeb354cffced233d38567105359259) asserts clean URL and history-state restoration across a same-tab reload.

- 2026-11-05: next browser retry will exercise same-tab reload without reintroducing URL credentials, then continue through persisted ticket/hold/ledger assertions, leave guard, withdrawals, repurchase and final leave.


## New reload-persistence blocker — 2026-11-05

- Focused retry [#42051842060](https://github.com/housieadmin/HousieSalesforce/actions/runs/42051842060) passed initial route resolution, board creation, second-human join, both distinct MANUAL ticket purchases and 90-ball layout/uniqueness checks. It failed after page reload: the app rendered the unauthenticated Welcome screen instead of restoring the owner's account context.
- This is a functional route/session defect, not a locator issue. The LWC held the account token only in component memory and removed it from the URL; a full reload creates a new component instance without that memory. The retry also attempted to re-present the token in the URL, but Experience Cloud still returned the unauthenticated screen.
- Current source fix: `housieApp.js` stores the captured bearer token in the current browser history entry (`history.state.housieAccountToken`), while keeping it out of query strings/fragments and preserving existing router state. It does not use localStorage.
- Current test fix: the two-human scenario preserves the history state, asserts the URL has no bearer query/fragment, and reloads without reintroducing the key. It then verifies the same account context and all persisted ticket/ledger/withdrawal behavior.
- Focused history-state regression requested through issue #9 comment [6661570718](https://github.com/housieadmin/HousieSalesforce/issues/9#issuecomment-6661570718). Do not count it as passing until its result is available.
- **Deployment gate:** the new LWC source has not yet been deployed to the Developer Org. A narrow NoTestRun dry-run/deployment of only `LightningComponentBundle:housieApp` is required before the focused browser acceptance can validate the fix. Obtain explicit user authorization before deploying.
- Latest PR validation for the current implementation HEAD is [#42052917833](https://github.com/housieadmin/HousieSalesforce/actions/runs/42052917833); confirm its manifest dry-run and 39 Apex tests pass. The latest checklist commit is docs-only and does not change the validated LWC/test source.


## Current approval gate — 2026-11-05

- Source/test changes are committed and PR validation #42053135679 passed. The browser run #42052718437 confirmed the Developer Org has not received the history-state LWC fix (`historyTokenPresent=false`).
- Waiting for explicit user approval to run a narrow NoTestRun dry-run and deployment of only `LightningComponentBundle:housieApp`. After deployment, rerun the focused browser acceptance and only then consider PR #42 merge-ready.
