public without sharing class HousieRecoveryService {
    public static final Integer MAX_COMMANDS_PER_RUN = 10;
    public static final Integer MAX_RECOVERY_ATTEMPTS = 3;
    public static final Integer STALE_MINUTES = 2;

    // This dispatcher is DML-only. Big Object writes and finalization run in
    // separate Queueable transactions to preserve the Salesforce transaction boundary.
    public static void dispatch() {
        Datetime nowAt = System.now();
        Datetime cutoff = nowAt.addMinutes(-STALE_MINUTES);
        List<Housie_Ticket_Command__c> commands = [
            SELECT Id, Request_Key__c, Account_Key__c, Game_Id__c, Status__c,
                   Created_At__c, Recovery_Status__c, Recovery_Attempts__c,
                   Recovery_Last_Attempt_At__c, Recovery_Finalization_Attempts__c, Recovery_Error__c
            FROM Housie_Ticket_Command__c
            WHERE Status__c = 'PREPARED'
              AND Created_At__c <= :cutoff
              AND (
                  Recovery_Status__c = null OR Recovery_Status__c = 'READY' OR
                  (Recovery_Status__c IN ('QUEUED','FINALIZING') AND
                   (Recovery_Last_Attempt_At__c = null OR Recovery_Last_Attempt_At__c <= :cutoff))
              )
            LIMIT :MAX_COMMANDS_PER_RUN
            FOR UPDATE
        ];

        Map<String,String> toWrite = new Map<String,String>();
        Map<String,String> toFinalize = new Map<String,String>();
        List<Housie_Ticket_Command__c> changed = new List<Housie_Ticket_Command__c>();

        for (Housie_Ticket_Command__c command : commands) {
            if (command.Recovery_Status__c == 'QUEUED' || command.Recovery_Status__c == 'FINALIZING') {
                if (command.Recovery_Last_Attempt_At__c == null ||
                    command.Recovery_Last_Attempt_At__c <= cutoff) {
                    Integer finalizationAttempts = command.Recovery_Finalization_Attempts__c == null
                        ? 0 : command.Recovery_Finalization_Attempts__c.intValue();
                    if (!canFinalize(finalizationAttempts)) {
                        quarantine(command, 'Automatic DML finalization attempt limit reached.');
                        changed.add(command);
                        continue;
                    }
                    command.Recovery_Finalization_Attempts__c = finalizationAttempts + 1;
                    command.Recovery_Status__c = 'FINALIZING';
                    command.Recovery_Last_Attempt_At__c = nowAt;
                    command.Updated_At__c = nowAt;
                    toFinalize.put(command.Request_Key__c, command.Account_Key__c);
                    changed.add(command);
                }
                continue;
            }

            Integer attempts = command.Recovery_Attempts__c == null
                ? 0 : command.Recovery_Attempts__c.intValue();
            if (!canRetry(attempts, command.Recovery_Status__c)) {
                quarantine(command, 'Automatic recovery attempt limit reached.');
                changed.add(command);
                continue;
            }

            List<Housie_Game_Command_Lock__c> gates = [
                SELECT Id, Status__c, Active_Command_Key__c
                FROM Housie_Game_Command_Lock__c
                WHERE Game_Id__c = :command.Game_Id__c
                LIMIT 1
                FOR UPDATE
            ];
            if (gates.isEmpty()) {
                // Missing coordination state is not permission to proceed. Recreate
                // the gate in QUARANTINED state so later commands remain blocked.
                insert new Housie_Game_Command_Lock__c(
                    Game_Id__c = command.Game_Id__c,
                    Status__c = 'QUARANTINED',
                    Active_Command_Key__c = command.Request_Key__c,
                    Created_At__c = nowAt,
                    Updated_At__c = nowAt
                );
                quarantine(command, 'Game command gate was missing; gate recreated in quarantine.');
                changed.add(command);
                continue;
            }
            if (gates[0].Status__c != 'PROCESSING' ||
                gates[0].Active_Command_Key__c != command.Request_Key__c) {
                quarantine(command, 'Prepared command does not own the game command gate.');
                changed.add(command);
                continue;
            }

            command.Recovery_Status__c = 'QUEUED';
            command.Recovery_Attempts__c = attempts + 1;
            command.Recovery_Last_Attempt_At__c = nowAt;
            command.Recovery_Error__c = null;
            toWrite.put(command.Request_Key__c, command.Account_Key__c);
            changed.add(command);
        }

        if (!changed.isEmpty()) update changed;

        // A queueable processes only one kind of transaction: Big Object writes.
        if (!toWrite.isEmpty()) System.enqueueJob(new HousieTicketCommandRecoveryQueueable(toWrite));
        // Finalization reads Big Objects, then performs DML; it never calls insertImmediate.
        if (!toFinalize.isEmpty()) System.enqueueJob(new HousieTicketCommandFinalizeQueueable(toFinalize));
        // Journal quarantine runs in its own Big-Object-only transaction.
        System.enqueueJob(new HousieOperationJournalRecoveryQueueable());

        repairStaleGates(cutoff, nowAt);
    }

    private static void repairStaleGates(Datetime cutoff, Datetime nowAt) {
        List<Housie_Game_Command_Lock__c> gates = [
            SELECT Id, Game_Id__c, Status__c, Active_Command_Key__c, Updated_At__c
            FROM Housie_Game_Command_Lock__c
            WHERE Status__c = 'PROCESSING' AND Updated_At__c <= :cutoff
            LIMIT :MAX_COMMANDS_PER_RUN
            FOR UPDATE
        ];
        if (gates.isEmpty()) return;

        Set<String> commandKeys = new Set<String>();
        for (Housie_Game_Command_Lock__c gate : gates) {
            if (String.isNotBlank(gate.Active_Command_Key__c)) commandKeys.add(gate.Active_Command_Key__c);
        }
        Map<String,Housie_Ticket_Command__c> byKey = new Map<String,Housie_Ticket_Command__c>();
        if (!commandKeys.isEmpty()) {
            for (Housie_Ticket_Command__c command : [
                SELECT Request_Key__c, Status__c, Recovery_Status__c
                FROM Housie_Ticket_Command__c
                WHERE Request_Key__c IN :commandKeys
            ]) byKey.put(command.Request_Key__c, command);
        }

        List<Housie_Game_Command_Lock__c> updates = new List<Housie_Game_Command_Lock__c>();
        for (Housie_Game_Command_Lock__c gate : gates) {
            Housie_Ticket_Command__c command = byKey.get(gate.Active_Command_Key__c);
            if (command == null) {
                gate.Status__c = 'QUARANTINED';
                gate.Updated_At__c = nowAt;
                updates.add(gate);
            } else if (command.Status__c == 'COMMITTED') {
                gate.Status__c = 'IDLE';
                gate.Active_Command_Key__c = null;
                gate.Updated_At__c = nowAt;
                updates.add(gate);
            } else if (command.Recovery_Status__c == 'QUARANTINED') {
                gate.Status__c = 'QUARANTINED';
                gate.Updated_At__c = nowAt;
                updates.add(gate);
            } else if (command.Status__c == 'PREPARED' &&
                (String.isBlank(command.Recovery_Status__c) ||
                 new Set<String>{'READY','QUEUED','FINALIZING'}.contains(command.Recovery_Status__c))) {
                // Touch a live prepared gate so this bounded scan does not
                // repeatedly select the same in-flight records.
                gate.Updated_At__c = nowAt;
                updates.add(gate);
            } else {
                gate.Status__c = 'QUARANTINED';
                gate.Updated_At__c = nowAt;
                updates.add(gate);
            }
        }
        if (!updates.isEmpty()) update updates;
    }

    private static void quarantine(Housie_Ticket_Command__c command, String reason) {
        command.Recovery_Status__c = 'QUARANTINED';
        command.Recovery_Error__c = reason.left(255);
    }

    @TestVisible
    private static Boolean canRetry(Integer attempts, String recoveryStatus) {
        return recoveryStatus != 'QUARANTINED' &&
            (attempts == null || attempts < MAX_RECOVERY_ATTEMPTS);
    }

    public static Boolean canFinalize(Integer attempts) {
        return attempts == null || attempts < MAX_RECOVERY_ATTEMPTS;
    }

    @TestVisible
    private static Boolean isStale(Datetime updatedAt, Datetime nowAt) {
        return updatedAt != null && updatedAt <= nowAt.addMinutes(-STALE_MINUTES);
    }
}
