public without sharing class HousieOperationService {
    public class WriteItem {
        @AuraEnabled public String objectApiName;
        @AuraEnabled public Map<String,Object> fields;
    }
    public class OperationResult {
        @AuraEnabled public String operationId;
        @AuraEnabled public String status;
        @AuraEnabled public Integer written;
    }

    // A single infrastructure row serializes all writes. Big Object records are
    // written immediately; the journal's COMMITTED marker is written last.
    // Readers must reject records whose Operation_Journal__b status is not COMMITTED.
    @AuraEnabled
    public static OperationResult commit(String operationType, List<WriteItem> writes) {
        HousieErrors.require(String.isNotBlank(operationType), 'Operation type is required.');
        HousieErrors.require(writes != null && !writes.isEmpty(), 'At least one write is required.');
        HousieErrors.require(writes.size() <= 40, 'Operation exceeds the safe write batch size.');
        List<Housie_Operation_Lock__c> locks = [
            SELECT Id, Lock_Key__c FROM Housie_Operation_Lock__c
            WHERE Lock_Key__c = 'GLOBAL' LIMIT 1 FOR UPDATE
        ];
        HousieErrors.require(!locks.isEmpty(), 'Infrastructure lock is not initialized. Run bootstrap.apex.');
        String opId = HousieIds.newId();
        Datetime nowAt = System.now();
        Map<String,Object> journal = new Map<String,Object>{
            'Record_Id__c' => opId, 'Operation_Id__c' => opId,
            'Status__c' => 'PENDING',
            'Operation_Type__c' => operationType, 'Expected_Record_Count__c' => writes.size(),
            'Written_Record_Count__c' => 0, 'Created_At__c' => nowAt
        };
        HousieBigObjectStore.writeJournal(journal);

        Integer ordinal = 0;
        for (WriteItem item : writes) {
            HousieErrors.require(item != null && item.fields != null, 'Malformed write item.');
            String recordId = HousieIds.deterministicId(opId, ordinal++);
            Map<String,Object> payload = new Map<String,Object>();
            payload.putAll(item.fields);
            payload.put('Record_Id__c', recordId);
            payload.put('Operation_Id__c', opId);
            HousieBigObjectStore.insertOne(item.objectApiName, payload);
        }
        // Same journal primary key: idempotent upsert changes PENDING to COMMITTED.
        journal.put('Status__c','COMMITTED');
        journal.put('Written_Record_Count__c',writes.size());
        journal.put('Committed_At__c',System.now());
        HousieBigObjectStore.writeJournal(journal);
        OperationResult result = new OperationResult();
        result.operationId = opId; result.status = 'COMMITTED'; result.written = writes.size();
        return result;
    }
}
