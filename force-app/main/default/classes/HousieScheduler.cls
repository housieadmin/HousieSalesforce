global without sharing class HousieScheduler implements Schedulable {
    global void execute(SchedulableContext sc) {
        HousieRecoveryService.dispatch();
    }
}
