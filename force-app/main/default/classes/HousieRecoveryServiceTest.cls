@IsTest
private class HousieRecoveryServiceTest {
    private static List<HousieOperationService.WriteItem> sampleWrites() {
        List<HousieOperationService.WriteItem> writes = new List<HousieOperationService.WriteItem>();
        for (String suffix : new List<String>{'one','two'}) {
            HousieOperationService.WriteItem item = new HousieOperationService.WriteItem();
            item.objectApiName = 'Ticket__b';
            item.fields = new Map<String,Object>{
                'Record_Id__c' => HousieIds.stableId('TEST_TICKET', suffix),
                'Game_Id__c' => HousieIds.stableId('TEST_GAME', 'journal-failure'),
                'Ticket_Kind__c' => 'HUMAN'
            };
            writes.add(item);
        }
        return writes;
    }

    @IsTest
    static void failureAfterPendingJournalQuarantinesWithoutWrites() {
        HousieOperationService.useInMemoryStoreForTest = true;
        HousieOperationService.failAfterWritesForTest = 0;
        try {
            HousieOperationService.executeOperation('TEST_PENDING_FAILURE', sampleWrites());
            System.assert(false, 'Expected injected failure.');
        } catch (HousieErrors.HousieException expected) {
            System.assert(expected.getMessage().contains('PENDING journal'));
        }
        Map<String,Object> journal =
            HousieOperationService.testJournalsByOperationId.get(HousieOperationService.lastOperationIdForTest);
        System.assertEquals('QUARANTINED', journal.get('Status__c'));
        System.assertEquals(0, journal.get('Written_Record_Count__c'));
        System.assertEquals(0, HousieOperationService.testRowsByBusinessKey.size());
    }

    @IsTest
    static void partialBigObjectWritesAreQuarantinedWithExactCount() {
        HousieOperationService.useInMemoryStoreForTest = true;
        HousieOperationService.failAfterWritesForTest = 1;
        try {
            HousieOperationService.executeOperation('TEST_PARTIAL_FAILURE', sampleWrites());
            System.assert(false, 'Expected injected failure.');
        } catch (HousieErrors.HousieException expected) {
            System.assert(expected.getMessage().contains('1 Big Object writes'));
        }
        Map<String,Object> journal =
            HousieOperationService.testJournalsByOperationId.get(HousieOperationService.lastOperationIdForTest);
        System.assertEquals('QUARANTINED', journal.get('Status__c'));
        System.assertEquals(1, journal.get('Written_Record_Count__c'));
        System.assertEquals(1, HousieOperationService.testRowsByBusinessKey.size());
    }

    @IsTest
    static void failureBeforeCommittedMarkerQuarantinesAllWrittenRows() {
        HousieOperationService.useInMemoryStoreForTest = true;
        HousieOperationService.failBeforeCommitMarkerForTest = true;
        try {
            HousieOperationService.executeOperation('TEST_COMMIT_MARKER_FAILURE', sampleWrites());
            System.assert(false, 'Expected injected failure.');
        } catch (HousieErrors.HousieException expected) {
            System.assert(expected.getMessage().contains('COMMITTED marker'));
        }
        Map<String,Object> journal =
            HousieOperationService.testJournalsByOperationId.get(HousieOperationService.lastOperationIdForTest);
        System.assertEquals('QUARANTINED', journal.get('Status__c'));
        System.assertEquals(2, journal.get('Written_Record_Count__c'));
        System.assertEquals(2, HousieOperationService.testRowsByBusinessKey.size());
    }

    @IsTest
    static void duplicateRetryUpsertsSameBusinessKeysExactlyOnce() {
        HousieOperationService.useInMemoryStoreForTest = true;
        HousieOperationService.failAfterWritesForTest = 1;
        try {
            HousieOperationService.executeOperation('TEST_RETRY', sampleWrites());
            System.assert(false, 'Expected first attempt to fail.');
        } catch (HousieErrors.HousieException expected) {
            System.assert(expected.getMessage().contains('1 Big Object writes'));
        }
        String firstOperationId = HousieOperationService.lastOperationIdForTest;
        HousieOperationService.failAfterWritesForTest = null;
        HousieOperationService.failBeforeCommitMarkerForTest = false;

        HousieOperationService.OperationResult retry =
            HousieOperationService.executeOperation('TEST_RETRY', sampleWrites());

        System.assertEquals(2, HousieOperationService.testRowsByBusinessKey.size());
        System.assertEquals('QUARANTINED',
            HousieOperationService.testJournalsByOperationId.get(firstOperationId).get('Status__c'));
        System.assertEquals('COMMITTED',
            HousieOperationService.testJournalsByOperationId.get(retry.operationId).get('Status__c'));
        for (Map<String,Object> row : HousieOperationService.testRowsByBusinessKey.values()) {
            System.assertEquals(retry.operationId, row.get('Operation_Id__c'));
        }
    }

    @IsTest
    static void retryPolicyStopsAtConfiguredAttemptLimit() {
        System.assertEquals(true, HousieRecoveryService.canRetry(0, null));
        System.assertEquals(true, HousieRecoveryService.canRetry(2, 'READY'));
        System.assertEquals(false, HousieRecoveryService.canRetry(3, 'READY'));
        System.assertEquals(false, HousieRecoveryService.canRetry(0, 'QUARANTINED'));
    }

    @IsTest
    static void dispatcherQueuesOnlyCommandsThatOwnTheirGate() {
        String gameId = HousieIds.stableId('TEST_GAME', 'recovery-dispatch');
        String requestKey = HousieIds.stableId('TEST_COMMAND', 'recovery-dispatch');
        Datetime oldAt = System.now().addMinutes(-10);
        insert new Housie_Game_Command_Lock__c(
            Game_Id__c = gameId,
            Status__c = 'PROCESSING',
            Active_Command_Key__c = requestKey,
            Created_At__c = oldAt,
            Updated_At__c = oldAt
        );
        insert new Housie_Ticket_Command__c(
            Request_Key__c = requestKey,
            Account_Key__c = HousieIds.stableId('TEST_ACCOUNT', 'missing-account'),
            Board_Id__c = HousieIds.stableId('TEST_BOARD', 'recovery-dispatch'),
            Game_Id__c = gameId,
            Action_Type__c = 'PURCHASE',
            Ticket_Id__c = HousieIds.stableId('TEST_TICKET', 'recovery-dispatch'),
            Hold_Id__c = HousieIds.stableId('TEST_HOLD', 'recovery-dispatch'),
            Mode__c = 'MANUAL',
            Entry_Fee__c = 10,
            Layout__c = '[]',
            Status__c = 'PREPARED',
            Created_At__c = oldAt,
            Updated_At__c = oldAt
        );

        Test.startTest();
        HousieRecoveryService.dispatch();
        Test.stopTest();

        Housie_Ticket_Command__c recovered = [
            SELECT Recovery_Status__c, Recovery_Attempts__c
            FROM Housie_Ticket_Command__c
            WHERE Request_Key__c = :requestKey
            LIMIT 1
        ];
        System.assertEquals('QUEUED', recovered.Recovery_Status__c);
        System.assertEquals(1, recovered.Recovery_Attempts__c);
    }

    @IsTest
    static void dispatcherQuarantinesCommandWithWrongGateOwner() {
        String gameId = HousieIds.stableId('TEST_GAME', 'wrong-gate');
        String requestKey = HousieIds.stableId('TEST_COMMAND', 'wrong-gate');
        Datetime oldAt = System.now().addMinutes(-10);
        insert new Housie_Game_Command_Lock__c(
            Game_Id__c = gameId,
            Status__c = 'PROCESSING',
            Active_Command_Key__c = HousieIds.stableId('TEST_COMMAND', 'different-owner'),
            Created_At__c = oldAt,
            Updated_At__c = oldAt
        );
        insert new Housie_Ticket_Command__c(
            Request_Key__c = requestKey,
            Account_Key__c = HousieIds.stableId('TEST_ACCOUNT', 'wrong-gate'),
            Board_Id__c = HousieIds.stableId('TEST_BOARD', 'wrong-gate'),
            Game_Id__c = gameId,
            Action_Type__c = 'PURCHASE',
            Ticket_Id__c = HousieIds.stableId('TEST_TICKET', 'wrong-gate'),
            Hold_Id__c = HousieIds.stableId('TEST_HOLD', 'wrong-gate'),
            Mode__c = 'MANUAL',
            Entry_Fee__c = 10,
            Layout__c = '[]',
            Status__c = 'PREPARED',
            Created_At__c = oldAt,
            Updated_At__c = oldAt
        );

        Test.startTest();
        HousieRecoveryService.dispatch();
        Test.stopTest();

        Housie_Ticket_Command__c quarantined = [
            SELECT Recovery_Status__c, Recovery_Error__c
            FROM Housie_Ticket_Command__c
            WHERE Request_Key__c = :requestKey
            LIMIT 1
        ];
        System.assertEquals('QUARANTINED', quarantined.Recovery_Status__c);
        System.assert(quarantined.Recovery_Error__c.contains('does not own'));
    }

    @IsTest
    static void finalizerFailureReturnsCommandToBoundedRetryState() {
        String gameId = HousieIds.stableId('TEST_GAME', 'finalizer-failure');
        String requestKey = HousieIds.stableId('TEST_COMMAND', 'finalizer-failure');
        Datetime oldAt = System.now().addMinutes(-10);
        insert new Housie_Ticket_Command__c(
            Request_Key__c = requestKey,
            Account_Key__c = HousieIds.stableId('TEST_ACCOUNT', 'finalizer-failure'),
            Board_Id__c = HousieIds.stableId('TEST_BOARD', 'finalizer-failure'),
            Game_Id__c = gameId,
            Action_Type__c = 'PURCHASE',
            Ticket_Id__c = HousieIds.stableId('TEST_TICKET', 'finalizer-failure'),
            Hold_Id__c = HousieIds.stableId('TEST_HOLD', 'finalizer-failure'),
            Mode__c = 'MANUAL',
            Entry_Fee__c = 10,
            Layout__c = '[]',
            Status__c = 'PREPARED',
            Recovery_Status__c = 'FINALIZING',
            Recovery_Attempts__c = 1,
            Recovery_Finalization_Attempts__c = 1,
            Recovery_Last_Attempt_At__c = oldAt,
            Created_At__c = oldAt,
            Updated_At__c = oldAt
        );

        Test.startTest();
        System.enqueueJob(new HousieTicketCommandFinalizeQueueable(
            new Map<String,String>{requestKey => HousieIds.stableId('TEST_ACCOUNT', 'finalizer-failure')}
        ));
        Test.stopTest();

        Housie_Ticket_Command__c retried = [
            SELECT Recovery_Status__c, Recovery_Error__c
            FROM Housie_Ticket_Command__c
            WHERE Request_Key__c = :requestKey
            LIMIT 1
        ];
        System.assertEquals('READY', retried.Recovery_Status__c);
        System.assert(retried.Recovery_Error__c.contains('Infrastructure lock'));
    }

    @IsTest
    static void staleGateWithoutCommandRemainsClosed() {
        String gameId = HousieIds.stableId('TEST_GAME', 'orphan-gate');
        Datetime oldAt = System.now().addMinutes(-10);
        insert new Housie_Game_Command_Lock__c(
            Game_Id__c = gameId,
            Status__c = 'PROCESSING',
            Active_Command_Key__c = HousieIds.stableId('TEST_COMMAND', 'deleted-command'),
            Created_At__c = oldAt,
            Updated_At__c = oldAt
        );

        Test.startTest();
        HousieRecoveryService.dispatch();
        Test.stopTest();

        Housie_Game_Command_Lock__c quarantinedGate = [
            SELECT Status__c, Active_Command_Key__c
            FROM Housie_Game_Command_Lock__c
            WHERE Game_Id__c = :gameId
            LIMIT 1
        ];
        System.assertEquals('QUARANTINED', quarantinedGate.Status__c);
        System.assertNotEquals(null, quarantinedGate.Active_Command_Key__c);
    }

    @IsTest
    static void staleBoundaryIsDeterministic() {
        Datetime nowAt = Datetime.newInstanceGmt(2026, 11, 4, 12, 0, 0);
        System.assertEquals(true,
            HousieRecoveryService.isStale(nowAt.addMinutes(-2), nowAt));
        System.assertEquals(false,
            HousieRecoveryService.isStale(nowAt.addMinutes(-1), nowAt));
        System.assertEquals(false,
            HousieRecoveryService.isStale(null, nowAt));
    }
}
