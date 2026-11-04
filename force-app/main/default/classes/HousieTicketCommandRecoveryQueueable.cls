public without sharing class HousieTicketCommandRecoveryQueueable implements Queueable {
    private Map<String,String> commandAccounts;

    public HousieTicketCommandRecoveryQueueable(Map<String,String> commandAccounts) {
        this.commandAccounts = commandAccounts == null
            ? new Map<String,String>() : commandAccounts.clone();
    }

    public void execute(QueueableContext context) {
        // This transaction intentionally performs Big Object writes only.
        for (String requestKey : commandAccounts.keySet()) {
            try {
                HousieGameTicketService.commitTicketCommand(
                    requestKey, commandAccounts.get(requestKey)
                );
            } catch (Exception failure) {
                // The command remains PREPARED and its gate remains closed.
                // The finalizer records the diagnostic and schedules a bounded retry.
                System.debug(LoggingLevel.ERROR,
                    'Ticket command recovery failed for ' + requestKey + ': ' +
                    failure.getMessage());
            }
        }
    }
}
