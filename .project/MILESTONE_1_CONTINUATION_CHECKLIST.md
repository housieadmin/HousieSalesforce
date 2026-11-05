# Milestone 1 — paid-ticket acceptance continuation

**Status: IN PROGRESS.** PR #41 is merged as a source/setup checkpoint. This checklist tracks the remaining Developer Org acceptance work; it does not waive any Milestone 1 gate.

## Baseline accepted before this continuation

- [x] Object schema retrieve parity: 249/249 files, 20 objects, 213 fields, 16 indexes; zero missing, unexpected or content differences ([#41944754055](https://github.com/housieadmin/HousieSalesforce/actions/runs/41944754055)).
- [x] Housie-owned LWC/access metadata round-trip: 14/14 LWC, 2/2 custom permissions, 3/3 permission sets, 3/3 tabs; zero differences ([#41995794186](https://github.com/housieadmin/HousieSalesforce/actions/runs/41995794186)).
- [x] Signup grants, balances and four resource-ledger rows ([#41994178363](https://github.com/housieadmin/HousieSalesforce/actions/runs/41994178363)).
- [x] Public invitation-token/account context and owner WAITING-board creation ([#41992096929](https://github.com/housieadmin/HousieSalesforce/actions/runs/41992096929)).
- [x] Two distinct ACTIVE humans join the same private WAITING board; membership/game rows persist after reload ([#41994781213](https://github.com/housieadmin/HousieSalesforce/actions/runs/41994781213)).
- [x] PR #41 merged at [8300f6e](https://github.com/housieadmin/HousieSalesforce/commit/8300f6e4f951bb34063e989883a306d18d62c586); its latest PR validation passed ([#42004763089](https://github.com/housieadmin/HousieSalesforce/actions/runs/42004763089)).

## 1. Diagnose and deploy the Apex correction

- [x] Fix deployment-scenario diagnostics so non-zero Salesforce CLI exits preserve structured component, test and coverage details.
- [x] Re-run the targeted metadata dry-run for ApexClass:HousieGameTicketService only, with NoTestRun ([#42011368389](https://github.com/housieadmin/HousieSalesforce/actions/runs/42011368389)).
- [x] Identify the dry-run gate: 38 local tests ran with zero failures, but org-wide Apex class/trigger coverage is 22%, below Salesforce's 75% gate when tests run as part of deployment.
- [x] Confirm existing RunLocalTests pass 39/39; post-test coverage is 22.43% (365/1,627 lines across 30 classes/triggers).
- [x] Identify uncovered Housie classes/triggers. Defer broad coverage work to post-Milestone 1 hardening.
- [ ] Post-Milestone 1: add meaningful Apex tests for uncovered services and raise org-wide coverage to at least 75%. Do not add tests that only execute lines without asserting invariants.
- [x] Run targeted dry-run with NoTestRun; it passed.
- [x] Deploy only the user-authorized Apex class after the NoTestRun dry-run passed ([#42011368389](https://github.com/housieadmin/HousieSalesforce/actions/runs/42011368389)).
- [x] Confirm the real deployment reports Succeeded, with zero component failures and zero tests run. Only ApexClass:HousieGameTicketService was selected; no object, permission, ExperienceBundle, Network or unrelated Apex deployment was included ([#42011368389](https://github.com/housieadmin/HousieSalesforce/actions/runs/42011368389)).
- [x] Curated source/org round-trip passed in [#42011719670](https://github.com/housieadmin/HousieSalesforce/actions/runs/42011719670): 30/30 Apex files present; HousieGameTicketService exact match; only HousieOperationService comment-only drift remains; LWC/access metadata exact.

**Deployment result:** [#42011368389](https://github.com/housieadmin/HousieSalesforce/actions/runs/42011368389) passed both the NoTestRun dry-run and actual single-class deployment. CLI status 0, Salesforce status Succeeded, zero component failures, zero tests run. This is a deployment success, not an Apex test pass.

## 2. Prove two-human paid-ticket purchase

- [x] Run two-human-ticket-purchase.spec.ts after deployment and source/org round-trip; fix its hold query to select indexed Record_Id__c rather than unsupported Hold_Id__c before the acceptance rerun.
- [ ] Verify two distinct ACTIVE human accounts each purchase a distinct valid MANUAL ticket in the same WAITING game. Follow-up LWC token-persistence fix deployed in #42041209642; integrated acceptance retry queued in #42041622400.
- [ ] Verify 90-ball layout validity and no duplicate active layout within the game.
- [ ] Reconcile each account's reserved balance, wallet-hold rows, participant rows and immutable resource-transaction ledger entries.
- [ ] Confirm ticket count, point balances and ledger deltas after independent page reloads.

## 3. Prove WAITING withdrawal, release and repurchase

- [ ] Run the two-human withdrawal/repurchase flow after both ticket and board-service deployments. BoardService deployment is complete; earlier failed fixtures have been cleaned.
- [ ] Verify both humans' active tickets are removed, reserved points return to zero, and Leave Board is rejected while an active human ticket remains.
- [ ] Verify one HOLD_RELEASE resource-ledger row per withdrawn ticket and no stale active hold/command lock.
- [ ] Verify one human can repurchase a fresh ticket with a new ticket ID, a new hold and a matching reserve ledger row; release that final fixture ticket before leaving the board.
- [ ] Run ticket-withdrawal-regression.spec.ts as a separate fixed-fixture regression and preserve the run evidence. Baseline preserves unrelated reservations; withdrawal/release passed, app-level repurchase receipt locator corrected. Retry in #42041622400.

## 4. Cleanup and closeout

- [x] Suspended only the two prior M1 Purchase synthetic accounts after withdrawal, zero reserved points, two append-only hold rows and six resource-ledger rows were verified ([#42014618549](https://github.com/housieadmin/HousieSalesforce/actions/runs/42014618549)).
- [ ] Update .project/MILESTONES.md and .project/SESSION_2026-11-05.md with exact run links and accepted/unaccepted outcomes. Combined run #42040038322 is stalled in source retrieve; added a 180-second CLI process timeout for retry.
- [ ] Keep Milestone 1 IN PROGRESS until all required acceptance criteria pass.

## Deferred, separate review

- [ ] ExperienceBundle/Network route, guest access, sharing and security reconciliation requires a SPEC-reviewed design and a separate narrowly scoped PR/deployment. Do not mix it into the paid-ticket Apex deployment.
- [ ] Artifact #13398760836 remains retained; deletion is not authorized.


## Deferred after Milestone 1 (user-directed)

- [ ] Delete historical Browser Agent artifacts containing synthetic bearer-key traces/CLI diagnostics: runs #42011719670 (artifact 13407053087), #42012325312 (artifact 13406743940), and #42012797427 (artifact 13407248997). Associated synthetic accounts are suspended. Do not prioritize this before Milestone 1 closeout.
- [ ] Broad Apex test coverage uplift; current 39 local Apex tests remain the baseline. Add comprehensive coverage after Milestone 1 classes and flows stabilize.
