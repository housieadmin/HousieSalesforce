# Session record — 2026-11-03: ticket-purchase transaction failure

## Objective

Diagnose and fix the public Experience Cloud ticket-purchase failure reported as:

> A callout was unsuccessful because of pending uncommitted work related to a process, flow, or Apex operation.

This was the originating Housie Salesforce development session. Preserve this record as the durable continuation point; do not treat every debugging attempt as a separate issue.

## Repository and delivery baseline

- Repository: `housieadmin/HousieSalesforce`
- Fix branch: `test/callout-transaction-e2e-v2`
- Branch HEAD at handoff: `20bea7242490cb772c7fe9f2779df93e6605a2ba`
- Root-cause fix commit: [`e1aaac7e1f95c031033c8c7869048b901c919b1b`](https://github.com/housieadmin/HousieSalesforce/commit/e1aaac7e1f95c031033c8c7869048b901c919b1b)
- Default branch at documentation update: `main` at `188a6a397b5e5257b861ad27e08d71f760a0a6a3`
- The fix branch has **not** been merged to `main` in the repository state checked for this record. Do not infer otherwise from successful org deployment.
- Existing PR #8, [Fix pending-work errors in Big Object write transactions](https://github.com/housieadmin/HousieSalesforce/pull/8), remains open on the earlier `fix/insert-immediate-transaction-boundaries` branch. It is not the final fix branch/commit described here. Review its relationship before merging or closing it; do not assume it contains the final correction.

## Root cause and code correction

The ticket action is deliberately split across separate Apex requests:

1. DML-only command preparation.
2. Big Object persistence using `Database.insertImmediate`.
3. DML-only command completion.

The final defect was in the completion method of `HousieGameTicketService.cls`. It performed standard-object DML and then called `commandResult(command)`. That result materialization queried `Ticket__b` and the operation journal Big Object. Big Object reads/callout-style operations after pending standard-object DML triggered Salesforce's pending-uncommitted-work transaction error.

The fix in commit `e1aaac7...` materializes `commandResult(command)`—including the required Big Object reads—before standard-object DML, then performs the DML and returns the already-materialized result. This preserves the intended DML / Big Object / DML request boundaries and avoids moving Big Object reads behind uncommitted DML in the completion transaction.

Do not regress this ordering. When changing this flow, inspect the full completion path and all helpers it invokes, not only the line where the UI reports the stage.

## Diagnostic history and false leads

- The public UI initially surfaced the generic pending-uncommitted-work message under the `prepare` stage. That label was not sufficient to identify the actual offending operation; the final defect was in completion result materialization.
- Earlier diagnostic work on `fix/insert-immediate-transaction-boundaries` removed some row-lock assumptions around Big Object writes and added exception-stage labels. Those changes helped investigation but were **not** the final root-cause correction.
- Do not treat the earlier diagnostic branch or PR #8 as proof that this specific completion-order defect is fixed.
- The browser test initially raced asynchronous Board Hub loading and looked for a Buy button too early. The scenario was hardened to wait for the board and a real actionable state before deciding whether to recover or purchase.
- The first combined workflow attempt had browser dependency-install/runtime problems; subsequent workflow changes isolated trusted browser tooling from feature scenario source. PR #21 merged this browser-runtime correction to main.

## Verification evidence

All run links below are durable evidence; distinguish what each proves.

### Fresh purchase and recovery

[Browser run 41658822433](https://github.com/housieadmin/HousieSalesforce/actions/runs/41658822433)

- Public Experience Cloud Test User 2 route.
- Recovered an existing prepared purchase, then created a genuinely new, distinct second ticket while capacity remained.
- Scenario asserted no pending-uncommitted-work error and an increased active-ticket count.
- Result: `1 passed (11.2s)`.

### Repeat stability

[Browser run 41659285721](https://github.com/housieadmin/HousieSalesforce/actions/runs/41659285721)

- Confirmed the account remained at two active tickets, with no third purchase and no pending action/error.
- Result: `1 passed (9.1s)`.

### Latest combined deploy-and-verify

[Combined workflow run 41660185471](https://github.com/housieadmin/HousieSalesforce/actions/runs/41660185471)

- Triggered through issue #11 using the user's required `/sf deploy-and-verify` command.
- Source ref: `test/callout-transaction-e2e-v2`.
- Deployment job succeeded; selected local Apex tests step succeeded; browser job succeeded.
- Browser scenario result: `1 passed (5.5s)`.
- This final browser pass was intentionally read-only because Test User 2 had reached its two-ticket capacity. It verified the stable final state and absence of pending recovery/error; it did not create a third ticket.
- Earlier run 41658822433 is the evidence for the fresh second purchase. Together, these runs cover purchase creation/recovery and final combined deploy/browser verification.

## Test route and fixture constraints

- Public site: `https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s`
- Test User 2 route: `https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/housie-account/a00g500001D7iIrAAJ/housie-test-user-2`
- Board: `B-0001`; game: `WAITING`; board: `ACTIVE`.
- Test User 2 has two active tickets, the current configured cap. Do not attempt a third purchase on this account. Use a separately verified fixture/account for a new purchase test; otherwise keep the scenario read-only.
- Scenario: `browser-agent/scenarios/callout-transaction-e2e.spec.ts`.

## Workflow instruction

The user explicitly directed future sessions to use the combined workflow action on issue #11:

```
/sf deploy-and-verify
ref: <feature-branch>
paths:
- <changed paths>
mode: standard
tests: local
scenarios:
- <browser-agent/scenario.spec.ts>
description: <specific expected behaviour and assertions>
confirm: DEPLOY
```

Use this combined action for authorized deploy-and-browser-verification work. Do not substitute separate deploy and browser commands. Deployment and browser verification must both succeed before reporting a combined end-to-end pass. Do not deploy or modify external systems without explicit authorization.

## Current status and next work

- **Verified on the feature branch / target Developer Edition:** the completion-order correction was deployed and passed the evidence above.
- **Not merged to main in the checked repository state:** the source correction remains on `test/callout-transaction-e2e-v2`. Main still needs to receive the fix through the normal reviewed PR path.
- **Not established:** broad transaction-path correctness, full gameplay, or comprehensive integration/concurrency/security coverage. The successful ticket scenario does not prove withdrawal, other Big Object command paths, game start, claims or settlement.
- Next useful action: inspect the current PR/branch state and reconcile PR #8 with the final fix branch; then prepare/review the correct PR to bring the root-cause fix and its scenario into main. After merge, use issue #11 combined deploy-and-verify against the merged ref and add regression coverage for adjacent purchase/withdrawal completion paths.
- Keep diagnostic instrumentation until broader regression coverage establishes which diagnostics are still useful; do not remove it as cleanup without reviewing the source and evidence.

## Scope boundary

This record covers the ticket-purchase pending-uncommitted-work defect and the deployment/browser automation used to verify it. It is not a full project handoff. For future tasks, start from `AGENTS.md` and `.project/README.md`, then load only the relevant workstream guide and source/requirements.
