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

- [ ] Pass the complete two-human purchase/withdrawal/repurchase/leave-guard scenario. In [run #42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673), both ticket purchases and 90-ball layout assertions completed; the run then failed because the staged test called required account-key redaction after reload, when the key is not rendered. The current branch version makes post-reload redaction optional. Rerun the failed Browser Agent job and inspect the full result.
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
- 2026-11-05: integrated run #42043222673 passed source parity, withdrawal regression and route/security inspection; two-human scenario stopped at a post-reload redaction-helper assertion. Current branch source uses optional redaction after reload; rerun remains required.
