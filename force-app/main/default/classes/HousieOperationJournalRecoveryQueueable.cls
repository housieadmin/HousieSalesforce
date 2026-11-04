public without sharing class HousieOperationJournalRecoveryQueueable implements Queueable {
    private static final Integer BATCH_SIZE = 40;
    private static final String CURSOR_ID = 'GLOBAL';

    public void execute(QueueableContext context) {
        // This job is Big-Object-only. It discovers old operations through a
        // time-bucketed index, quarantines incomplete journals, and advances a
        // Big Object cursor. It never attempts to replay payloads that were not saved.
        Datetime nowAt = System.now();
        String cutoffBucket = nowAt.addMinutes(-(HousieRecoveryService.STALE_MINUTES + 1))
            .formatGmt('yyyyMMddHHmm');

        List<Operation_Recovery_Cursor__b> cursors = [
            SELECT Record_Id__c, Last_Recovery_Bucket__c, Last_Operation_Id__c
            FROM Operation_Recovery_Cursor__b
            WHERE Record_Id__c = :CURSOR_ID
            LIMIT 1
        ];

        List<Operation_Recovery__b> candidates = new List<Operation_Recovery__b>();
        String priorBucket;
        String priorOperation;
        if (cursors.isEmpty() || String.isBlank(cursors[0].Last_Recovery_Bucket__c) ||
            String.isBlank(cursors[0].Last_Operation_Id__c)) {
            candidates = [
                SELECT Operation_Id__c, Recovery_Bucket__c, Operation_Type__c,
                       Expected_Record_Count__c, Created_At__c
                FROM Operation_Recovery__b
                WHERE Recovery_Bucket__c <= :cutoffBucket
                ORDER BY Recovery_Bucket__c ASC, Operation_Id__c ASC
                LIMIT :BATCH_SIZE
            ];
        } else {
            priorBucket = cursors[0].Last_Recovery_Bucket__c;
            priorOperation = cursors[0].Last_Operation_Id__c;
            if (String.isNotBlank(priorBucket) && String.isNotBlank(priorOperation)) {
                candidates = [
                    SELECT Operation_Id__c, Recovery_Bucket__c, Operation_Type__c,
                           Expected_Record_Count__c, Created_At__c
                    FROM Operation_Recovery__b
                    WHERE Recovery_Bucket__c = :priorBucket
                      AND Operation_Id__c > :priorOperation
                    ORDER BY Recovery_Bucket__c ASC, Operation_Id__c ASC
                    LIMIT :BATCH_SIZE
                ];
            }
            if (candidates.size() < BATCH_SIZE && String.isNotBlank(priorBucket)) {
                Integer remaining = BATCH_SIZE - candidates.size();
                candidates.addAll([
                    SELECT Operation_Id__c, Recovery_Bucket__c, Operation_Type__c,
                           Expected_Record_Count__c, Created_At__c
                    FROM Operation_Recovery__b
                    WHERE Recovery_Bucket__c > :priorBucket
                    ORDER BY Recovery_Bucket__c ASC, Operation_Id__c ASC
                    LIMIT :remaining
                ]);
            }
        }
        // The second-page query uses a single indexed range condition. Filter
        // newer buckets in Apex so Big Object index restrictions remain satisfied.
        for (Integer i = candidates.size() - 1; i >= 0; i--) {
            if (candidates[i].Recovery_Bucket__c.compareTo(cutoffBucket) > 0) {
                candidates.remove(i);
            }
        }
        if (candidates.isEmpty()) return;

        Set<String> operationIds = new Set<String>();
        for (Operation_Recovery__b candidate : candidates) {
            operationIds.add(candidate.Operation_Id__c);
        }
        Map<String,Operation_Journal__b> journals = new Map<String,Operation_Journal__b>();
        for (Operation_Journal__b journal : [
            SELECT Operation_Id__c, Record_Id__c, Status__c, Operation_Type__c,
                   Expected_Record_Count__c, Written_Record_Count__c, Created_At__c, Error__c
            FROM Operation_Journal__b
            WHERE Operation_Id__c IN :operationIds
            LIMIT :BATCH_SIZE
        ]) {
            journals.put(journal.Operation_Id__c, journal);
        }

        for (Operation_Recovery__b candidate : candidates) {
            Operation_Journal__b journal = journals.get(candidate.Operation_Id__c);
            if (journal != null && (journal.Status__c == 'COMMITTED' ||
                journal.Status__c == 'QUARANTINED')) continue;

            Map<String,Object> quarantineRecord = new Map<String,Object>{
                'Record_Id__c' => candidate.Operation_Id__c,
                'Operation_Id__c' => candidate.Operation_Id__c,
                'Status__c' => 'QUARANTINED',
                'Operation_Type__c' => candidate.Operation_Type__c,
                'Expected_Record_Count__c' => candidate.Expected_Record_Count__c,
                'Written_Record_Count__c' => journal == null || journal.Written_Record_Count__c == null
                    ? 0 : journal.Written_Record_Count__c,
                'Created_At__c' => candidate.Created_At__c,
                'Error__c' => journal == null
                    ? 'Recovery index exists but the PENDING journal is missing. No payload is available for replay.'
                    : ((String.isBlank(journal.Error__c) ? '' : journal.Error__c + ' | ') +
                      'Quarantined: ' + String.valueOf(journal.Written_Record_Count__c) +
                      ' of ' + String.valueOf(journal.Expected_Record_Count__c) +
                      ' records reported written; no durable payload exists for safe replay.').left(255)
            };
            HousieBigObjectStore.writeJournal(quarantineRecord);
        }

        Operation_Recovery__b lastCandidate = candidates[candidates.size() - 1];
        HousieBigObjectStore.writeRecoveryCursor(new Map<String,Object>{
            'Record_Id__c' => CURSOR_ID,
            'Last_Recovery_Bucket__c' => lastCandidate.Recovery_Bucket__c,
            'Last_Operation_Id__c' => lastCandidate.Operation_Id__c,
            'Updated_At__c' => nowAt
        });
    }
}
