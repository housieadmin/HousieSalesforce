public without sharing class HousieOperationService {
    public class WriteItem {
        public String objectApiName;
        public Map<String,Object> fields;
    }
    public class OperationResult {
        @AuraEnabled public String operationId;
        @AuraEnabled public String status;
        @AuraEnabled public Integer written;
    }

    // In-memory fault injection keeps failure-path tests from leaving permanent
    // Big Object rows in the shared Developer Org.
    @TestVisible private static Boolean useInMemoryStoreForTest = false;
    @TestVisible private static Integer failAfterWritesForTest;
    @TestVisible private static Boolean failBeforeCommitMarkerForTest = false;
    @TestVisible private static String lastOperationIdForTest;
    @TestVisible private static Map<String,Map<String,Object>> testRowsByBusinessKey =
        new Map<String,Map<String,Object>>();
    @TestVisible private static Map<String,Map<String,Object>> testJournalsByOperationId =
        new Map<String,Map<String,Object>>();

    // DML-only preparation/finalization transactions may use the infrastructure
    // row lock. Never call this method from a transaction that invokes insertImmediate.
    public static void lockForWrite() {
        List<Housie_Operation_Lock__c> locks = [
            SELECT Id, Lock_Key__c
            FROM Housie_Operation_Lock__c
            WHERE Lock_Key__c = 'GLOBAL'
            LIMIT 1
            FOR UPDATE
        ];
        HousieErrors.require(!locks.isEmpty(), 'Infrastructure lock is not initialized. Run bootstrap.apex.');
    }

    // Each operation is journaled independently. This transaction performs only
    // Big Object insertImmediate writes; it must not depend on a standard-object
    // row lock for serialization because those locks are released by callouts.
    // Callers must use a durable command gate when cross-request ordering matters.
    // Readers must reject records whose Operation_Journal__b status is not COMMITTED.
    public static OperationResult executeOperation(String operationType, List<WriteItem> writes) {
        HousieErrors.require(String.isNotBlank(operationType), 'Operation type is required.');
        HousieErrors.require(writes != null && !writes.isEmpty(), 'At least one write is required.');
        HousieErrors.require(writes.size() <= 40, 'Operation exceeds the safe write batch size.');
        // This transaction is Big-Object-only: do not acquire DML row locks here.
        // Callers must not hold standard-object FOR UPDATE locks when invoking this method.
        String opId = HousieIds.newId();
        Datetime nowAt = System.now();
        Map<String,Object> journal = new Map<String,Object>{
            'Record_Id__c' => opId, 'Operation_Id__c' => opId,
            'Status__c' => 'PENDING',
            'Operation_Type__c' => operationType, 'Expected_Record_Count__c' => writes.size(),
            'Written_Record_Count__c' => 0, 'Created_At__c' => nowAt
        };
        lastOperationIdForTest = opId;
        Boolean simulateWrites = Test.isRunningTest() && useInMemoryStoreForTest;
        if (simulateWrites) {
            testJournalsByOperationId.put(opId, new Map<String,Object>(journal));
        } else {
            // The recovery index is written first. If the journal write is interrupted,
            // the scanner can still discover and quarantine this operation id.
            HousieBigObjectStore.writeRecoveryIndex(new Map<String,Object>{
                'Record_Id__c' => opId,
                'Operation_Id__c' => opId,
                'Recovery_Bucket__c' => nowAt.formatGmt('yyyyMMddHHmm'),
                'Operation_Type__c' => operationType,
                'Expected_Record_Count__c' => writes.size(),
                'Created_At__c' => nowAt
            });
            HousieBigObjectStore.writeJournal(journal);
        }

        Integer ordinal = 0;
        try {
        if (simulateWrites && failAfterWritesForTest == 0) {
            throw new HousieErrors.HousieException('Injected failure after PENDING journal creation.');
        }
        for (WriteItem item : writes) {
            HousieErrors.require(item != null && item.fields != null, 'Malformed write item.');
            String recordId = (String)item.fields.get('Record_Id__c');
            if (String.isBlank(recordId)) {
                recordId = HousieIds.deterministicId(opId, ordinal);
            }
            HousieErrors.require(recordId.length() == 32, 'Record identifiers must be 32 characters.');
            Map<String,Object> payload = new Map<String,Object>();
            payload.putAll(item.fields);
            payload.put('Record_Id__c', recordId);
            payload.put('Operation_Id__c', opId);
            if (simulateWrites) {
                testRowsByBusinessKey.put(item.objectApiName + ':' + recordId,
                    new Map<String,Object>(payload));
            } else {
                HousieBigObjectStore.insertOne(item.objectApiName, payload);
            }
            ordinal++;
            if (simulateWrites && failAfterWritesForTest != null &&
                ordinal >= failAfterWritesForTest) {
                throw new HousieErrors.HousieException('Injected failure after ' + ordinal + ' Big Object writes.');
            }
        }
        if (simulateWrites && failBeforeCommitMarkerForTest) {
            throw new HousieErrors.HousieException('Injected failure before COMMITTED marker.');
        }
        // Same journal primary key: idempotent upsert changes PENDING to COMMITTED.
        journal.put('Status__c','COMMITTED');
        journal.put('Written_Record_Count__c',writes.size());
        journal.put('Committed_At__c',System.now());
        if (simulateWrites) {
            testJournalsByOperationId.put(opId, new Map<String,Object>(journal));
        } else {
            HousieBigObjectStore.writeJournal(journal);
        }
        OperationResult result = new OperationResult();
        result.operationId = opId; result.status = 'COMMITTED'; result.written = writes.size();
        return result;
        } catch (Exception failure) {
            // Best-effort diagnostic only. Never mark a partially written operation
            // committed; its rows remain invisible to application readers.
            try {
                journal.put('Status__c', 'QUARANTINED');
                journal.put('Written_Record_Count__c', ordinal);
                journal.put('Error__c', failure.getMessage() == null
                    ? 'Unknown Big Object write failure'
                    : failure.getMessage().left(255));
                if (simulateWrites) {
                    testJournalsByOperationId.put(opId, new Map<String,Object>(journal));
                } else {
                    HousieBigObjectStore.writeJournal(journal);
                }
            } catch (Exception diagnosticFailure) {
                System.debug(LoggingLevel.ERROR,
                    'Unable to persist operation failure diagnostic for ' + opId + ': ' +
                    diagnosticFailure.getMessage());
            }
            throw failure;
        }
    }
}