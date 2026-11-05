# PR #43 — Session 4 Core Functional Acceptance

## Goal

Complete Milestone 1's core WAITING-game ticket functionality. This stacked PR is based on PR #42 and deliberately separates functional acceptance from URL/reload transport polish.

## Functional gates

- [ ] Two distinct ACTIVE humans join the same WAITING board.
- [ ] Each purchases one distinct MANUAL ticket with a valid 90-ball layout.
- [ ] Salesforce records prove two HUMAN tickets, two participant rows, one wallet hold per account, correct reserved points and resource-ledger transactions.
- [ ] Leave Board is rejected while an active ticket exists.
- [ ] Both humans withdraw; reserved points return to zero and release rows/transactions are appended.
- [ ] Owner repurchases a fresh ticket ID and can withdraw it again.
- [ ] Both humans can leave after their active tickets are released.
- [ ] Synthetic fixtures are left in a known safe state and evidence is recorded.

## Explicitly deferred

- Same-tab reload/session transport and browser history-state polish.
- Broad Apex coverage uplift.
- Historical artifact cleanup and unrelated repository cleanup.
- Network/ExperienceBundle deployment or site activation.

## Execution evidence

- Prior run [#42051842060](https://github.com/housieadmin/HousieSalesforce/actions/runs/42051842060) passed two-human board setup, both purchases and 90-ball layout checks before reload transport failed.
- This PR removes reload transport from the critical path while retaining direct SOQL/Big Object assertions for persisted tickets, wallet holds, participants and resource transactions.
- Current PR #42 validation [#42053135679](https://github.com/housieadmin/HousieSalesforce/actions/runs/42053135679) passed metadata dry-run and 39/39 local Apex tests.


## Session 4 repository handoff

- Predecessor PR #42 is closed as superseded (not merged). Its complete change set is included in this PR's branch.
- PR #43 is the single active Milestone 1 delivery PR and targets `main`.
- Functional browser run requested in issue #9 comment [6662074447](https://github.com/housieadmin/HousieSalesforce/issues/9#issuecomment-6662074447). No execution acknowledgement/result has been returned yet.
- Existing evidence still proves the two distinct purchases and valid 90-ball layouts in [#42051842060](https://github.com/housieadmin/HousieSalesforce/actions/runs/42051842060), and fixed-fixture withdrawal/release/repurchase in [#42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673). This PR's run must prove the combined two-human lifecycle and live ledger assertions.
- Do not mark Milestone 1 complete until the full functional run passes.


## Session 4 review — current evidence and execution model

- PR #43 validation passed on HEAD `f871f119d50cd0fe5ddc79ce26e50d92216e7ce6`: [run #42056606431](https://github.com/housieadmin/HousieSalesforce/actions/runs/42056606431), metadata manifest dry-run succeeded and 39/39 org-resident Apex tests passed. This validates the PR source; it is not the live two-human browser acceptance.
- Live partial evidence remains [#42051842060](https://github.com/housieadmin/HousieSalesforce/actions/runs/42051842060): board creation, second-human join, two distinct MANUAL ticket purchases and 90-ball layout assertions passed. That run stopped at the old reload/session transport assertion before the persisted-state and withdrawal checks.
- Fixed-fixture withdrawal/release/repurchase/final-release regression passed in [#42043222673](https://github.com/housieadmin/HousieSalesforce/actions/runs/42043222673). This is separate from the two-human fixture and does not replace the combined acceptance.
- The latest core-only browser request is issue #9 comment [6662074447](https://github.com/housieadmin/HousieSalesforce/issues/9#issuecomment-6662074447). It has no bot completion acknowledgement yet. Do not dispatch a duplicate mutating run while this request may still be queued.
- Product scope: Milestone 1 is pre-start setup only. Start approvals/funding, runtime, claims and settlement are later milestones. The SPEC remains authoritative; see `.project/MILESTONES.md` and `docs/SPEC.md`.
- Parallel work continues while the browser run is pending: PR validation/review, source/spec alignment, and Git status/evidence updates are independent. Do not run another scenario that mutates the same synthetic account/board fixtures concurrently.
- Core acceptance remains open until the single two-human scenario proves persisted tickets, participants, holds, reserved balances and ledger rows; active-ticket leave rejection; both withdrawals; owner fresh-ticket repurchase/final release; and both final leaves.
