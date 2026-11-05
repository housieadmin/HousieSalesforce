# Housie storage and retention policy

**Status: design guidance only. No purge job is enabled.**

## Quota model

Developer Edition currently documents 5 MB of standard data storage and a separate allocation of 1 million Big Object records per org. The 16 Housie Big Objects share that single record allocation. Reducing the number of object definitions does not itself reduce stored records. Moving high-volume records to standard objects would move them into the smaller standard-data quota, not create capacity.

Use the Salesforce storage documentation linked from `docs/BUILD_STATUS.md` as the authoritative quota reference; allocations can change by edition and org.

## Retention classes

| Data group | Objects | Default policy | Why |
|---|---|---|---|
| Financial and ownership evidence | `Account_Resource_Transaction__b`, `Wallet_Hold__b`, `Game_Ledger__b`, `Ticket__b`, `Claim__b` | Permanent; never routine-purge | Required to reconcile balances, obligations, ticket ownership, winners and settlement. |
| Game and board history | `Board__b`, `Board_Member__b`, `Game__b`, `Game_Participant__b`, `Game_Event__b` | Retain while history is a product feature; no purge until archive/export requirements exist | Needed for board membership, game reconstruction, replay, admin succession and user history. |
| Audit and operation visibility | `Audit_Record__b`, `Operation_Journal__b` | Permanent until a proven compaction/visibility design exists | Journal rows currently gate visibility of committed Big Object writes. Deleting a committed journal row can make valid data appear uncommitted to readers. |
| Idempotency/control history | `Game_Action_Request__b`, `Game_Action_Response__b` | Retain for at least the maximum retry/replay horizon; exact horizon to be designed | Old request/response records may be required to reject duplicate commands and diagnose stale actions. Verify actual call sites before pruning. |
| Deferred financial features | `Bot_Contribution__b` | Preserve any existing financial evidence; new feature work remains deferred | Contributions represent holds/obligations if the bot feature is used. |
| Short-lived user content | `Chat_Message__b` | Candidate for configured short retention (current default config says 3 days), only after index and UI/history behavior are verified | Chat is not financial evidence and has an explicit retention setting. |
| DML outbox | `Housie_Ticket_Command__c` | Keep pending rows; purge terminal rows only after a conservative idempotency window and reconciliation | Durable ticket purchase/withdrawal payload and idempotency key survive the multi-request Big Object write phases. |
| Concurrency state | `Housie_Game_Command_Lock__c`, `Housie_Operation_Lock__c` | Keep active locks; terminal per-game locks may be candidates after game closure and no pending commands; singleton operation lock is not a volume concern | Deleting an active lock can admit overlapping financial operations. |

## Cleanup design requirements

1. Measure current standard-data usage and Big Object record counts before each cleanup cycle. Record baseline and post-run counts.
2. Define a retention horizon per object, not one global age threshold. Financial, audit, game-history and idempotency records have different obligations.
3. Inspect each Big Object's complete index definition before designing a purge query. Big Object deletion requires the complete index key; a date filter alone is not sufficient.
4. Use bounded batches. Salesforce Big Object `Database.deleteImmediate()` supports up to 50,000 records per batch; test the exact index-key behavior in a disposable org dataset first.
5. Purge only terminal, independently verified records. Never delete a journal row while any dependent operation/read path still needs it.
6. Keep a dry-run mode that reports candidate counts and sample keys. Require explicit operator approval before enabling destructive deletion.
7. Make each purge idempotent and resumable; persist progress outside the rows being deleted.
8. Keep scenario-owned browser test data clearly tagged so it can be removed separately from permanent product history.

## Candidate simplifications

- Evaluate consolidating `Housie_Game_Command_Lock__c` and `Housie_Operation_Lock__c` into one lock object keyed by lock scope. Do not implement until lock ordering, contention and concurrent ticket-command tests prove equivalence.
- Do not remove `Operation_Journal__b` or `Housie_Ticket_Command__c` without replacing their current correctness guarantees.
- Do not add more Big Objects for generic recovery before the human game path is proven and record-volume estimates justify them.

## Implementation gate

No scheduled cleanup, Big Object purge, lock consolidation or object deletion is authorized by this document. First collect per-object volume, retention requirements, index keys and consumer call sites; then implement and test a separate retention milestone.
