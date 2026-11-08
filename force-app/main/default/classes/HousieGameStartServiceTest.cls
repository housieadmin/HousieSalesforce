@IsTest
private class HousieGameStartServiceTest {
    private static Game_Action_Response__b response(String accountId, String role, String decision) {
        Game_Action_Response__b row = new Game_Action_Response__b();
        row.Account_Id__c = accountId;
        row.Eligibility_Role__c = role;
        row.Response__c = decision;
        return row;
    }

    @IsTest
    static void gameAdminRequesterNeedsDistinctNonAdminApproval() {
        List<Game_Action_Response__b> rows = new List<Game_Action_Response__b>{
            response('ADMIN-1', 'ADMIN', 'APPROVE'),
            response('PLAYER-2', 'NON_ADMIN', 'APPROVE')
        };
        System.assertEquals(true,
            HousieGameStartService.approvalThreshold('ADMIN-1', 'ADMIN', rows));
    }

    @IsTest
    static void nonAdminRequesterNeedsAdminApproval() {
        List<Game_Action_Response__b> rows = new List<Game_Action_Response__b>{
            response('PLAYER-1', 'NON_ADMIN', 'APPROVE'),
            response('ADMIN-2', 'ADMIN', 'APPROVE')
        };
        System.assertEquals(true,
            HousieGameStartService.approvalThreshold('PLAYER-1', 'NON_ADMIN', rows));
    }

    @IsTest
    static void requesterCannotApproveTwice() {
        List<Game_Action_Response__b> rows = new List<Game_Action_Response__b>{
            response('PLAYER-1', 'ADMIN', 'APPROVE')
        };
        System.assertEquals(false,
            HousieGameStartService.approvalThreshold('PLAYER-1', 'NON_ADMIN', rows));
    }

    @IsTest
    static void rejectedOrWrongRoleDoesNotSatisfyThreshold() {
        List<Game_Action_Response__b> rows = new List<Game_Action_Response__b>{
            response('PLAYER-2', 'NON_ADMIN', 'REJECT'),
            response('PLAYER-3', 'NON_ADMIN', 'APPROVE')
        };
        System.assertEquals(false,
            HousieGameStartService.approvalThreshold('ADMIN-1', 'ADMIN', rows));
    }

    @IsTest
    static void nonParticipatingBoardAdminNeedsBothEligibleRoles() {
        List<Game_Action_Response__b> rows = new List<Game_Action_Response__b>{
            response('ADMIN-2', 'ADMIN', 'APPROVE')
        };
        System.assertEquals(false,
            HousieGameStartService.approvalThreshold('BOARD-OWNER', 'INITIATOR_ONLY', rows));
        rows.add(response('PLAYER-3', 'NON_ADMIN', 'APPROVE'));
        System.assertEquals(true,
            HousieGameStartService.approvalThreshold('BOARD-OWNER', 'INITIATOR_ONLY', rows));
    }

    @IsTest
    static void adminSuccessionChoosesEarliestOnlineParticipant() {
        Datetime nowAt = System.now();
        Map<String,Decimal> sequence = new Map<String,Decimal>{
            'PLAYER-1' => 1, 'PLAYER-2' => 2, 'PLAYER-3' => 3
        };
        Map<String,Datetime> lastSeen = new Map<String,Datetime>{
            'PLAYER-1' => nowAt.addSeconds(-120),
            'PLAYER-2' => nowAt.addSeconds(-20),
            'PLAYER-3' => nowAt
        };
        Set<String> active = new Set<String>{'PLAYER-1','PLAYER-2','PLAYER-3'};
        System.assertEquals('PLAYER-2',
            HousieGameStartService.selectAvailableAdmin(sequence, lastSeen, active, nowAt.addSeconds(-90)));
    }

    @IsTest
    static void adminSuccessionIgnoresSuspendedOrOfflineParticipants() {
        Datetime nowAt = System.now();
        Map<String,Decimal> sequence = new Map<String,Decimal>{'PLAYER-1'=>1,'PLAYER-2'=>2};
        Map<String,Datetime> lastSeen = new Map<String,Datetime>{
            'PLAYER-1'=>nowAt, 'PLAYER-2'=>nowAt.addSeconds(-200)
        };
        Set<String> active = new Set<String>{'PLAYER-2'};
        System.assertEquals(null,
            HousieGameStartService.selectAvailableAdmin(sequence, lastSeen, active, nowAt.addSeconds(-90)));
    }

    @IsTest
    static void platformSuperAdminBypassesApprovals() {
        System.assertEquals(true,
            HousieGameStartService.approvalThreshold('ROOT', 'SUPER_ADMIN', new List<Game_Action_Response__b>()));
    }
}
