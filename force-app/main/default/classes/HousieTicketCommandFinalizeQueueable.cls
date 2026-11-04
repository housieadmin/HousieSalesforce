public without sharing class HousieTicketCommandFinalizeQueueable implements Queueable {
    private Map<String,String> commandAccounts;

    public HousieTicketCommandFinalizeQueueable(Map<String,String> commandAccounts) {
        this.commandAccounts = commandAccounts == null
            ? new Map<String,String>() : commandAccounts.clone();
    }

    public void execute(QueueableContext context) {
        // No insertImmediate calls are made in this DML-finalization transaction.
        for (String requestKey : commandAccounts.keySet()) {
            Savepoint checkpoint = Database.setSavepoint();
            try {
                HousieGameTicketService.completeTicketCommand(
                    requestKey, commandAccounts.get(requestKey)
                );
            } catch (Exception failure) {
                Database.rollback(checkpoint);
                List<Housie_Ticket_Command__c> rows = [
                    SELECT Id, Recovery_Finalization_Attempts__c, Recovery_Status__c
                    FROM Housie_Ticket_Command__c
                    WHERE Request_Key__c = :requestKey
                    LIMIT 1
                    FOR UPDATE
                ];
                if (rows.isEmpty()) continue;
                Integer attempts = rows[0].Recovery_Finalization_Attempts__c == null
                    ? 0 : rows[0].Recovery_Finalization_Attempts__c.intValue();
                rows[0].Recovery_Status__c =
                    HousieRecoveryService.canFinalize(attempts)
                    ? 'READY' : 'QUARANTINED';
                rows[0].Recovery_Error__c = failure.getMessage() == null
                    ? 'Finalization failed; Big Object operation is not yet visible.'
                    : failure.getMessage().left(255);
                update rows[0];
            }
        }
    }
}
