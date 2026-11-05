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
- [ ] Run the curated source/org round-trip and confirm HousieGameTicketService.cls matches the Developer Org. Combined acceptance run is pending; record the actual run link after completion.

**Deployment result:** [#42011368389](https://github.com/housieadmin/HousieSalesforce/actions/runs/42011368389) passed both the NoTestRun dry-run and actual single-class deployment. CLI status 0, Salesforce status Succeeded, zero component failures, zero tests run. This is a deployment success, not an Apex test pass.

## 2. Prove two-human paid-ticket purchase

- [ ] Run two-human-ticket-purchase.spec.ts only after the targeted Apex deployment and round-trip pass.
- [ ] Verify two distinct ACTIVE human accounts each purchase a distinct valid MANUAL ticket in the same WAITING game.
- [ ] Verify 90-ball layout validity and no duplicate active layout within the game.
- [ ] Reconcile each account's reserved balance, wallet-hold rows, participant rows and immutable resource-transaction ledger entries.
- [ ] Confirm ticket count, point balances and ledger deltas after independent page reloads.

## 3. Prove WAITING withdrawal, release and repurchase

- [ ] Run the two-human withdrawal/repurchase flow after deployment.
- [ ] Verify both humans' active tickets are removed and reserved points return to zero.
- [ ] Verify one HOLD_RELEASE resource-ledger row per withdrawn ticket and no stale active hold/command lock.
- [ ] Verify one human can repurchase a fresh ticket with a new ticket ID, a new hold and a matching reserve ledger row.
- [ ] Run ticket-withdrawal-regression.spec.ts as a separate fixed-fixture regression and preserve the run evidence.

## 4. Cleanup and closeout

- [ ] Suspend only accounts created by these Milestone 1 scenarios using suspend-milestone1-synthetic-accounts.spec.ts; verify the resulting status.
- [ ] Update .project/MILESTONES.md and .project/SESSION_2026-11-05.md with exact run links and accepted/unaccepted outcomes.
- [ ] Keep Milestone 1 IN PROGRESS until all required acceptance criteria pass.

## Deferred, separate review

- [ ] ExperienceBundle/Network route, guest access, sharing and security reconciliation requires a SPEC-reviewed design and a separate narrowly scoped PR/deployment. Do not mix it into the paid-ticket Apex deployment.
- [ ] Artifact #13398760836 remains retained; deletion is not authorized.
