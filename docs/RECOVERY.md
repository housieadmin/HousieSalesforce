# Housie operation recovery

This runbook describes the Milestone 1 recovery contract. The implementation is delivered in the recovery feature branch; it must be deployed and runtime-verified before scheduling it in the shared Developer Org.

## Recovery states and actions

### Big Object operation journal

| State | Meaning | Automated action |
|---|---|---|
| PENDING | Operation started; one or more Big Object writes may be incomplete | Keep every row invisible to application readers |
| COMMITTED | All expected writes completed and the commit marker is present | Readers may include the operation |
| QUARANTINED | Operation is incomplete or its journal is missing | Keep rows invisible; require deliberate operator reconstruction/compensation |

HousieOperationService writes an append-only recovery-index entry before writing the PENDING journal. The recovery queue is keyed by UTC minute bucket and operation ID. HousieOperationJournalRecoveryQueueable scans at most 40 entries per execution using a durable Big Object cursor. Entries older than the two-minute stale window are checked against the journal. A PENDING or missing journal is changed to QUARANTINED and records expected/written counts plus the original failure message where available.

**Generic PENDING operations are never automatically replayed.** The writer does not persist a generic copy of its write payload. Big Object rows cannot be rolled back; replaying a reconstructed or guessed payload could duplicate ledger effects. Quarantine is therefore the only safe automatic action. An operator must reconstruct the intended business operation from its source command/evidence, verify each physical row and create a deliberate repair or compensating operation with new idempotency keys. Never mark a journal COMMITTED merely to make rows visible.

### Prepared ticket commands

| Recovery status | Meaning | Automated action |
|---|---|---|
| blank / READY | Prepared command is eligible for retry | Retry only if it still owns the per-game PROCESSING gate |
| QUEUED | Big Object-only retry has been dispatched | Wait for the retry transaction; after the stale window, dispatch DML finalization |
| FINALIZING | DML-only completion has been dispatched | Retry finalization after the stale window if needed |
| COMPLETED | Command finalization succeeded | No further action |
| QUARANTINED | Gate ownership/state is inconsistent or three attempts were exhausted | Keep the command and game gate closed for operator review |

Ticket commands are safe to retry because the outbox retains the full request payload and business record IDs are deterministic. A retry upserts the same Big Object business keys and only a COMMITTED journal makes those rows visible. The dispatcher caps Big Object write dispatches at three and DML finalization dispatches at three, tracked independently. It does not release reserved funds or clear a quarantined gate automatically.

### Per-game command gate

| State | Meaning |
|---|---|
| IDLE | New command may acquire the gate |
| PROCESSING | One prepared command owns the gate |
| QUARANTINED | Gate/command evidence is inconsistent; new commands are blocked |

A stale PROCESSING gate is reset to IDLE only when its referenced command is already COMMITTED. A missing command or a quarantined command moves the gate to QUARANTINED. HousieGameTicketService refuses new work when a gate is QUARANTINED.

## Transaction boundaries

The dispatcher deliberately uses separate transactions:

1. HousieScheduler / HousieRecoveryService.dispatch: DML-only selection, attempt tracking and Queueable dispatch.
2. HousieTicketCommandRecoveryQueueable: Big-Object-only command retry; no standard-object DML.
3. HousieTicketCommandFinalizeQueueable: Big Object reads followed by DML-only command/account/gate finalization; no insertImmediate.
4. HousieOperationJournalRecoveryQueueable: Big-Object-only journal scan, quarantine and cursor advancement.

Do not combine these phases or add standard-object row locks to the Big-Object write transaction.

## Scheduling

After deploying the recovery metadata and Apex classes, validate the target org and bootstrap infrastructure as required. Then schedule the dispatcher at a bounded cadence (five minutes is the initial operational recommendation):

```apex
System.schedule(
    'Housie Recovery Dispatcher',
    '0 0/5 * * * ?',
    new HousieScheduler()
);
```

This PR changes the scheduler implementation but does not create a CronTrigger in the Developer Org. Confirm the schedule exists and inspect its Apex Jobs/CronTrigger history before relying on automatic recovery. Do not install duplicate schedules.

## Operator diagnostics

Inspect quarantined/prepared commands:

```sql
SELECT Request_Key__c, Game_Id__c, Status__c, Recovery_Status__c,
       Recovery_Attempts__c, Recovery_Last_Attempt_At__c, Recovery_Error__c
FROM Housie_Ticket_Command__c
WHERE Recovery_Status__c IN ('READY','QUEUED','FINALIZING','QUARANTINED')
```

Inspect one operation journal by its leading index key:

```sql
SELECT Operation_Id__c, Operation_Type__c, Status__c,
       Expected_Record_Count__c, Written_Record_Count__c, Error__c, Created_At__c
FROM Operation_Journal__b
WHERE Operation_Id__c = '32-character-operation-id'
```

Inspect quarantined gates:

```sql
SELECT Game_Id__c, Status__c, Active_Command_Key__c, Updated_At__c
FROM Housie_Game_Command_Lock__c
WHERE Status__c = 'QUARANTINED'
```

For each quarantine, preserve the command/journal/gate records and related account/game evidence. Reconcile wallet reservations, resource transactions and visible Big Object rows before deciding on compensation. The current milestone does not provide an automated operator release/compensation endpoint; do not clear a gate or alter a journal directly as a shortcut.

## Validation boundary

A metadata dry run plus RunLocalTests passed in PR validation #41836082427; this validates metadata and tests already deployed in the Developer Org. It does not execute Apex tests that exist only on this feature branch. Branch-only tests now cover failure after PENDING creation, partial writes, failure before the COMMITTED marker, deterministic duplicate retry using an in-memory writer, finalization interruption/retry state, and stale or mismatched command gates. Those tests still require execution in a target test environment. Milestone 1 remains incomplete until those tests pass, concurrent retry and stale-gate behavior are verified, and operational exactly-once plus target-org runtime checks pass.
