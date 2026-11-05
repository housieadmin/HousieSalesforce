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
