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

- [ ] Fix deployment-scenario diagnostics so a non-zero Salesforce CLI exit still yields parsed component failures, Apex test failures, coverage warnings and test counts. Do not truncate JSON before extracting these fields.
- [ ] Re-run the targeted metadata dry-run for ApexClass:HousieGameTicketService only, with RunLocalTests.
- [x] Identify the dry-run gate: 38 local tests ran with zero failures, but org-wide Apex class/trigger coverage is 22%, below Salesforce's required 75%.
- [ ] Refresh coverage with RunLocalTests --code-coverage, then reconcile the Tooling API aggregate inventory. The first read-only query returned 0.37% (6/1,627 lines), which conflicts with the deployment check-only report of 22%; treat the first aggregate as stale/unrefreshed until a post-test query confirms it.
- [ ] Identify the largest uncovered Housie classes/triggers and add meaningful behavior tests.
- [ ] Add meaningful Apex tests for real business behavior until org-wide coverage reaches at least 75%. Do not add tests that only execute lines without asserting invariants.
- [ ] Re-run the targeted dry-run. Do not bypass failing tests, lower coverage, or broaden the deployment manifest to make the command pass.
- [ ] Once dry-run and tests pass, perform the user-authorized deployment of that one Apex class only.
- [ ] Confirm the real deployment reports success and the Apex class is deployed. No object, permission, ExperienceBundle, Network or unrelated Apex deployment is included.
- [ ] Run the curated source/org round-trip and confirm HousieGameTicketService.cls now matches the Developer Org. Keep any unrelated drift explicit.

**Current evidence:** [deployment attempt #42004584546](https://github.com/housieadmin/HousieSalesforce/actions/runs/42004584546) ran the check-only phase. Salesforce CLI returned exit status 1 even though the component success list included HousieGameTicketService; the scenario stopped before the real deployment. The error payload was clipped at 3,000 characters, so the actual test/coverage failure is not yet established. **No Apex deployment occurred.**

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
