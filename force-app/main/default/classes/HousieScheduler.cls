global without sharing class HousieScheduler implements Schedulable {
    global void execute(SchedulableContext sc) {
        // The scheduler is intentionally a recovery dispatcher. Deploy a schedule only
        // after validating org limits and wiring the approved operational cadence.
        System.debug(LoggingLevel.INFO, 'Housie scheduler heartbeat ' + System.now());
    }
}
