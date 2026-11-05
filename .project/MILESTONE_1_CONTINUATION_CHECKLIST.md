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
- [ ] Verify two distinct ACTIVE human accounts each purchase a distinct valid MANUAL ticket in the same WAITING game. Third narrow `housieApp` NoTestRun deployment passed in [#42042968124](https://github.com/housieadmin/HousieSalesforce/actions/runs/42042968124). Integrated run [#42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673) reached the token route but failed in the test helper waiting for an `Account key:` label that is not rendered on that route. The helper is now optional for token-authenticated pages. Retry [#42051842060](https://github.com/housieadmin/HousieSalesforce/actions/runs/42051842060) passed board creation, second-human join, both ticket purchases and 90-ball layout checks, then failed after reload because the test did not re-present the token. The scenario now re-presents the same account credential for reload; HousieApp removes it from browser history.
- [ ] Verify 90-ball layout validity and no duplicate active layout within the game.
- [ ] Reconcile each account's reserved balance, wallet-hold rows, participant rows and immutable resource-transaction ledger entries.
- [ ] Confirm ticket count, point balances and ledger deltas after independent page reloads.

## 3. Prove WAITING withdrawal, release and repurchase

- [ ] Complete the two-human withdrawal/repurchase flow after both ticket and board-service deployments. The fixed-fixture withdrawal regression passed in [#42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673); the integrated two-human scenario has not yet reached ticket purchase.
- [ ] Verify both humans' active tickets are removed, reserved points return to zero, and Leave Board is rejected while an active human ticket remains.
- [ ] Verify one HOLD_RELEASE resource-ledger row per withdrawn ticket and no stale active hold/command lock.
- [ ] Verify one human can repurchase a fresh ticket with a new ticket ID, a new hold and a matching reserve ledger row; release that final fixture ticket before leaving the board.
- [ ] Run ticket-withdrawal-regression.spec.ts as a separate fixed-fixture regression and preserve the run evidence. Withdrawal/release passed; replacement-ticket assertion now checks the new card after repurchase.

## 4. Cleanup and closeout

- [x] Suspended only the two prior M1 Purchase synthetic accounts after withdrawal, zero reserved points, two append-only hold rows and six resource-ledger rows were verified ([#42014618549](https://github.com/housieadmin/HousieSalesforce/actions/runs/42014618549)).
- [x] Update the continuation checklist, session tracker and route/security review with exact run links and accepted/unaccepted outcomes. Source/org parity passed in [#42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673): Apex 30/30 present with only the explicitly accepted `HousieOperationService.cls` comment-only drift; LWC 14/14, custom permissions 2/2, permission sets 3/3 and tabs 3/3 exact. Earlier [#42040038322](https://github.com/housieadmin/HousieSalesforce/actions/runs/42040038322) failed before the latest bounded retry.
- [ ] Keep Milestone 1 IN PROGRESS until all required acceptance criteria pass.

## Deferred, separate review

- [x] Re-confirm ExperienceBundle routes and Network settings read-only in [#42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673). Decision recorded in `.project/MILESTONE_1_ROUTE_SECURITY_REVIEW.md`: no Network/ExperienceBundle deployment or site activation in Milestone 1; keep `UnderConstruction`; actual remediation/sender replacement remains separate approved work.
- [ ] Artifact #13398760836 remains retained; deletion is not authorized.


## Deferred after Milestone 1 (user-directed)

- [ ] Delete historical Browser Agent artifacts containing synthetic bearer-key traces/CLI diagnostics: runs #42011719670 (artifact 13407053087), #42012325312 (artifact 13406743940), and #42012797427 (artifact 13407248997). Associated synthetic accounts are suspended. Do not prioritize this before Milestone 1 closeout.
- [ ] Broad Apex test coverage uplift; current 39 local Apex tests remain the baseline. Add comprehensive coverage after Milestone 1 classes and flows stabilize.


- [ ] Post-Milestone 1: suspend/delete only synthetic accounts created by failed/retried two-human acceptance attempts after verifying their ticket/hold/ledger state. User requested that remaining cleanup work be deferred until after Milestone 1; do not interrupt acceptance to clean them now.


## Verified continuation update — 2026-11-05, session 4

- PR validation [#42043742084](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043742084) passed metadata validation and all 39 local Apex tests.
- Synthetic-account recovery [#42014618549](https://github.com/housieadmin/HousieSalesforce/actions/runs/42014618549) passed 2/2 scenarios; the two prior `M1 Purchase` fixtures were safely released/verified and suspended.
- Integrated acceptance [#42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673): source/org parity, fixed-fixture withdrawal regression and read-only Experience route/Network inspection passed; two-human acceptance failed only because the browser redaction helper incorrectly required an account-key label on a token-authenticated route.
- Corrected `redactAccountKey` to redact when a label is present without requiring that label on token routes; query/fragment bearer tokens are still removed from browser history after app resolution. Retry requested in issue #9 comment [6661443528](https://github.com/housieadmin/HousieSalesforce/issues/9#issuecomment-6661443528).
- Verified current Network settings: `UnderConstruction`, guest file access `true`, guest member visibility `false`, guest Chatter `false`, self-registration `false`, sender `sumit.gupta@salesforce.com`; ExperienceBundle `isAvailableToGuests=true`. Root is `c:housieApp`; account detail is `c:housieBoardHub` with `recordId`. No Network/ExperienceBundle deployment or activation is approved or included.
- Milestone 1 remains **IN PROGRESS**. Do not merge until two-human purchase/withdrawal/repurchase/leave-guard acceptance passes and the final PR checks are green.


## Latest integrated evidence — 2026-11-05

- [x] Targeted `HousieGameTicketService` and `HousieBoardService` Apex NoTestRun deployments passed: [#42011368389](https://github.com/housieadmin/HousieSalesforce/actions/runs/42011368389) and [#42014362545](https://github.com/housieadmin/HousieSalesforce/actions/runs/42014362545).
- [x] Latest `housieApp` fragment-token NoTestRun dry-run/deployment passed: [#42042968124](https://github.com/housieadmin/HousieSalesforce/actions/runs/42042968124).
- [x] Integrated source/org parity passed in [#42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673): Apex 30/30 present, only the accepted comment-only `HousieOperationService.cls` drift remains, and LWC/access metadata match.
- [x] Fixed-fixture withdrawal regression passed in [#42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673): release of original ticket, repurchase with a new ticket ID, and final release all passed while unrelated reservations were preserved.
- [x] ExperienceBundle/FlexiPage/Network inspection passed in [#42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673). Corrected parser verified the current Network settings; see `.project/MILESTONE_1_ROUTE_SECURITY_REVIEW.md`. No Network or ExperienceBundle deployment occurred.
- [ ] Two-human acceptance remains open. Run #42043222673 completed both purchases, unique MANUAL ticket checks and 90-ball layout validation, then failed at a stale post-reload redaction call that incorrectly required an Account key label on the authenticated app route. The current branch uses optional redaction after reload. The rerun must verify reload persistence, both wallet holds, participant and resource-ledger rows, Leave Board rejection while tickets are active, both withdrawals, owner repurchase with a new ticket ID, final release and successful leave.
- [ ] Run PR validation against the latest branch after the final acceptance fix; require metadata dry-run and all 39 existing Apex tests.

**Do not clean up the synthetic accounts/boards/tickets from failed or retried two-human acceptance attempts during this milestone.** Per user direction, defer this cleanup until after Milestone 1. Historical artifact deletion and broad Apex coverage uplift are also deferred.

- [ ] Complete the two-human persisted-state and lifecycle assertions. [#42051842060](https://github.com/housieadmin/HousieSalesforce/actions/runs/42051842060) proved the route, board creation, second-human join, both ticket purchases and valid 90-ball layouts; it stopped at reload before SOQL/ledger assertions. A reload helper now re-authenticates with the same key before checking persisted state.
