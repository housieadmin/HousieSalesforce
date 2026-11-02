// Run once after deploying metadata, as a System Administrator.
if ([SELECT count() FROM Housie_Operation_Lock__c WHERE Lock_Key__c = 'GLOBAL'] == 0) {
    insert new Housie_Operation_Lock__c(
        Name = 'GLOBAL',
        Lock_Key__c = 'GLOBAL',
        Purpose__c = 'Serialize Housie Big Object writes'
    );
}
System.debug('Housie infrastructure bootstrap complete.');
