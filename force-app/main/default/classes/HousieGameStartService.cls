public without sharing class HousieGameStartService {
    private static final Integer BATCH_SIZE = 12;
    private static final String START_ACTION = 'START';
    private static final String START_REQUEST_COMMAND = 'START_REQUEST';
    private static final String START_EXECUTION_COMMAND = 'START_EXECUTION';

    public class ActionResult {
        @AuraEnabled public String requestId;
        @AuraEnabled public String gameId;
        @AuraEnabled public String status;
        @AuraEnabled public String message;
        @AuraEnabled public String approvalRole;
        @AuraEnabled public Boolean readyToExecute;
        @AuraEnabled public Integer approvedCount;
        @AuraEnabled public Integer nextCursor;
        @AuraEnabled public Boolean complete;
    }
    public class StartRequestView {
        @AuraEnabled public String requestId;
        @AuraEnabled public String gameId;
        @AuraEnabled public String boardId;
        @AuraEnabled public Integer nextCursor;
        @AuraEnabled public Boolean readyToExecute;
        @AuraEnabled public String actionType;
        @AuraEnabled public String requesterAccountId;
        @AuraEnabled public Datetime createdAt;
        @AuraEnabled public Datetime expiresAt;
        @AuraEnabled public String status;
        @AuraEnabled public String requesterRole;
        @AuraEnabled public Boolean canApprove;
        @AuraEnabled public Boolean canExecute;
        @AuraEnabled public String currentUserResponse;
        @AuraEnabled public Integer approvedCount;
    }
    private class GameContext {
        Board__b boardRow;
        Game__b gameRow;
        Map<String,Object> config;
    }
    private class Participant {
        String accountId;
        Decimal joinSequence;
        Datetime joinedAt;
    }
    private class StartFundingPlan {
        List<Object> holds = new List<Object>();
        Map<String,Decimal> accountTotals = new Map<String,Decimal>();
        Decimal total = 0;
        String gameAdminId;
    }

    @AuraEnabled
    public static Datetime recordPresence(String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        List<Housie_Account__c> rows = [
            SELECT Id, Last_Seen_At__c, Status__c
            FROM Housie_Account__c WHERE Id = :actor.Id LIMIT 1
        ];
        HousieErrors.require(!rows.isEmpty() && rows[0].Status__c == 'ACTIVE',
            'An active Housie account is required to update presence.');
        Datetime nowAt = System.now();
        if (rows[0].Last_Seen_At__c == null || rows[0].Last_Seen_At__c < nowAt.addSeconds(-15)) {
            rows[0].Last_Seen_At__c = nowAt;
            update rows[0];
        }
        return nowAt;
    }

    @AuraEnabled
    public static ActionResult prepareStartRequest(String boardId, String accountId, String clientRequestId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        HousieErrors.require(String.isNotBlank(clientRequestId) && clientRequestId.length() <= 120,
            'A valid start request id is required.');
        GameContext context = loadCurrentGame(boardId);
        HousieErrors.require(context.gameRow.Status__c == 'WAITING', 'Only a waiting game can be started.');
        if (!HousieSecurity.isSuperAdmin(actor)) requireBoardMember(boardId, actor.Account_Key__c);

        Map<String,Participant> participants = loadActiveParticipants(context.gameRow.Record_Id__c);
        Integer minimum = integerConfig(context.config, 'minimumHumanParticipants', 2);
        HousieErrors.require(participants.size() >= minimum,
            'At least ' + minimum + ' distinct human participants with paid tickets are required.');
        String gameAdminId = findAvailableGameAdmin(participants, integerConfig(context.config, 'adminOfflineGraceSeconds', 90));
        HousieErrors.require(String.isNotBlank(gameAdminId), 'An eligible game admin must be available before starting.');

        String requesterRole = resolveRequesterRole(boardId, actor.Account_Key__c, participants, gameAdminId, false);
        HousieErrors.require(HousieSecurity.isSuperAdmin(actor) ||
            requesterRole == 'ADMIN' || requesterRole == 'NON_ADMIN' || requesterRole == 'INITIATOR_ONLY',
            'Only an authorized board admin or game participant can request a start.');
        if (HousieSecurity.isSuperAdmin(actor)) requesterRole = 'SUPER_ADMIN';

        String requestId = HousieIds.stableId('START_REQUEST',
            context.gameRow.Record_Id__c + ':' + actor.Account_Key__c + ':' + clientRequestId);
        String commandKey = HousieIds.stableId('START_COMMAND', requestId);
        Housie_Ticket_Command__c prior = findCommand(commandKey);
        if (prior != null) return commandResult(prior);

        Housie_Game_Command_Lock__c gate = lockGameCommandSlot(context.gameRow.Record_Id__c);
        HousieErrors.require(gate == null || gate.Status__c != 'PROCESSING',
            'Another game command is being finalized. Retry shortly.');
        List<Game_Action_Request__b> openRequests = findActionRequests(context.gameRow.Record_Id__c, 'OPEN');
        for (Game_Action_Request__b openRequest : openRequests) {
            if (openRequest.Action_Type__c == START_ACTION &&
                openRequest.Expires_At__c != null && openRequest.Expires_At__c > System.now()) {
                HousieErrors.require(false, 'A start request is already open for this game.');
            }
        }

        Datetime nowAt = System.now();
        Integer expirySeconds = integerConfig(context.config, 'startPauseResumeRequestExpirySeconds', 60);
        Datetime expiresAt = nowAt.addSeconds(expirySeconds);
        Map<String,Object> requestRules = new Map<String,Object>{
            'requesterRole' => requesterRole,
            'minimumHumanParticipants' => minimum,
            'requiredRoles' => new List<String>{'ADMIN','NON_ADMIN'}
        };
        activateGameCommandLock(gate, context.gameRow.Record_Id__c, commandKey);
        Housie_Ticket_Command__c command = new Housie_Ticket_Command__c(
            Request_Key__c = commandKey,
            Account_Key__c = actor.Account_Key__c,
            Board_Id__c = boardId,
            Game_Id__c = context.gameRow.Record_Id__c,
            Action_Type__c = START_REQUEST_COMMAND,
            Ticket_Id__c = requestId,
            Payload__c = JSON.serialize(new Map<String,Object>{
                'requestId' => requestId,
                'requesterRole' => requesterRole,
                'expiresAt' => expiresAt
            }),
            Status__c = 'PREPARED',
            Created_At__c = nowAt,
            Updated_At__c = nowAt
        );
        insert command;

        ActionResult result = new ActionResult();
        result.requestId = requestId;
        result.gameId = context.gameRow.Record_Id__c;
        result.status = 'PREPARED';
        result.message = requesterRole == 'SUPER_ADMIN'
            ? 'Start request prepared for immediate platform-admin execution.'
            : 'Start request prepared. Persist it to notify eligible approvers.';
        return result;
    }

    @AuraEnabled
    public static ActionResult commitStartRequest(String requestId, String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        String commandKey = HousieIds.stableId('START_COMMAND', requestId);
        Housie_Ticket_Command__c command = requireCommand(commandKey, actor.Account_Key__c, START_REQUEST_COMMAND);
        if (command.Status__c == 'COMMITTED') return commandResult(command);
        requireGameCommandLock(command.Game_Id__c, command.Request_Key__c);

        Map<String,Object> payload = (Map<String,Object>)JSON.deserializeUntyped(command.Payload__c);
        Datetime expiresAt = (Datetime)JSON.deserialize(JSON.serialize(payload.get('expiresAt')), Datetime.class);
        Datetime createdAt = command.Created_At__c;
        Map<String,Object> rules = new Map<String,Object>{
            'requesterRole' => String.valueOf(payload.get('requesterRole')),
            'requiredRoles' => new List<String>{'ADMIN','NON_ADMIN'}
        };
        String initialStatus = String.valueOf(payload.get('requesterRole')) == 'SUPER_ADMIN'
            ? 'APPROVED' : 'OPEN';
        List<HousieOperationService.WriteItem> writes = new List<HousieOperationService.WriteItem>();
        writes.add(writeItem('Game_Action_Request__b', new Map<String,Object>{
            'Record_Id__c' => requestId,
            'Game_Id__c' => command.Game_Id__c,
            'Action_Type__c' => START_ACTION,
            'Requester_Account_Id__c' => actor.Account_Key__c,
            'Expected_Game_State__c' => 'WAITING',
            'Required_Approval_Rules__c' => JSON.serialize(rules),
            'Status__c' => initialStatus,
            'Created_At__c' => createdAt,
            'Expires_At__c' => expiresAt,
            'Closed_At__c' => initialStatus == 'APPROVED' ? System.now() : null
        }));
        HousieOperationService.executeOperation('CREATE_GAME_START_REQUEST', writes);

        ActionResult result = new ActionResult();
        result.requestId = requestId;
        result.gameId = command.Game_Id__c;
        result.status = initialStatus;
        result.readyToExecute = initialStatus == 'APPROVED';
        result.message = initialStatus == 'APPROVED'
            ? 'Platform super-admin start request is approved.'
            : 'Start request is open for the required two distinct approval roles.';
        return result;
    }

    @AuraEnabled
    public static ActionResult completeStartRequest(String requestId, String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        String commandKey = HousieIds.stableId('START_COMMAND', requestId);
        Housie_Ticket_Command__c command = requireCommand(commandKey, actor.Account_Key__c, START_REQUEST_COMMAND);
        if (command.Status__c == 'COMMITTED') return commandResult(command);
        requireGameCommandLock(command.Game_Id__c, command.Request_Key__c);
        Game_Action_Request__b requestRow = findLatestActionRequest(command.Game_Id__c, requestId);
        HousieErrors.require(requestRow != null, 'The start request Big Object record is not committed yet. Retry completion.');

        command.Status__c = 'COMMITTED';
        command.Committed_At__c = System.now();
        command.Updated_At__c = command.Committed_At__c;
        releaseGameCommandLock(command.Game_Id__c, command.Request_Key__c);
        update command;

        ActionResult result = new ActionResult();
        result.requestId = requestId;
        result.gameId = command.Game_Id__c;
        result.status = requestRow.Status__c;
        result.readyToExecute = requestRow.Status__c == 'APPROVED';
        result.message = requestRow.Status__c == 'APPROVED'
            ? 'Start request is approved and ready for execution.'
            : 'Start request is open. Eligible reviewers can now approve or reject it.';
        return result;
    }

    @AuraEnabled
    public static ActionResult respondToStartRequest(
        String boardId, String requestId, String accountId, String response
    ) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        String safeResponse = String.isBlank(response) ? '' : response.trim().toUpperCase();
        HousieErrors.require(new Set<String>{'APPROVE','REJECT'}.contains(safeResponse),
            'Response must be APPROVE or REJECT.');
        GameContext context = loadCurrentGame(boardId);
        Game_Action_Request__b requestRow = findLatestActionRequest(context.gameRow.Record_Id__c, requestId);
        HousieErrors.require(requestRow != null && requestRow.Status__c == 'OPEN',
            'This start request is no longer open.');
        HousieErrors.require(requestRow.Expires_At__c != null && requestRow.Expires_At__c > System.now(),
            'This start request has expired.');
        HousieErrors.require(requestRow.Expected_Game_State__c == context.gameRow.Status__c,
            'The game state changed. This start request is stale.');
        Map<String,Participant> participants = loadActiveParticipants(context.gameRow.Record_Id__c);
        String gameAdminId = findAvailableGameAdmin(participants, integerConfig(context.config, 'adminOfflineGraceSeconds', 90));
        String role = resolveRequesterRole(boardId, actor.Account_Key__c, participants, gameAdminId, true);
        HousieErrors.require(actor.Account_Key__c != requestRow.Requester_Account_Id__c,
            'The requester cannot submit a second response to their own start request.');
        HousieErrors.require(role == 'ADMIN' || role == 'NON_ADMIN',
            'You are not eligible to review this start request.');

        List<Game_Action_Response__b> existing = [
            SELECT Record_Id__c, Response__c, Eligibility_Role__c, Operation_Id__c
            FROM Game_Action_Response__b
            WHERE Request_Id__c = :requestId AND Account_Id__c = :actor.Account_Key__c
            LIMIT 20
        ];
        Set<String> existingOps = new Set<String>();
        for (Game_Action_Response__b priorResponse : existing) existingOps.add(priorResponse.Operation_Id__c);
        Set<String> committedExistingOps = HousieBigObjectStore.committedOperationIds(existingOps);
        Boolean alreadyResponded = false;
        for (Game_Action_Response__b priorResponse : existing) {
            if (committedExistingOps.contains(priorResponse.Operation_Id__c)) alreadyResponded = true;
        }
        HousieErrors.require(!alreadyResponded, 'You have already responded to this start request.');

        String responseId = HousieIds.stableId('START_RESPONSE', requestId + ':' + actor.Account_Key__c);
        List<HousieOperationService.WriteItem> writes = new List<HousieOperationService.WriteItem>();
        writes.add(writeItem('Game_Action_Response__b', new Map<String,Object>{
            'Record_Id__c' => responseId,
            'Request_Id__c' => requestId,
            'Account_Id__c' => actor.Account_Key__c,
            'Response__c' => safeResponse,
            'Eligibility_Role__c' => role,
            'Eligibility_Snapshot__c' => JSON.serialize(new Map<String,Object>{
                'isGameAdmin' => actor.Account_Key__c == gameAdminId,
                'isParticipant' => participants.containsKey(actor.Account_Key__c)
            }),
            'Created_At__c' => System.now(),
            'Responded_At__c' => System.now()
        }));
        HousieOperationService.executeOperation('RESPOND_TO_GAME_START_REQUEST', writes);

        List<Game_Action_Response__b> responses = [
            SELECT Record_Id__c, Account_Id__c, Response__c, Eligibility_Role__c, Operation_Id__c
            FROM Game_Action_Response__b
            WHERE Request_Id__c = :requestId
            LIMIT 200
        ];
        Set<String> operationIds = new Set<String>();
        for (Game_Action_Response__b item : responses) operationIds.add(item.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operationIds);
        List<Game_Action_Response__b> committedResponses = new List<Game_Action_Response__b>();
        for (Game_Action_Response__b item : responses) {
            if (committed.contains(item.Operation_Id__c)) committedResponses.add(item);
        }
        Map<String,Object> rules = (Map<String,Object>)JSON.deserializeUntyped(requestRow.Required_Approval_Rules__c);
        String requesterRole = String.valueOf(rules.get('requesterRole'));
        Boolean ready = requesterRole == 'SUPER_ADMIN' || approvalThreshold(requestRow.Requester_Account_Id__c,
            requesterRole, committedResponses);
        Integer approved = 0;
        for (Game_Action_Response__b item : committedResponses) if (item.Response__c == 'APPROVE') approved++;

        ActionResult result = new ActionResult();
        result.requestId = requestId;
        result.gameId = context.gameRow.Record_Id__c;
        result.status = ready ? 'READY_TO_EXECUTE' : 'OPEN';
        result.approvalRole = role;
        result.approvedCount = approved + (requesterRole == 'INITIATOR_ONLY' ? 0 : 1);
        result.readyToExecute = ready;
        result.message = ready
            ? 'The two distinct approval roles are satisfied. The start can now be executed.'
            : 'Response recorded. The request remains open until its required approval roles are satisfied or it expires.';
        return result;
    }

    @AuraEnabled
    public static List<StartRequestView> listOpenStartRequests(String boardId, String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        GameContext context = loadCurrentGame(boardId);
        Map<String,Participant> participants = loadActiveParticipants(context.gameRow.Record_Id__c);
        String gameAdminId = findAvailableGameAdmin(participants, integerConfig(context.config, 'adminOfflineGraceSeconds', 90));
        String role = resolveRequesterRole(boardId, actor.Account_Key__c, participants, gameAdminId, true);
        List<Game_Action_Request__b> rows = findActionRequests(context.gameRow.Record_Id__c, 'OPEN');
        rows.addAll(findActionRequests(context.gameRow.Record_Id__c, 'APPROVED'));
        List<StartRequestView> result = new List<StartRequestView>();
        Set<String> requestIds = new Set<String>();
        for (Game_Action_Request__b row : rows) {
            if (row.Action_Type__c == START_ACTION && row.Expected_Game_State__c == 'WAITING' &&
                row.Expires_At__c != null && row.Expires_At__c > System.now() &&
                (row.Status__c == 'OPEN' || (row.Status__c == 'APPROVED' && row.Executed_At__c == null))) {
                requestIds.add(row.Record_Id__c);
            }
        }
        if (requestIds.isEmpty()) return result;
        List<Game_Action_Response__b> responseRows = [
            SELECT Record_Id__c, Request_Id__c, Account_Id__c, Response__c,
                   Eligibility_Role__c, Operation_Id__c
            FROM Game_Action_Response__b
            WHERE Request_Id__c IN :requestIds
            LIMIT 2000
        ];
        Set<String> operationIds = new Set<String>();
        for (Game_Action_Response__b row : responseRows) operationIds.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operationIds);
        Map<String,List<Game_Action_Response__b>> byRequest = new Map<String,List<Game_Action_Response__b>>();
        for (Game_Action_Response__b row : responseRows) {
            if (!committed.contains(row.Operation_Id__c)) continue;
            if (!byRequest.containsKey(row.Request_Id__c)) byRequest.put(row.Request_Id__c, new List<Game_Action_Response__b>());
            byRequest.get(row.Request_Id__c).add(row);
        }
        for (Game_Action_Request__b row : rows) {
            if (!requestIds.contains(row.Record_Id__c)) continue;
            Map<String,Object> rules = (Map<String,Object>)JSON.deserializeUntyped(row.Required_Approval_Rules__c);
            String requesterRole = String.valueOf(rules.get('requesterRole'));
            List<Game_Action_Response__b> responses = byRequest.containsKey(row.Record_Id__c)
                ? byRequest.get(row.Record_Id__c) : new List<Game_Action_Response__b>();
            Boolean ready = requesterRole == 'SUPER_ADMIN' ||
                approvalThreshold(row.Requester_Account_Id__c, requesterRole, responses);
            StartRequestView view = new StartRequestView();
            view.requestId = row.Record_Id__c;
            view.gameId = row.Game_Id__c;
            view.boardId = boardId;
            view.actionType = row.Action_Type__c;
            view.requesterAccountId = row.Requester_Account_Id__c;
            view.createdAt = row.Created_At__c;
            view.expiresAt = row.Expires_At__c;
            view.status = row.Status__c;
            view.requesterRole = requesterRole;
            view.canApprove = row.Status__c == 'OPEN' && (role == 'ADMIN' || role == 'NON_ADMIN');
            view.canExecute = ready && (requesterRole == 'SUPER_ADMIN'
                ? HousieSecurity.isSuperAdmin(actor)
                : (HousieSecurity.isSuperAdmin(actor) || role == 'ADMIN' || role == 'NON_ADMIN'));
            view.readyToExecute = ready;
            view.approvedCount = requesterRole == 'SUPER_ADMIN' ? 2 :
                (requesterRole == 'INITIATOR_ONLY' ? 0 : 1);
            for (Game_Action_Response__b responseRow : responses) {
                if (responseRow.Account_Id__c == actor.Account_Key__c) view.currentUserResponse = responseRow.Response__c;
                if (responseRow.Response__c == 'APPROVE') view.approvedCount++;
            }
            result.add(view);
        }
        return result;
    }

    @AuraEnabled
    public static List<StartRequestView> listPendingStartRequests(String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        List<Housie_Ticket_Command__c> commands = [
            SELECT Ticket_Id__c, Board_Id__c, Game_Id__c, Status__c
            FROM Housie_Ticket_Command__c
            WHERE Account_Key__c = :actor.Account_Key__c
              AND Action_Type__c = :START_REQUEST_COMMAND
              AND Status__c = 'PREPARED'
            ORDER BY Created_At__c ASC LIMIT 100
        ];
        List<StartRequestView> result = new List<StartRequestView>();
        for (Housie_Ticket_Command__c command : commands) {
            StartRequestView view = new StartRequestView();
            view.requestId = command.Ticket_Id__c;
            view.gameId = command.Game_Id__c;
            view.boardId = command.Board_Id__c;
            view.status = command.Status__c;
            result.add(view);
        }
        return result;
    }

    @AuraEnabled
    public static List<StartRequestView> listPendingStartExecutions(String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        List<Housie_Ticket_Command__c> commands = [
            SELECT Request_Key__c, Ticket_Id__c, Board_Id__c, Game_Id__c,
                   Status__c, Payload__c, Updated_At__c
            FROM Housie_Ticket_Command__c
            WHERE Account_Key__c = :actor.Account_Key__c
              AND Action_Type__c = :START_EXECUTION_COMMAND
              AND Status__c IN ('PREPARED','CAPTURED')
            ORDER BY Updated_At__c ASC LIMIT 100
        ];
        List<StartRequestView> result = new List<StartRequestView>();
        for (Housie_Ticket_Command__c command : commands) {
            Map<String,Object> payload = (Map<String,Object>)JSON.deserializeUntyped(command.Payload__c);
            StartRequestView view = new StartRequestView();
            view.requestId = command.Ticket_Id__c;
            view.gameId = command.Game_Id__c;
            view.boardId = command.Board_Id__c;
            view.status = command.Status__c;
            view.nextCursor = Integer.valueOf(String.valueOf(payload.get('cursor')));
            view.readyToExecute = command.Status__c == 'CAPTURED';
            result.add(view);
        }
        return result;
    }

    @AuraEnabled
    public static ActionResult prepareStartExecution(String boardId, String requestId, String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        String commandKey = HousieIds.stableId('START_EXECUTION', requestId);
        Housie_Ticket_Command__c prior = findCommand(commandKey);
        if (prior != null) {
            HousieErrors.require(prior.Account_Key__c == actor.Account_Key__c &&
                prior.Action_Type__c == START_EXECUTION_COMMAND,
                'A start execution command exists for a different account.');
            return commandResult(prior);
        }
        GameContext context = loadCurrentGame(boardId);
        HousieErrors.require(context.gameRow.Status__c == 'WAITING', 'Only a waiting game can be started.');
        Game_Action_Request__b requestRow = findLatestActionRequest(context.gameRow.Record_Id__c, requestId);
        HousieErrors.require(requestRow != null &&
            new Set<String>{'OPEN','APPROVED'}.contains(requestRow.Status__c) &&
            requestRow.Expires_At__c != null && requestRow.Expires_At__c > System.now(),
            'The start request is missing, closed, or expired.');
        Map<String,Object> rules = (Map<String,Object>)JSON.deserializeUntyped(requestRow.Required_Approval_Rules__c);
        String requesterRole = String.valueOf(rules.get('requesterRole'));
        List<Game_Action_Response__b> responses = [
            SELECT Record_Id__c, Account_Id__c, Response__c, Eligibility_Role__c, Operation_Id__c
            FROM Game_Action_Response__b
            WHERE Request_Id__c = :requestId
            LIMIT 200
        ];
        Set<String> responseOps = new Set<String>();
        for (Game_Action_Response__b responseRow : responses) responseOps.add(responseRow.Operation_Id__c);
        Set<String> committedOps = HousieBigObjectStore.committedOperationIds(responseOps);
        List<Game_Action_Response__b> committedResponses = new List<Game_Action_Response__b>();
        for (Game_Action_Response__b responseRow : responses) {
            if (committedOps.contains(responseRow.Operation_Id__c)) committedResponses.add(responseRow);
        }
        HousieErrors.require(requesterRole != 'SUPER_ADMIN' || HousieSecurity.isSuperAdmin(actor),
            'Only a platform super-admin can execute a platform super-admin start request.');
        HousieErrors.require(HousieSecurity.isSuperAdmin(actor) ||
            approvalThreshold(requestRow.Requester_Account_Id__c, requesterRole, committedResponses),
            'The start request does not yet have the two required distinct approvals.');

        Map<String,Participant> participants = loadActiveParticipants(context.gameRow.Record_Id__c);
        String executorRole = resolveRequesterRole(boardId, actor.Account_Key__c, participants,
            findAvailableGameAdmin(participants, integerConfig(context.config, 'adminOfflineGraceSeconds', 90)), true);
        HousieErrors.require(HousieSecurity.isSuperAdmin(actor) ||
            executorRole == 'ADMIN' || executorRole == 'NON_ADMIN',
            'Only a game participant, participating board admin, or platform super-admin can execute an approved start.');
        if (requesterRole != 'SUPER_ADMIN') {
            String currentRequesterRole = resolveRequesterRole(boardId, requestRow.Requester_Account_Id__c,
                participants, findAvailableGameAdmin(participants, integerConfig(context.config, 'adminOfflineGraceSeconds', 90)), false);
            HousieErrors.require(currentRequesterRole == requesterRole,
                'The start requester no longer holds the role that was used to approve this request.');
        }
        Integer minimum = integerConfig(context.config, 'minimumHumanParticipants', 2);
        HousieErrors.require(participants.size() >= minimum,
            'The game no longer meets minimum human participation.');
        String gameAdminId = findAvailableGameAdmin(participants, integerConfig(context.config, 'adminOfflineGraceSeconds', 90));
        HousieErrors.require(String.isNotBlank(gameAdminId), 'An eligible game admin is not available.');

        Housie_Game_Command_Lock__c gate = lockGameCommandSlot(context.gameRow.Record_Id__c);
        HousieErrors.require(gate == null || gate.Status__c != 'PROCESSING',
            'Another game command is being finalized. Retry shortly.');

        // Re-read after acquiring the per-game gate so the funding snapshot includes
        // every committed purchase/withdrawal that won the race before this command.
        context = loadCurrentGame(boardId);
        HousieErrors.require(context.gameRow.Status__c == 'WAITING',
            'The game is no longer waiting.');
        participants = loadActiveParticipants(context.gameRow.Record_Id__c);
        HousieErrors.require(participants.size() >= minimum,
            'The game no longer meets minimum human participation.');
        gameAdminId = findAvailableGameAdmin(participants, integerConfig(context.config, 'adminOfflineGraceSeconds', 90));
        HousieErrors.require(String.isNotBlank(gameAdminId), 'An eligible game admin is not available.');
        executorRole = resolveRequesterRole(boardId, actor.Account_Key__c, participants, gameAdminId, true);
        HousieErrors.require(HousieSecurity.isSuperAdmin(actor) ||
            executorRole == 'ADMIN' || executorRole == 'NON_ADMIN',
            'Only a game participant, participating board admin, or platform super-admin can execute an approved start.');
        if (requesterRole != 'SUPER_ADMIN') {
            String currentRequesterRole = resolveRequesterRole(boardId, requestRow.Requester_Account_Id__c,
                participants, gameAdminId, false);
            HousieErrors.require(currentRequesterRole == requesterRole,
                'The start requester no longer holds the role that was used to approve this request.');
        }
        StartFundingPlan fundingPlan = buildStartFundingPlan(context, participants);
        Decimal nextEventSequence = (context.gameRow.Event_Sequence__c == null
            ? 0 : context.gameRow.Event_Sequence__c) + 1;
        Map<String,Object> payload = new Map<String,Object>{
            'requestId' => requestId,
            'cursor' => 0,
            'ticketCount' => fundingPlan.holds.size(),
            'total' => fundingPlan.total,
            'currentAdmin' => fundingPlan.gameAdminId,
            'eventSequence' => nextEventSequence
        };
        Datetime nowAt = System.now();
        activateGameCommandLock(gate, context.gameRow.Record_Id__c, commandKey);
        Housie_Ticket_Command__c command = new Housie_Ticket_Command__c(
            Request_Key__c = commandKey,
            Account_Key__c = actor.Account_Key__c,
            Board_Id__c = boardId,
            Game_Id__c = context.gameRow.Record_Id__c,
            Action_Type__c = START_EXECUTION_COMMAND,
            Ticket_Id__c = requestId,
            Entry_Fee__c = fundingPlan.total,
            Payload__c = JSON.serialize(payload),
            Status__c = 'PREPARED',
            Created_At__c = nowAt,
            Updated_At__c = nowAt
        );
        insert command;

        ActionResult result = new ActionResult();
        result.requestId = requestId;
        result.gameId = context.gameRow.Record_Id__c;
        result.status = 'PREPARED';
        result.message = 'Start execution is prepared. Capture batches can now be committed.';
        result.nextCursor = 0;
        result.complete = false;
        return result;
    }

    @AuraEnabled
    public static ActionResult commitStartExecutionBatch(String requestId, String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        String commandKey = HousieIds.stableId('START_EXECUTION', requestId);
        Housie_Ticket_Command__c command = requireCommand(commandKey, actor.Account_Key__c, START_EXECUTION_COMMAND);
        if (command.Status__c == 'COMMITTED' || command.Status__c == 'CAPTURED') {
            ActionResult priorResult = new ActionResult();
            priorResult.requestId = requestId; priorResult.gameId = command.Game_Id__c;
            priorResult.status = command.Status__c; priorResult.complete = command.Status__c == 'COMMITTED';
            priorResult.readyToExecute = command.Status__c == 'CAPTURED';
            priorResult.message = command.Status__c == 'COMMITTED'
                ? 'Game start is already finalized.' : 'Funding is captured. Final game activation is pending.';
            return priorResult;
        }
        HousieErrors.require(command.Status__c == 'PREPARED', 'Start execution is not in a resumable state.');
        requireGameCommandLock(command.Game_Id__c, command.Request_Key__c);
        Map<String,Object> payload = (Map<String,Object>)JSON.deserializeUntyped(command.Payload__c);
        Integer cursor = Integer.valueOf(String.valueOf(payload.get('cursor')));
        GameContext context = loadCurrentGame(command.Board_Id__c);
        HousieErrors.require(context.gameRow.Status__c == 'WAITING',
            'The game is no longer waiting. Start execution cannot continue.');
        Map<String,Participant> participants = loadActiveParticipants(command.Game_Id__c);
        StartFundingPlan plan = buildStartFundingPlan(context, participants);
        List<Object> holds = plan.holds;
        HousieErrors.require(holds.size() == Integer.valueOf(String.valueOf(payload.get('ticketCount'))) &&
            plan.total == command.Entry_Fee__c,
            'The committed funding plan changed. Stop and review the pending start command.');
        Integer nextCursor = Math.min(cursor + BATCH_SIZE, holds.size());
        Boolean finalBatch = nextCursor == holds.size();
        List<HousieOperationService.WriteItem> writes = new List<HousieOperationService.WriteItem>();
        for (Integer i = cursor; i < nextCursor; i++) {
            Map<String,Object> item = (Map<String,Object>)holds[i];
            String holdId = String.valueOf(item.get('holdId'));
            String account = String.valueOf(item.get('accountId'));
            String ticketId = String.valueOf(item.get('ticketId'));
            Decimal amount = Decimal.valueOf(String.valueOf(item.get('amount')));
            Datetime createdAt = (Datetime)JSON.deserialize(JSON.serialize(item.get('createdAt')), Datetime.class);
            Datetime nowAt = System.now();
            writes.add(writeItem('Wallet_Hold__b', new Map<String,Object>{
                'Record_Id__c' => HousieIds.stableId('HOLD_CAPTURE', holdId),
                'Hold_Id__c' => holdId,
                'Account_Id__c' => account,
                'Game_Id__c' => command.Game_Id__c,
                'Source_Type__c' => 'HUMAN_TICKET',
                'Source_Id__c' => ticketId,
                'Amount__c' => amount,
                'Status__c' => 'CAPTURED',
                'Created_At__c' => createdAt,
                'Updated_At__c' => nowAt,
                'Captured_At__c' => nowAt
            }));
            writes.add(writeItem('Game_Ledger__b', new Map<String,Object>{
                'Record_Id__c' => HousieIds.stableId('GAME_CAPTURE', holdId),
                'Game_Id__c' => command.Game_Id__c,
                'Account_Id__c' => account,
                'Entry_Type__c' => 'TICKET_CAPTURED',
                'Amount__c' => amount,
                'Ticket_Id__c' => ticketId,
                'Source_Type__c' => 'HUMAN_TICKET',
                'Source_Id__c' => ticketId,
                'Idempotency_Key__c' => HousieIds.stableId('GAME_CAPTURE', holdId),
                'Created_At__c' => System.now(),
                'Metadata__c' => '{}'
            }));
            writes.add(writeItem('Account_Resource_Transaction__b', new Map<String,Object>{
                'Record_Id__c' => HousieIds.stableId('RESOURCE_TX', 'TICKET_HOLD_CAPTURE:' + holdId),
                'Account_Id__c' => account,
                'Resource_Type__c' => 'POINTS',
                'Transaction_Type__c' => 'HOLD_CAPTURE',
                'Quantity__c' => -amount,
                'Source_Type__c' => 'HUMAN_TICKET',
                'Source_Id__c' => ticketId,
                'Idempotency_Key__c' => HousieIds.stableId('RESOURCE_TX', 'TICKET_HOLD_CAPTURE:' + holdId),
                'Created_At__c' => System.now(),
                'Metadata__c' => JSON.serialize(new Map<String,Object>{
                    'gameId' => command.Game_Id__c, 'holdId' => holdId
                })
            }));
        }
        if (finalBatch) {
            Decimal fundedSequence = Decimal.valueOf(String.valueOf(payload.get('eventSequence')));
            HousieErrors.require(context.gameRow.Event_Sequence__c == null ||
                context.gameRow.Event_Sequence__c == fundedSequence - 1 ||
                context.gameRow.Event_Sequence__c == fundedSequence,
                'The game event sequence changed during funding capture.');
            Datetime fundingCapturedAt = System.now();
            Decimal total = Decimal.valueOf(String.valueOf(payload.get('total')));
            String adminId = String.valueOf(payload.get('currentAdmin'));
            writes.add(writeItem('Game__b', new Map<String,Object>{
                'Record_Id__c' => command.Game_Id__c,
                'Board_Id__c' => command.Board_Id__c,
                'Status__c' => 'WAITING',
                'Config_Snapshot__c' => context.gameRow.Config_Snapshot__c,
                'Event_Sequence__c' => fundedSequence,
                'Current_Admin_Account_Id__c' => adminId,
                'Wallet_Total__c' => total,
                'Wallet_Obligations__c' => 0,
                'Wallet_Available__c' => total,
                'Created_At__c' => context.gameRow.Created_At__c,
                'Started_At__c' => null
            }));
            writes.add(writeItem('Game_Event__b', new Map<String,Object>{
                'Record_Id__c' => HousieIds.stableId('GAME_STARTED', command.Game_Id__c),
                'Game_Id__c' => command.Game_Id__c,
                'Sequence__c' => fundedSequence,
                'Event_Type__c' => 'GAME_START_FUNDING_CAPTURED',
                'Actor_Account_Id__c' => actor.Account_Key__c,
                'Payload__c' => JSON.serialize(new Map<String,Object>{
                    'requestId' => requestId, 'adminCandidateAtPrepare' => adminId,
                    'participantCount' => plan.accountTotals.size(),
                    'ticketCount' => holds.size(), 'walletTotal' => total
                }),
                'Created_At__c' => fundingCapturedAt
            }));
        }
        HousieOperationService.executeOperation('CAPTURE_GAME_START_FUNDING', writes);
        ActionResult result = new ActionResult();
        result.requestId = requestId; result.gameId = command.Game_Id__c;
        result.status = 'PERSISTED'; result.nextCursor = nextCursor;
        result.complete = finalBatch;
        result.message = finalBatch
            ? 'All ticket hold capture records are persisted. Finalize the account wallet capture.'
            : 'Funding batch persisted. Finalize this batch before continuing.';
        return result;
    }

    @AuraEnabled
    public static ActionResult completeStartExecutionBatch(String requestId, String accountId, Integer nextCursor) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        String commandKey = HousieIds.stableId('START_EXECUTION', requestId);
        List<Housie_Ticket_Command__c> commands = [
            SELECT Id, Request_Key__c, Account_Key__c, Board_Id__c, Game_Id__c,
                   Action_Type__c, Payload__c, Status__c, Entry_Fee__c
            FROM Housie_Ticket_Command__c
            WHERE Request_Key__c = :commandKey AND Account_Key__c = :actor.Account_Key__c
            LIMIT 1 FOR UPDATE
        ];
        HousieErrors.require(!commands.isEmpty(), 'Prepared start execution not found.');
        Housie_Ticket_Command__c command = commands[0];
        if (command.Status__c == 'COMMITTED' || command.Status__c == 'CAPTURED') {
            ActionResult done = new ActionResult();
            done.requestId = requestId; done.gameId = command.Game_Id__c;
            done.status = command.Status__c; done.complete = command.Status__c == 'COMMITTED';
            done.readyToExecute = command.Status__c == 'CAPTURED';
            done.message = command.Status__c == 'COMMITTED'
                ? 'Game start is already finalized.' : 'Funding capture is already finalized; activate the game next.';
            return done;
        }
        requireGameCommandLock(command.Game_Id__c, command.Request_Key__c);
        Map<String,Object> payload = (Map<String,Object>)JSON.deserializeUntyped(command.Payload__c);
        Integer cursor = Integer.valueOf(String.valueOf(payload.get('cursor')));
        GameContext context = loadCurrentGame(command.Board_Id__c);
        Map<String,Participant> participants = loadActiveParticipants(command.Game_Id__c);
        StartFundingPlan plan = buildStartFundingPlan(context, participants);
        List<Object> holds = plan.holds;
        HousieErrors.require(holds.size() == Integer.valueOf(String.valueOf(payload.get('ticketCount'))) &&
            plan.total == command.Entry_Fee__c,
            'The committed funding plan changed. Stop and review the pending start command.');
        Integer expectedNext = Math.min(cursor + BATCH_SIZE, holds.size());
        if (nextCursor != null && nextCursor == cursor) {
            ActionResult alreadyApplied = new ActionResult();
            alreadyApplied.requestId = requestId; alreadyApplied.gameId = command.Game_Id__c;
            alreadyApplied.status = command.Status__c; alreadyApplied.nextCursor = cursor;
            alreadyApplied.message = 'This funding batch was already finalized.';
            return alreadyApplied;
        }
        HousieErrors.require(nextCursor != null && nextCursor == expectedNext,
            'The start batch cursor is stale. Refresh the pending action and retry.');
        verifyCapturedHolds(command.Game_Id__c, holds, cursor, expectedNext);

        payload.put('cursor', nextCursor);
        Boolean finalBatch = nextCursor == holds.size();
        if (finalBatch) {
            verifyPreparedGame(command.Board_Id__c, command.Game_Id__c,
                Decimal.valueOf(String.valueOf(payload.get('eventSequence'))));
            Set<String> accountIds = plan.accountTotals.keySet();
            List<Housie_Account__c> accounts = [
                SELECT Id, Account_Key__c, Points_Balance__c, Reserved_Points__c
                FROM Housie_Account__c
                WHERE Account_Key__c IN :accountIds
                FOR UPDATE
            ];
            Map<String,Housie_Account__c> byKey = new Map<String,Housie_Account__c>();
            for (Housie_Account__c account : accounts) byKey.put(account.Account_Key__c, account);
            for (String accountIdKey : accountIds) {
                HousieErrors.require(byKey.containsKey(accountIdKey),
                    'A participant account is missing during wallet capture.');
                Housie_Account__c account = byKey.get(accountIdKey);
                Decimal amount = plan.accountTotals.get(accountIdKey);
                HousieErrors.require(account.Reserved_Points__c != null && account.Reserved_Points__c >= amount,
                    'Reserved points are insufficient to capture the game funding.');
                HousieErrors.require(account.Points_Balance__c != null && account.Points_Balance__c >= amount,
                    'Point balance is insufficient to capture the game funding.');
                account.Points_Balance__c -= amount;
                account.Reserved_Points__c -= amount;
                HousieDomainRules.assertWalletInvariant(account);
            }
            update accounts;
            command.Status__c = 'CAPTURED';
        }
        command.Payload__c = JSON.serialize(payload);
        command.Updated_At__c = System.now();
        update command;

        ActionResult result = new ActionResult();
        result.requestId = requestId; result.gameId = command.Game_Id__c;
        result.status = finalBatch ? 'CAPTURED' : 'PREPARED';
        result.nextCursor = nextCursor; result.complete = false;
        result.readyToExecute = finalBatch;
        result.message = finalBatch
            ? 'All ticket holds and account balances are captured. Final game activation is the next step.'
            : 'Funding batch finalized. Continue with the next capture batch.';
        return result;
    }

    @AuraEnabled
    public static ActionResult commitStartActivation(String requestId, String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        String commandKey = HousieIds.stableId('START_EXECUTION', requestId);
        Housie_Ticket_Command__c command = requireCommand(commandKey, actor.Account_Key__c, START_EXECUTION_COMMAND);
        HousieErrors.require(command.Status__c == 'CAPTURED' || command.Status__c == 'COMMITTED',
            'Wallet capture must be finalized before activating the game.');
        if (command.Status__c == 'COMMITTED') return commandResult(command);
        requireGameCommandLock(command.Game_Id__c, command.Request_Key__c);
        Map<String,Object> payload = (Map<String,Object>)JSON.deserializeUntyped(command.Payload__c);
        GameContext context = loadCurrentGame(command.Board_Id__c);
        Decimal fundedSequence = Decimal.valueOf(String.valueOf(payload.get('eventSequence')));
        if (context.gameRow.Status__c == 'RUNNING' &&
            context.gameRow.Event_Sequence__c == fundedSequence + 1) {
            ActionResult alreadyActivated = new ActionResult();
            alreadyActivated.requestId = requestId; alreadyActivated.gameId = command.Game_Id__c;
            alreadyActivated.status = 'PERSISTED';
            alreadyActivated.message = 'RUNNING game state is already persisted. Finalize the start command.';
            return alreadyActivated;
        }
        HousieErrors.require(context.gameRow.Status__c == 'WAITING' &&
            context.gameRow.Event_Sequence__c == fundedSequence,
            'The funded waiting-game state changed before activation.');
        Game_Action_Request__b requestRow = findLatestActionRequest(command.Game_Id__c, requestId);
        HousieErrors.require(requestRow != null && requestRow.Status__c == 'OPEN',
            'The approved start request is missing or no longer open.');
        Map<String,Participant> participants = loadActiveParticipants(command.Game_Id__c);
        String adminId = findAvailableGameAdmin(participants,
            integerConfig(context.config, 'adminOfflineGraceSeconds', 90));
        HousieErrors.require(String.isNotBlank(adminId),
            'No eligible game admin is currently online. The game cannot start yet.');
        Map<String,Object> requestRules = (Map<String,Object>)JSON.deserializeUntyped(requestRow.Required_Approval_Rules__c);
        String requesterRole = String.valueOf(requestRules.get('requesterRole'));
        if (requesterRole != 'SUPER_ADMIN') {
            String currentRequesterRole = resolveRequesterRole(command.Board_Id__c,
                requestRow.Requester_Account_Id__c, participants, adminId, false);
            HousieErrors.require(currentRequesterRole == requesterRole,
                'The start requester no longer holds the role that was used to approve this request.');
        }
        Datetime startedAt = System.now();
        Decimal runningSequence = fundedSequence + 1;
        Decimal total = Decimal.valueOf(String.valueOf(payload.get('total')));
        List<HousieOperationService.WriteItem> writes = new List<HousieOperationService.WriteItem>();
        writes.add(writeItem('Game__b', new Map<String,Object>{
            'Record_Id__c' => command.Game_Id__c,
            'Board_Id__c' => command.Board_Id__c,
            'Status__c' => 'RUNNING',
            'Config_Snapshot__c' => context.gameRow.Config_Snapshot__c,
            'Event_Sequence__c' => runningSequence,
            'Current_Admin_Account_Id__c' => adminId,
            'Wallet_Total__c' => total,
            'Wallet_Obligations__c' => 0,
            'Wallet_Available__c' => total,
            'Created_At__c' => context.gameRow.Created_At__c,
            'Started_At__c' => startedAt
        }));
        writes.add(writeItem('Game_Event__b', new Map<String,Object>{
            'Record_Id__c' => HousieIds.stableId('GAME_STARTED', command.Game_Id__c),
            'Game_Id__c' => command.Game_Id__c,
            'Sequence__c' => runningSequence,
            'Event_Type__c' => 'GAME_STARTED',
            'Actor_Account_Id__c' => actor.Account_Key__c,
            'Payload__c' => JSON.serialize(new Map<String,Object>{
                'requestId' => requestId, 'adminAccountId' => adminId,
                'walletTotal' => total, 'ticketCount' => Integer.valueOf(String.valueOf(payload.get('ticketCount')))
            }),
            'Created_At__c' => startedAt
        }));
        writes.add(writeItem('Game_Event__b', new Map<String,Object>{
            'Record_Id__c' => HousieIds.stableId('GAME_ADMIN_ASSIGNED', command.Game_Id__c + ':' + adminId),
            'Game_Id__c' => command.Game_Id__c,
            'Sequence__c' => runningSequence,
            'Event_Type__c' => 'GAME_ADMIN_ASSIGNED',
            'Actor_Account_Id__c' => actor.Account_Key__c,
            'Payload__c' => JSON.serialize(new Map<String,Object>{
                'adminAccountId' => adminId, 'reason' => 'START_TIME_ONLINE_PARTICIPANT'
            }),
            'Created_At__c' => startedAt
        }));
        writes.add(writeItem('Game_Action_Request__b', new Map<String,Object>{
            'Record_Id__c' => requestId,
            'Game_Id__c' => command.Game_Id__c,
            'Action_Type__c' => START_ACTION,
            'Requester_Account_Id__c' => requestRow.Requester_Account_Id__c,
            'Expected_Game_State__c' => 'WAITING',
            'Required_Approval_Rules__c' => requestRow.Required_Approval_Rules__c,
            'Status__c' => 'APPROVED',
            'Created_At__c' => requestRow.Created_At__c,
            'Expires_At__c' => requestRow.Expires_At__c,
            'Closed_At__c' => startedAt,
            'Executed_At__c' => startedAt
        }));
        HousieOperationService.executeOperation('ACTIVATE_FUNDED_HOUSIE_GAME', writes);
        ActionResult result = new ActionResult();
        result.requestId = requestId; result.gameId = command.Game_Id__c;
        result.status = 'PERSISTED'; result.message = 'RUNNING game state persisted. Finalize the start command.';
        return result;
    }

    @AuraEnabled
    public static ActionResult completeStartActivation(String requestId, String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        String commandKey = HousieIds.stableId('START_EXECUTION', requestId);
        List<Housie_Ticket_Command__c> commands = [
            SELECT Id, Request_Key__c, Account_Key__c, Board_Id__c, Game_Id__c,
                   Action_Type__c, Payload__c, Status__c
            FROM Housie_Ticket_Command__c
            WHERE Request_Key__c = :commandKey AND Account_Key__c = :actor.Account_Key__c
            LIMIT 1 FOR UPDATE
        ];
        HousieErrors.require(!commands.isEmpty(), 'Prepared start execution not found.');
        Housie_Ticket_Command__c command = commands[0];
        if (command.Status__c == 'COMMITTED') return commandResult(command);
        HousieErrors.require(command.Status__c == 'CAPTURED',
            'Wallet capture must be finalized before completing game activation.');
        requireGameCommandLock(command.Game_Id__c, command.Request_Key__c);
        List<Game__b> games = [
            SELECT Record_Id__c, Operation_Id__c, Status__c
            FROM Game__b WHERE Board_Id__c = :command.Board_Id__c AND Status__c = 'RUNNING' LIMIT 200
        ];
        Set<String> gameOps = new Set<String>();
        for (Game__b game : games) if (game.Record_Id__c == command.Game_Id__c) gameOps.add(game.Operation_Id__c);
        Set<String> committedGameOps = HousieBigObjectStore.committedOperationIds(gameOps);
        Boolean running = false;
        for (Game__b game : games) if (game.Record_Id__c == command.Game_Id__c &&
            committedGameOps.contains(game.Operation_Id__c)) running = true;
        HousieErrors.require(running, 'The RUNNING game operation is not committed yet. Retry activation finalization.');
        Game_Action_Request__b requestRow = findLatestActionRequest(command.Game_Id__c, requestId);
        HousieErrors.require(requestRow != null && requestRow.Status__c == 'APPROVED' &&
            requestRow.Executed_At__c != null, 'The approved and executed request record is not committed yet.');
        command.Status__c = 'COMMITTED';
        command.Committed_At__c = System.now();
        command.Updated_At__c = command.Committed_At__c;
        releaseGameCommandLock(command.Game_Id__c, command.Request_Key__c);
        update command;
        ActionResult result = new ActionResult();
        result.requestId = requestId; result.gameId = command.Game_Id__c;
        result.status = 'COMMITTED'; result.complete = true;
        result.message = 'Game started successfully. Funding is captured and the Game Wallet is active.';
        return result;
    }

    @TestVisible
    static Boolean approvalThreshold(String requesterId, String requesterRole,
        List<Game_Action_Response__b> responses) {
        if (requesterRole == 'SUPER_ADMIN') return true;
        Set<String> adminApprovers = new Set<String>();
        Set<String> nonAdminApprovers = new Set<String>();
        for (Game_Action_Response__b responseRow : responses) {
            if (responseRow.Response__c != 'APPROVE' || responseRow.Account_Id__c == requesterId) continue;
            if (responseRow.Eligibility_Role__c == 'ADMIN') adminApprovers.add(responseRow.Account_Id__c);
            if (responseRow.Eligibility_Role__c == 'NON_ADMIN') nonAdminApprovers.add(responseRow.Account_Id__c);
        }
        if (requesterRole == 'ADMIN') return !nonAdminApprovers.isEmpty();
        if (requesterRole == 'NON_ADMIN') return !adminApprovers.isEmpty();
        if (requesterRole == 'INITIATOR_ONLY') {
            for (String adminId : adminApprovers) {
                for (String nonAdminId : nonAdminApprovers) {
                    if (adminId != nonAdminId) return true;
                }
            }
        }
        return false;
    }

    private static GameContext loadCurrentGame(String boardId) {
        HousieErrors.require(String.isNotBlank(boardId), 'Board id is required.');
        List<Board__b> boards = [
            SELECT Record_Id__c, Operation_Id__c, Current_Game_Id__c, Status__c, Visibility__c
            FROM Board__b WHERE Visibility__c = 'PUBLIC' AND Record_Id__c = :boardId LIMIT 1
        ];
        if (boards.isEmpty()) boards = [
            SELECT Record_Id__c, Operation_Id__c, Current_Game_Id__c, Status__c, Visibility__c
            FROM Board__b WHERE Visibility__c = 'PRIVATE' AND Record_Id__c = :boardId LIMIT 1
        ];
        HousieErrors.require(!boards.isEmpty() && boards[0].Status__c == 'ACTIVE', 'Active board not found.');
        HousieErrors.require(HousieBigObjectStore.isCommitted(boards[0].Operation_Id__c),
            'Board creation is not committed.');
        List<Game__b> games = [
            SELECT Record_Id__c, Operation_Id__c, Board_Id__c, Status__c, Config_Snapshot__c,
                   Created_At__c, Started_At__c, Event_Sequence__c, Current_Admin_Account_Id__c,
                   Wallet_Total__c, Wallet_Obligations__c, Wallet_Available__c
            FROM Game__b WHERE Board_Id__c = :boardId LIMIT 200
        ];
        Set<String> operationIds = new Set<String>();
        for (Game__b game : games) if (game.Record_Id__c == boards[0].Current_Game_Id__c) operationIds.add(game.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operationIds);
        Game__b current;
        for (Game__b game : games) {
            if (game.Record_Id__c == boards[0].Current_Game_Id__c && committed.contains(game.Operation_Id__c) &&
                (current == null || (game.Event_Sequence__c != null &&
                 (current.Event_Sequence__c == null || game.Event_Sequence__c > current.Event_Sequence__c)))) {
                current = game;
            }
        }
        HousieErrors.require(current != null, 'The current game could not be found.');
        GameContext context = new GameContext();
        context.boardRow = boards[0]; context.gameRow = current;
        context.config = String.isBlank(current.Config_Snapshot__c)
            ? new Map<String,Object>() : (Map<String,Object>)JSON.deserializeUntyped(current.Config_Snapshot__c);
        return context;
    }

    private static StartFundingPlan buildStartFundingPlan(
        GameContext context, Map<String,Participant> participants
    ) {
        StartFundingPlan plan = new StartFundingPlan();
        plan.gameAdminId = findAvailableGameAdmin(participants, integerConfig(context.config, 'adminOfflineGraceSeconds', 90));
        HousieErrors.require(String.isNotBlank(plan.gameAdminId),
            'An eligible game admin must be available before starting.');
        List<Ticket__b> tickets = loadCommittedHumanTickets(context.gameRow.Record_Id__c);
        Set<String> withdrawnTickets = withdrawnTicketIds(context.gameRow.Record_Id__c);
        Set<String> participantIds = participants.keySet();
        List<Wallet_Hold__b> holdRows = [
            SELECT Record_Id__c, Operation_Id__c, Hold_Id__c, Account_Id__c, Amount__c,
                   Status__c, Created_At__c, Updated_At__c
            FROM Wallet_Hold__b
            WHERE Account_Id__c IN :participantIds AND Game_Id__c = :context.gameRow.Record_Id__c
            LIMIT 2000
        ];
        Set<String> holdOperations = new Set<String>();
        for (Wallet_Hold__b hold : holdRows) holdOperations.add(hold.Operation_Id__c);
        Set<String> committedHoldOperations = HousieBigObjectStore.committedOperationIds(holdOperations);
        Map<String,Wallet_Hold__b> latestHolds = new Map<String,Wallet_Hold__b>();
        for (Wallet_Hold__b hold : holdRows) {
            if (!committedHoldOperations.contains(hold.Operation_Id__c)) continue;
            Wallet_Hold__b prior = latestHolds.get(hold.Hold_Id__c);
            if (prior == null || (hold.Updated_At__c != null &&
                (prior.Updated_At__c == null || hold.Updated_At__c > prior.Updated_At__c))) {
                latestHolds.put(hold.Hold_Id__c, hold);
            }
        }
        for (Ticket__b ticket : tickets) {
            if (ticket.Status__c != 'ACTIVE' || withdrawnTickets.contains(ticket.Record_Id__c) ||
                !participants.containsKey(ticket.Owner_Account_Id__c)) continue;
            Wallet_Hold__b hold = latestHolds.get(ticket.Wallet_Hold_Id__c);
            HousieErrors.require(hold != null && new Set<String>{'ACTIVE','CAPTURED'}.contains(hold.Status__c),
                'An active human ticket does not have an active or captured committed wallet hold.');
            Decimal amount = hold.Amount__c == null ? 0 : hold.Amount__c;
            plan.total += amount;
            plan.accountTotals.put(ticket.Owner_Account_Id__c,
                (plan.accountTotals.containsKey(ticket.Owner_Account_Id__c)
                    ? plan.accountTotals.get(ticket.Owner_Account_Id__c) : 0) + amount);
            plan.holds.add(new Map<String,Object>{
                'accountId' => ticket.Owner_Account_Id__c,
                'ticketId' => ticket.Record_Id__c,
                'holdId' => hold.Hold_Id__c,
                'amount' => amount,
                'createdAt' => hold.Created_At__c
            });
        }
        HousieErrors.require(!plan.holds.isEmpty(),
            'No active human ticket holds are available to fund the game.');
        return plan;
    }

    private static Map<String,Participant> loadActiveParticipants(String gameId) {
        List<Game_Participant__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Account_Id__c, Join_Sequence__c,
                   Joined_At__c, Withdrawn_At__c, Status__c
            FROM Game_Participant__b WHERE Game_Id__c = :gameId LIMIT 2000
        ];
        Set<String> operations = new Set<String>();
        for (Game_Participant__b row : rows) operations.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operations);
        Map<String,Game_Participant__b> latest = new Map<String,Game_Participant__b>();
        Datetime latestAt;
        Map<String,Datetime> eventTimes = new Map<String,Datetime>();
        for (Game_Participant__b row : rows) {
            if (!committed.contains(row.Operation_Id__c)) continue;
            Datetime eventAt = row.Status__c == 'WITHDRAWN' ? row.Withdrawn_At__c : row.Joined_At__c;
            if (eventAt != null && (!eventTimes.containsKey(row.Account_Id__c) ||
                eventAt > eventTimes.get(row.Account_Id__c))) {
                eventTimes.put(row.Account_Id__c, eventAt);
                latest.put(row.Account_Id__c, row);
            }
        }
        Map<String,Participant> result = new Map<String,Participant>();
        for (String accountId : latest.keySet()) {
            Game_Participant__b row = latest.get(accountId);
            if (row.Status__c != 'ACTIVE') continue;
            Participant p = new Participant();
            p.accountId = accountId; p.joinSequence = row.Join_Sequence__c; p.joinedAt = row.Joined_At__c;
            result.put(accountId, p);
        }
        return result;
    }

    private static String findAvailableGameAdmin(
        Map<String,Participant> participants, Integer graceSeconds
    ) {
        if (participants.isEmpty()) return null;
        Set<String> accountIds = participants.keySet();
        List<Housie_Account__c> accounts = [
            SELECT Account_Key__c, Status__c, Last_Seen_At__c
            FROM Housie_Account__c
            WHERE Account_Key__c IN :accountIds
            LIMIT 2000
        ];
        Map<String,Decimal> joinSequences = new Map<String,Decimal>();
        for (Participant participant : participants.values()) {
            joinSequences.put(participant.accountId, participant.joinSequence);
        }
        Map<String,Datetime> lastSeenByAccount = new Map<String,Datetime>();
        Set<String> activeAccounts = new Set<String>();
        for (Housie_Account__c account : accounts) {
            if (account.Status__c == 'ACTIVE') activeAccounts.add(account.Account_Key__c);
            lastSeenByAccount.put(account.Account_Key__c, account.Last_Seen_At__c);
        }
        Integer grace = graceSeconds == null || graceSeconds <= 0 ? 90 : graceSeconds;
        return selectAvailableAdmin(joinSequences, lastSeenByAccount, activeAccounts,
            System.now().addSeconds(-grace));
    }

    @TestVisible
    static String selectAvailableAdmin(
        Map<String,Decimal> joinSequences,
        Map<String,Datetime> lastSeenByAccount,
        Set<String> activeAccounts,
        Datetime cutoff
    ) {
        String selectedAccount;
        Decimal selectedSequence;
        for (String accountId : joinSequences.keySet()) {
            Datetime lastSeen = lastSeenByAccount.get(accountId);
            Decimal sequence = joinSequences.get(accountId);
            if (!activeAccounts.contains(accountId) || lastSeen == null || lastSeen < cutoff || sequence == null) continue;
            if (selectedAccount == null || sequence < selectedSequence) {
                selectedAccount = accountId;
                selectedSequence = sequence;
            }
        }
        return selectedAccount;
    }

    private static String resolveRequesterRole(String boardId, String accountId,
        Map<String,Participant> participants, String gameAdminId, Boolean requireParticipantForBoardAdmin) {
        Boolean isParticipant = participants.containsKey(accountId);
        Boolean isBoardAdmin = isBoardAdmin(boardId, accountId);
        if (accountId == gameAdminId) return 'ADMIN';
        if (isBoardAdmin && isParticipant) return 'ADMIN';
        if (isBoardAdmin && !isParticipant && !requireParticipantForBoardAdmin) return 'INITIATOR_ONLY';
        if (isParticipant) return 'NON_ADMIN';
        return null;
    }

    private static Boolean isBoardAdmin(String boardId, String accountId) {
        List<Board_Member__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Board_Role__c, Joined_At__c, Left_At__c, Status__c
            FROM Board_Member__b
            WHERE Account_Id__c = :accountId AND Board_Id__c = :boardId LIMIT 200
        ];
        Set<String> operations = new Set<String>();
        for (Board_Member__b row : rows) operations.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operations);
        Board_Member__b latest;
        Datetime latestAt;
        for (Board_Member__b row : rows) {
            if (!committed.contains(row.Operation_Id__c)) continue;
            Datetime eventAt = row.Status__c == 'LEFT' ? row.Left_At__c : row.Joined_At__c;
            if (eventAt != null && (latestAt == null || eventAt > latestAt)) {
                latestAt = eventAt; latest = row;
            }
        }
        return latest != null && latest.Status__c == 'ACTIVE' && latest.Board_Role__c == 'BOARD_ADMIN';
    }

    private static void requireBoardMember(String boardId, String accountId) {
        List<Board_Member__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Joined_At__c, Left_At__c, Status__c
            FROM Board_Member__b
            WHERE Account_Id__c = :accountId AND Board_Id__c = :boardId LIMIT 200
        ];
        Set<String> operations = new Set<String>();
        for (Board_Member__b row : rows) operations.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operations);
        Datetime latestAt;
        String status;
        for (Board_Member__b row : rows) {
            if (!committed.contains(row.Operation_Id__c)) continue;
            Datetime eventAt = row.Status__c == 'LEFT' ? row.Left_At__c : row.Joined_At__c;
            if (eventAt != null && (latestAt == null || eventAt > latestAt)) {
                latestAt = eventAt; status = row.Status__c;
            }
        }
        HousieErrors.require(status == 'ACTIVE', 'Join this board before requesting a game start.');
    }

    private static List<Ticket__b> loadCommittedHumanTickets(String gameId) {
        List<Ticket__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Owner_Account_Id__c, Status__c,
                   Entry_Fee__c, Wallet_Hold_Id__c
            FROM Ticket__b
            WHERE Game_Id__c = :gameId AND Ticket_Kind__c = 'HUMAN'
            ORDER BY Record_Id__c ASC LIMIT 2000
        ];
        Set<String> operations = new Set<String>();
        for (Ticket__b row : rows) operations.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operations);
        List<Ticket__b> result = new List<Ticket__b>();
        for (Ticket__b row : rows) if (committed.contains(row.Operation_Id__c)) result.add(row);
        return result;
    }

    private static Set<String> withdrawnTicketIds(String gameId) {
        List<Game_Event__b> events = [
            SELECT Record_Id__c, Operation_Id__c, Event_Type__c, Payload__c
            FROM Game_Event__b WHERE Game_Id__c = :gameId LIMIT 2000
        ];
        Set<String> operations = new Set<String>();
        for (Game_Event__b row : events) operations.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operations);
        Set<String> withdrawn = new Set<String>();
        for (Game_Event__b row : events) {
            if (row.Event_Type__c != 'TICKET_WITHDRAWN' || !committed.contains(row.Operation_Id__c) ||
                String.isBlank(row.Payload__c)) continue;
            Map<String,Object> payload = (Map<String,Object>)JSON.deserializeUntyped(row.Payload__c);
            if (payload != null && payload.containsKey('ticketId')) {
                withdrawn.add(String.valueOf(payload.get('ticketId')));
            }
        }
        return withdrawn;
    }

    private static List<Game_Action_Request__b> findActionRequests(String gameId, String status) {
        List<Game_Action_Request__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Action_Type__c, Requester_Account_Id__c,
                   Expected_Game_State__c, Required_Approval_Rules__c, Status__c,
                   Created_At__c, Expires_At__c, Closed_At__c, Executed_At__c
            FROM Game_Action_Request__b
            WHERE Game_Id__c = :gameId AND Status__c = :status LIMIT 200
        ];
        Set<String> operations = new Set<String>();
        for (Game_Action_Request__b row : rows) operations.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operations);
        List<Game_Action_Request__b> result = new List<Game_Action_Request__b>();
        for (Game_Action_Request__b row : rows) if (committed.contains(row.Operation_Id__c)) result.add(row);
        return result;
    }

    private static Game_Action_Request__b findLatestActionRequest(String gameId, String requestId) {
        List<Game_Action_Request__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Action_Type__c, Requester_Account_Id__c,
                   Expected_Game_State__c, Required_Approval_Rules__c, Status__c,
                   Created_At__c, Expires_At__c, Closed_At__c, Executed_At__c
            FROM Game_Action_Request__b WHERE Game_Id__c = :gameId LIMIT 2000
        ];
        Set<String> operations = new Set<String>();
        for (Game_Action_Request__b row : rows) operations.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operations);
        Game_Action_Request__b latest;
        for (Game_Action_Request__b row : rows) {
            if (row.Record_Id__c != requestId || !committed.contains(row.Operation_Id__c)) continue;
            if (latest == null || (row.Closed_At__c != null &&
                (latest.Closed_At__c == null || row.Closed_At__c > latest.Closed_At__c))) latest = row;
        }
        return latest;
    }

    private static void verifyCapturedHolds(String gameId, List<Object> plan, Integer startAt, Integer endAt) {
        Map<String,Set<String>> needed = new Map<String,Set<String>>();
        for (Integer i=startAt; i<endAt; i++) {
            Map<String,Object> item = (Map<String,Object>)plan[i];
            String accountId = String.valueOf(item.get('accountId'));
            if (!needed.containsKey(accountId)) needed.put(accountId, new Set<String>());
            needed.get(accountId).add(String.valueOf(item.get('holdId')));
        }
        for (String accountId : needed.keySet()) {
            List<Wallet_Hold__b> rows = [
                SELECT Record_Id__c, Operation_Id__c, Hold_Id__c, Status__c
                FROM Wallet_Hold__b WHERE Account_Id__c = :accountId AND Game_Id__c = :gameId LIMIT 2000
            ];
            Set<String> operations = new Set<String>();
            for (Wallet_Hold__b row : rows) operations.add(row.Operation_Id__c);
            Set<String> committed = HousieBigObjectStore.committedOperationIds(operations);
            Set<String> captured = new Set<String>();
            for (Wallet_Hold__b row : rows) {
                if (committed.contains(row.Operation_Id__c) && row.Status__c == 'CAPTURED') captured.add(row.Hold_Id__c);
            }
            for (String holdId : needed.get(accountId)) {
                HousieErrors.require(captured.contains(holdId),
                    'Wallet hold capture is not committed yet. Retry batch finalization.');
            }
        }
    }

    private static void verifyPreparedGame(String boardId, String gameId, Decimal expectedSequence) {
        List<Game__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Event_Sequence__c, Status__c
            FROM Game__b WHERE Board_Id__c = :boardId AND Status__c = 'WAITING' LIMIT 200
        ];
        Set<String> operations = new Set<String>();
        for (Game__b row : rows) {
            if (row.Record_Id__c == gameId && row.Event_Sequence__c == expectedSequence)
                operations.add(row.Operation_Id__c);
        }
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operations);
        Boolean found = false;
        for (Game__b row : rows) {
            if (row.Record_Id__c == gameId && row.Event_Sequence__c == expectedSequence &&
                committed.contains(row.Operation_Id__c)) found = true;
        }
        HousieErrors.require(found, 'The funded waiting-game record is not committed yet. Retry finalization.');
    }

    private static Housie_Game_Command_Lock__c lockGameCommandSlot(String gameId) {
        List<Housie_Game_Command_Lock__c> rows = [
            SELECT Id, Game_Id__c, Status__c, Active_Command_Key__c
            FROM Housie_Game_Command_Lock__c WHERE Game_Id__c = :gameId LIMIT 1 FOR UPDATE
        ];
        if (rows.isEmpty()) return null;
        HousieErrors.require(rows[0].Status__c != 'PROCESSING',
            'Another game command is still being finalized. Retry after it completes.');
        return rows[0];
    }
    private static void activateGameCommandLock(Housie_Game_Command_Lock__c gate, String gameId, String commandKey) {
        Datetime nowAt = System.now();
        if (gate == null) insert new Housie_Game_Command_Lock__c(
            Game_Id__c = gameId, Status__c = 'PROCESSING',
            Active_Command_Key__c = commandKey, Created_At__c = nowAt, Updated_At__c = nowAt
        );
        else {
            gate.Status__c = 'PROCESSING'; gate.Active_Command_Key__c = commandKey;
            gate.Updated_At__c = nowAt; update gate;
        }
    }
    private static void requireGameCommandLock(String gameId, String commandKey) {
        List<Housie_Game_Command_Lock__c> rows = [
            SELECT Status__c, Active_Command_Key__c
            FROM Housie_Game_Command_Lock__c WHERE Game_Id__c = :gameId LIMIT 1
        ];
        HousieErrors.require(!rows.isEmpty() && rows[0].Status__c == 'PROCESSING' &&
            rows[0].Active_Command_Key__c == commandKey, 'This command no longer owns the game command gate.');
    }
    private static void releaseGameCommandLock(String gameId, String commandKey) {
        List<Housie_Game_Command_Lock__c> rows = [
            SELECT Id, Status__c, Active_Command_Key__c
            FROM Housie_Game_Command_Lock__c WHERE Game_Id__c = :gameId LIMIT 1 FOR UPDATE
        ];
        HousieErrors.require(!rows.isEmpty() && rows[0].Status__c == 'PROCESSING' &&
            rows[0].Active_Command_Key__c == commandKey, 'This command no longer owns the game command gate.');
        rows[0].Status__c = 'IDLE'; rows[0].Active_Command_Key__c = null;
        rows[0].Updated_At__c = System.now(); update rows[0];
    }

    private static Housie_Ticket_Command__c findCommand(String requestKey) {
        List<Housie_Ticket_Command__c> rows = [
            SELECT Id, Request_Key__c, Account_Key__c, Board_Id__c, Game_Id__c,
                   Action_Type__c, Ticket_Id__c, Entry_Fee__c, Payload__c, Status__c,
                   Created_At__c, Updated_At__c, Committed_At__c
            FROM Housie_Ticket_Command__c WHERE Request_Key__c = :requestKey LIMIT 1
        ];
        return rows.isEmpty() ? null : rows[0];
    }
    private static Housie_Ticket_Command__c requireCommand(
        String requestKey, String accountId, String actionType) {
        Housie_Ticket_Command__c command = findCommand(requestKey);
        HousieErrors.require(command != null && command.Account_Key__c == accountId &&
            command.Action_Type__c == actionType, 'Prepared game-start command not found.');
        return command;
    }
    private static ActionResult commandResult(Housie_Ticket_Command__c command) {
        ActionResult result = new ActionResult();
        result.requestId = command.Ticket_Id__c;
        result.gameId = command.Game_Id__c;
        result.status = command.Status__c;
        result.readyToExecute = command.Status__c == 'COMMITTED' || command.Status__c == 'CAPTURED';
        if (command.Action_Type__c == START_EXECUTION_COMMAND && String.isNotBlank(command.Payload__c)) {
            Map<String,Object> payload = (Map<String,Object>)JSON.deserializeUntyped(command.Payload__c);
            result.nextCursor = Integer.valueOf(String.valueOf(payload.get('cursor')));
            result.complete = command.Status__c == 'COMMITTED';
        }
        result.message = command.Status__c == 'COMMITTED'
            ? 'Command is already committed.' : 'Command is prepared and can be retried.';
        return result;
    }
    private static HousieOperationService.WriteItem writeItem(String objectName, Map<String,Object> fields) {
        HousieOperationService.WriteItem item = new HousieOperationService.WriteItem();
        item.objectApiName = objectName; item.fields = fields; return item;
    }
    private static Integer integerConfig(Map<String,Object> config, String key, Integer fallback) {
        if (config == null || !config.containsKey(key) || config.get(key) == null) return fallback;
        return Integer.valueOf(String.valueOf(config.get(key)));
    }
}
