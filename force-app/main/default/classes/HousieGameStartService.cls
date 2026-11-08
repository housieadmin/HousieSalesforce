public without sharing class HousieGameStartService {
    private static final Integer BATCH_SIZE = 18;
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
        @AuraEnabled public String actionType;
        @AuraEnabled public String requesterAccountId;
        @AuraEnabled public Datetime createdAt;
        @AuraEnabled public Datetime expiresAt;
        @AuraEnabled public String status;
        @AuraEnabled public String requesterRole;
        @AuraEnabled public Boolean canApprove;
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

    @AuraEnabled
    public static ActionResult prepareStartRequest(String boardId, String accountId, String clientRequestId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        HousieErrors.require(String.isNotBlank(clientRequestId) && clientRequestId.length() <= 120,
            'A valid start request id is required.');
        GameContext context = loadCurrentGame(boardId);
        HousieErrors.require(context.gameRow.Status__c == 'WAITING', 'Only a waiting game can be started.');
        requireBoardMember(boardId, actor.Account_Key__c);

        Map<String,Participant> participants = loadActiveParticipants(context.gameRow.Record_Id__c);
        Integer minimum = integerConfig(context.config, 'minimumHumanParticipants', 2);
        HousieErrors.require(participants.size() >= minimum,
            'At least ' + minimum + ' distinct human participants with paid tickets are required.');
        String gameAdminId = findGameAdmin(participants);
        HousieErrors.require(String.isNotBlank(gameAdminId), 'An eligible game admin must be available before starting.');

        String requesterRole = resolveRequesterRole(boardId, actor.Account_Key__c, participants, gameAdminId, false);
        HousieErrors.require(requesterRole == 'ADMIN' || requesterRole == 'NON_ADMIN',
            'Only an authorized board admin or game participant can request a start.');
        if (HousieSecurity.isSuperAdmin(actor)) requesterRole = 'SUPER_ADMIN';

        List<Game_Action_Request__b> openRequests = findActionRequests(context.gameRow.Record_Id__c, 'OPEN');
        for (Game_Action_Request__b openRequest : openRequests) {
            if (openRequest.Action_Type__c == START_ACTION &&
                openRequest.Expires_At__c != null && openRequest.Expires_At__c > System.now()) {
                HousieErrors.require(false, 'A start request is already open for this game.');
            }
        }

        String requestId = HousieIds.stableId('START_REQUEST',
            context.gameRow.Record_Id__c + ':' + actor.Account_Key__c + ':' + clientRequestId);
        String commandKey = HousieIds.stableId('START_COMMAND', requestId);
        Housie_Ticket_Command__c prior = findCommand(commandKey);
        if (prior != null) return commandResult(prior);

        Housie_Game_Command_Lock__c gate = lockGameCommandSlot(context.gameRow.Record_Id__c);
        HousieErrors.require(gate == null || gate.Status__c != 'PROCESSING',
            'Another game command is being finalized. Retry shortly.');

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
        String gameAdminId = findGameAdmin(participants);
        String role = resolveRequesterRole(boardId, actor.Account_Key__c, participants, gameAdminId, true);
        HousieErrors.require(role == 'ADMIN' || role == 'NON_ADMIN',
            'You are not eligible to review this start request.');

        List<Game_Action_Response__b> existing = [
            SELECT Record_Id__c, Response__c, Eligibility_Role__c, Operation_Id__c
            FROM Game_Action_Response__b
            WHERE Request_Id__c = :requestId AND Account_Id__c = :actor.Account_Key__c
            LIMIT 20
        ];
        HousieErrors.require(existing.isEmpty(), 'You have already responded to this start request.');

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
        result.approvedCount = approved;
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
        String gameAdminId = findGameAdmin(participants);
        String role = resolveRequesterRole(boardId, actor.Account_Key__c, participants, gameAdminId, true);
        List<Game_Action_Request__b> rows = findActionRequests(context.gameRow.Record_Id__c, 'OPEN');
        List<StartRequestView> result = new List<StartRequestView>();
        Set<String> requestIds = new Set<String>();
        for (Game_Action_Request__b row : rows) {
            if (row.Action_Type__c == START_ACTION && row.Expires_At__c != null &&
                row.Expires_At__c > System.now() && row.Expected_Game_State__c == context.gameRow.Status__c) {
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
            StartRequestView view = new StartRequestView();
            view.requestId = row.Record_Id__c;
            view.actionType = row.Action_Type__c;
            view.requesterAccountId = row.Requester_Account_Id__c;
            view.createdAt = row.Created_At__c;
            view.expiresAt = row.Expires_At__c;
            view.status = row.Status__c;
            view.requesterRole = requesterRole;
            view.canApprove = role == 'ADMIN' || role == 'NON_ADMIN';
            view.approvedCount = 0;
            for (Game_Action_Response__b responseRow : responses) {
                if (responseRow.Account_Id__c == actor.Account_Key__c) view.currentUserResponse = responseRow.Response__c;
                if (responseRow.Response__c == 'APPROVE') view.approvedCount++;
            }
            result.add(view);
        }
        return result;
    }

    @AuraEnabled
    public static ActionResult prepareStartExecution(String boardId, String requestId, String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        GameContext context = loadCurrentGame(boardId);
        HousieErrors.require(context.gameRow.Status__c == 'WAITING', 'Only a waiting game can be started.');
        Game_Action_Request__b requestRow = findLatestActionRequest(context.gameRow.Record_Id__c, requestId);
        HousieErrors.require(requestRow != null && requestRow.Expires_At__c != null &&
            requestRow.Expires_At__c > System.now(), 'The start request is missing or expired.');
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
        HousieErrors.require(HousieSecurity.isSuperAdmin(actor) ||
            approvalThreshold(requestRow.Requester_Account_Id__c, requesterRole, committedResponses),
            'The start request does not yet have the two required distinct approvals.');

        Map<String,Participant> participants = loadActiveParticipants(context.gameRow.Record_Id__c);
        Integer minimum = integerConfig(context.config, 'minimumHumanParticipants', 2);
        HousieErrors.require(participants.size() >= minimum,
            'The game no longer meets minimum human participation.');
        String gameAdminId = findGameAdmin(participants);
        HousieErrors.require(String.isNotBlank(gameAdminId), 'An eligible game admin is not available.');

        List<Ticket__b> tickets = loadCommittedHumanTickets(context.gameRow.Record_Id__c);
        Map<String,Wallet_Hold__b> latestHolds = new Map<String,Wallet_Hold__b>();
        Map<String,Decimal> accountTotals = new Map<String,Decimal>();
        List<Object> holdPlan = new List<Object>();
        Decimal total = 0;
        for (Ticket__b ticket : tickets) {
            if (ticket.Status__c != 'ACTIVE' || !participants.containsKey(ticket.Owner_Account_Id__c)) continue;
            List<Wallet_Hold__b> holdRows = [
                SELECT Record_Id__c, Operation_Id__c, Hold_Id__c, Amount__c, Status__c,
                       Created_At__c, Updated_At__c
                FROM Wallet_Hold__b
                WHERE Account_Id__c = :ticket.Owner_Account_Id__c
                  AND Game_Id__c = :context.gameRow.Record_Id__c
                LIMIT 200
            ];
            for (Wallet_Hold__b hold : holdRows) {
                if (hold.Hold_Id__c == ticket.Wallet_Hold_Id__c &&
                    HousieBigObjectStore.isCommitted(hold.Operation_Id__c)) {
                    Wallet_Hold__b prior = latestHolds.get(hold.Hold_Id__c);
                    if (prior == null || (hold.Updated_At__c != null &&
                        (prior.Updated_At__c == null || hold.Updated_At__c > prior.Updated_At__c))) {
                        latestHolds.put(hold.Hold_Id__c, hold);
                    }
                }
            }
        }
        for (Ticket__b ticket : tickets) {
            if (ticket.Status__c != 'ACTIVE' || !participants.containsKey(ticket.Owner_Account_Id__c)) continue;
            Wallet_Hold__b hold = latestHolds.get(ticket.Wallet_Hold_Id__c);
            HousieErrors.require(hold != null && hold.Status__c == 'ACTIVE',
                'An active human ticket does not have an active committed wallet hold.');
            Decimal amount = hold.Amount__c == null ? 0 : hold.Amount__c;
            total += amount;
            accountTotals.put(ticket.Owner_Account_Id__c,
                (accountTotals.containsKey(ticket.Owner_Account_Id__c) ? accountTotals.get(ticket.Owner_Account_Id__c) : 0) + amount);
            holdPlan.add(new Map<String,Object>{
                'accountId' => ticket.Owner_Account_Id__c,
                'ticketId' => ticket.Record_Id__c,
                'holdId' => hold.Hold_Id__c,
                'amount' => amount,
                'createdAt' => hold.Created_At__c
            });
        }
        HousieErrors.require(!holdPlan.isEmpty(), 'No active human ticket holds are available to fund the game.');

        String commandKey = HousieIds.stableId('START_EXECUTION', requestId);
        Housie_Ticket_Command__c prior = findCommand(commandKey);
        if (prior != null) return commandResult(prior);
        Housie_Game_Command_Lock__c gate = lockGameCommandSlot(context.gameRow.Record_Id__c);
        HousieErrors.require(gate == null || gate.Status__c != 'PROCESSING',
            'Another game command is being finalized. Retry shortly.');

        Map<String,Object> accountPlan = new Map<String,Object>();
        for (String key : accountTotals.keySet()) accountPlan.put(key, accountTotals.get(key));
        Map<String,Object> payload = new Map<String,Object>{
            'requestId' => requestId,
            'cursor' => 0,
            'holds' => holdPlan,
            'accounts' => accountPlan,
            'total' => total,
            'currentAdmin' => gameAdminId,
            'eventSequence' => (context.gameRow.Event_Sequence__c == null ? 0 : context.gameRow.Event_Sequence__c) + 1,
            'startedAt' => System.now()
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
            Entry_Fee__c = total,
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
        HousieErrors.require(command.Status__c == 'PREPARED', 'Start execution is already complete.');
        requireGameCommandLock(command.Game_Id__c, command.Request_Key__c);
        Map<String,Object> payload = (Map<String,Object>)JSON.deserializeUntyped(command.Payload__c);
        List<Object> holds = (List<Object>)payload.get('holds');
        Integer cursor = Integer.valueOf(String.valueOf(payload.get('cursor')));
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
        }
        if (finalBatch) {
            GameContext context = loadCurrentGame(command.Board_Id__c);
            HousieErrors.require(context.gameRow.Status__c == 'WAITING',
                'The game is no longer waiting. Start execution cannot continue.');
            Datetime startedAt = (Datetime)JSON.deserialize(JSON.serialize(payload.get('startedAt')), Datetime.class);
            Decimal total = Decimal.valueOf(String.valueOf(payload.get('total')));
            writes.add(writeItem('Game__b', new Map<String,Object>{
                'Record_Id__c' => command.Game_Id__c,
                'Board_Id__c' => command.Board_Id__c,
                'Status__c' => 'RUNNING',
                'Config_Snapshot__c' => context.gameRow.Config_Snapshot__c,
                'Event_Sequence__c' => Decimal.valueOf(String.valueOf(payload.get('eventSequence'))),
                'Current_Admin_Account_Id__c' => String.valueOf(payload.get('currentAdmin')),
                'Wallet_Total__c' => total,
                'Wallet_Obligations__c' => 0,
                'Wallet_Available__c' => total,
                'Created_At__c' => context.gameRow.Created_At__c,
                'Started_At__c' => startedAt
            }));
            writes.add(writeItem('Game_Event__b', new Map<String,Object>{
                'Record_Id__c' => HousieIds.stableId('GAME_STARTED', command.Game_Id__c),
                'Game_Id__c' => command.Game_Id__c,
                'Sequence__c' => Long.valueOf(String.valueOf(payload.get('eventSequence'))),
                'Event_Type__c' => 'GAME_STARTED',
                'Actor_Account_Id__c' => actor.Account_Key__c,
                'Payload__c' => JSON.serialize(new Map<String,Object>{
                    'requestId' => requestId,
                    'adminAccountId' => String.valueOf(payload.get('currentAdmin')),
                    'participantCount' => ((Map<String,Object>)payload.get('accounts')).size(),
                    'ticketCount' => holds.size(),
                    'walletTotal' => total
                }),
                'Created_At__c' => startedAt
            }));
            Game_Action_Request__b requestRow = findLatestActionRequest(command.Game_Id__c, requestId);
            HousieErrors.require(requestRow != null, 'The start request record could not be found.');
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
        }
        HousieOperationService.executeOperation('CAPTURE_GAME_START_FUNDING', writes);

        ActionResult result = new ActionResult();
        result.requestId = requestId;
        result.gameId = command.Game_Id__c;
        result.status = 'PERSISTED';
        result.nextCursor = nextCursor;
        result.complete = finalBatch;
        result.message = finalBatch
            ? 'All ticket holds and the RUNNING game state are persisted. Finalize the account wallet capture.'
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
        if (command.Status__c == 'COMMITTED') {
            ActionResult done = new ActionResult();
            done.requestId = requestId; done.gameId = command.Game_Id__c;
            done.status = 'COMMITTED'; done.complete = true;
            done.message = 'Game start is already finalized.';
            return done;
        }
        requireGameCommandLock(command.Game_Id__c, command.Request_Key__c);
        Map<String,Object> payload = (Map<String,Object>)JSON.deserializeUntyped(command.Payload__c);
        List<Object> holds = (List<Object>)payload.get('holds');
        Integer cursor = Integer.valueOf(String.valueOf(payload.get('cursor')));
        Integer expectedNext = Math.min(cursor + BATCH_SIZE, holds.size());
        HousieErrors.require(nextCursor != null && nextCursor == expectedNext,
            'The start batch cursor is stale. Refresh the pending action and retry.');
        verifyCapturedHolds(command.Game_Id__c, holds, cursor, expectedNext);

        payload.put('cursor', nextCursor);
        Boolean finalBatch = nextCursor == holds.size();
        if (finalBatch) {
            verifyRunningGame(command.Board_Id__c, command.Game_Id__c);
            Map<String,Object> accountPlan = (Map<String,Object>)payload.get('accounts');
            Set<String> accountIds = accountPlan.keySet();
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
                Decimal amount = Decimal.valueOf(String.valueOf(accountPlan.get(accountIdKey)));
                HousieErrors.require(account.Reserved_Points__c != null && account.Reserved_Points__c >= amount,
                    'Reserved points are insufficient to capture the game funding.');
                HousieErrors.require(account.Points_Balance__c != null && account.Points_Balance__c >= amount,
                    'Point balance is insufficient to capture the game funding.');
                account.Points_Balance__c -= amount;
                account.Reserved_Points__c -= amount;
                HousieDomainRules.assertWalletInvariant(account);
            }
            update accounts;
            command.Status__c = 'COMMITTED';
            command.Committed_At__c = System.now();
            releaseGameCommandLock(command.Game_Id__c, command.Request_Key__c);
        }
        command.Payload__c = JSON.serialize(payload);
        command.Updated_At__c = System.now();
        update command;

        ActionResult result = new ActionResult();
        result.requestId = requestId;
        result.gameId = command.Game_Id__c;
        result.status = finalBatch ? 'COMMITTED' : 'PREPARED';
        result.nextCursor = nextCursor;
        result.complete = finalBatch;
        result.message = finalBatch
            ? 'Game started. All ticket holds were captured into the Game Wallet.'
            : 'Funding batch finalized. Continue with the next capture batch.';
        return result;
    }

    @TestVisible
    static Boolean approvalThreshold(String requesterId, String requesterRole,
        List<Game_Action_Response__b> responses) {
        if (requesterRole == 'SUPER_ADMIN') return true;
        String requiredRole = requesterRole == 'ADMIN' ? 'NON_ADMIN' : 'ADMIN';
        Set<String> approvedAccounts = new Set<String>();
        for (Game_Action_Response__b responseRow : responses) {
            if (responseRow.Response__c == 'APPROVE' &&
                responseRow.Account_Id__c != requesterId &&
                responseRow.Eligibility_Role__c == requiredRole) {
                approvedAccounts.add(responseRow.Account_Id__c);
            }
        }
        return !approvedAccounts.isEmpty();
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

    private static String findGameAdmin(Map<String,Participant> participants) {
        Participant first;
        for (Participant p : participants.values()) {
            if (first == null || p.joinSequence < first.joinSequence) first = p;
        }
        return first == null ? null : first.accountId;
    }

    private static String resolveRequesterRole(String boardId, String accountId,
        Map<String,Participant> participants, String gameAdminId, Boolean requireParticipantForBoardAdmin) {
        Boolean isParticipant = participants.containsKey(accountId);
        Boolean isBoardAdmin = isBoardAdmin(boardId, accountId);
        if (accountId == gameAdminId) return 'ADMIN';
        if (isBoardAdmin && (!requireParticipantForBoardAdmin || isParticipant)) return 'ADMIN';
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
            WHERE Game_Id__c = :gameId AND Ticket_Kind__c = 'HUMAN' LIMIT 2000
        ];
        Set<String> operations = new Set<String>();
        for (Ticket__b row : rows) operations.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operations);
        List<Ticket__b> result = new List<Ticket__b>();
        for (Ticket__b row : rows) if (committed.contains(row.Operation_Id__c)) result.add(row);
        return result;
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

    private static void verifyRunningGame(String boardId, String gameId) {
        List<Game__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Status__c
            FROM Game__b WHERE Board_Id__c = :boardId AND Status__c = 'RUNNING' LIMIT 200
        ];
        Set<String> operations = new Set<String>();
        for (Game__b row : rows) if (row.Record_Id__c == gameId) operations.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operations);
        Boolean found = false;
        for (Game__b row : rows) if (row.Record_Id__c == gameId && committed.contains(row.Operation_Id__c)) found = true;
        HousieErrors.require(found, 'The RUNNING game record is not committed yet. Retry finalization.');
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
        result.readyToExecute = command.Status__c == 'COMMITTED';
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
