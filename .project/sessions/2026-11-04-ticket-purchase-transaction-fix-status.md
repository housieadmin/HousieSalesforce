# Ticket-purchase transaction fix — status (2026-11-04)

## Status

**Merged to `main`** in [PR #24](https://github.com/housieadmin/HousieSalesforce/pull/24).

- Merge commit: `2e440605ec2ffe9954c7436e771af27a00f855e5`
- Final PR source head: `7cf63ac33ff7cefbf35fdf277dee32fdda536433`
- Scope: ticket-command transaction ordering plus related Big Object lock-order corrections in account and board operations; purchase-stage diagnostics and browser scenario updates are included.

## Defect and correction

Salesforce reported a pending-uncommitted-work error because purchase completion materialized its result after standard-object DML. The result helper reads `Ticket__b` and the operation journal Big Object. The fix materializes this result before completion-stage DML, preserving the separate DML-only prepare / Big Object persistence / DML-only completion requests.

The final PR also corrected related transaction boundaries:
- Ticket purchase/withdrawal preparation locks the per-game command row before Big Object reads, but defers lock activation DML until reads and validation finish.
- The Big Object writer does not acquire the standard-object infrastructure lock; callers that require cross-request ordering must use a durable command gate.
- Signup-grant and board create/join/leave flows no longer hold standard-object row locks before Big Object persistence.
- Board Hub reports the failing purchase stage (prepare, commit or complete).

## Verification evidence

- [PR validation #41770869570](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770869570) on final PR source head `7cf63ac33ff7cefbf35dfd7fdda536433` succeeded. Its metadata dry-run passed. Its `RunLocalTests` step also passed, but that step executes tests already deployed in the Developer Edition; it does **not** execute Apex test classes that exist only in the PR branch.
- [Targeted deploy #41760108157](https://github.com/housieadmin/HousieSalesforce/actions/runs/41760108157) successfully validated and deployed four transaction-boundary Apex classes from source commit `5249a83bb054352add73a507b5598c13e7e02952`, then completed its selected Apex test step.
- Public Experience Cloud purchase regression on `test-user-3`: [run #41770200570](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770200570) and [run #41770555276](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770555276) succeeded. The scenario created a private WAITING board and two distinct active tickets; Aura actions returned SUCCESS and no pending-uncommitted-work error was observed.
- [Cleanup run #41770878933](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770878933) succeeded and removed a duplicate scenario-owned board from the test fixture.

## Verification limits / follow-up

This is evidence for the focused public ticket-purchase path and the changed transaction boundaries. It is **not** proof that the full game lifecycle, withdrawal, bot funding/cancellation, claims, settlement, concurrency or security behaviour is complete.

The successful targeted deployment and browser regression were completed during the PR work and passed against the tested feature source. Together with the successful final PR metadata validation, this satisfies the agreed acceptance criteria for this defect. **Milestone complete; no additional post-merge deployment or browser rerun is required.** Reopen only if a later change causes a regression or a concrete gap is identified.

Test fixture: `test-user-3` now has one regression board and two active tickets. Do not run a third purchase against this account; its configured capacity is two. Use a separately authorized clean fixture for future purchase-creation tests, or keep repeat checks read-only.

## Related GitHub cleanup

PRs [#22](https://github.com/housieadmin/HousieSalesforce/pull/22), [#23](https://github.com/housieadmin/HousieSalesforce/pull/23), [#28](https://github.com/housieadmin/HousieSalesforce/pull/28) and [#29](https://github.com/housieadmin/HousieSalesforce/pull/29) were reviewed and closed as superseded by PR #24; they were not merged.

## Next work

The next engineering target is Milestone 1 in [`../MILESTONES.md`](../MILESTONES.md): implement durable repair/reconciliation for PENDING Big Object operations and stale ticket-command gates before adding more multi-record financial flows. The ordered roadmap is cross-checked against `docs/SPEC.md` and current Apex source.
