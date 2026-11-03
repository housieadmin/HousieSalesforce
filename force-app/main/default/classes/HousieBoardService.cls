public without sharing class HousieBoardService {
    public class BoardView {
        @AuraEnabled public String boardId;
        @AuraEnabled public String name;
        @AuraEnabled public String visibility;
        @AuraEnabled public String status;
        @AuraEnabled public String currentGameId;
        @AuraEnabled public String currentGameStatus;
        @AuraEnabled public String membershipStatus;
    }
    public class BoardActionResult {
        @AuraEnabled public String boardId;
        @AuraEnabled public String gameId;
        @AuraEnabled public String status;
        @AuraEnabled public String operationId;
        @AuraEnabled public String message;
    }

    private static Map<String,Object> defaultConfig() {
        List<Object> prizes = new List<Object>{
            new Map<String,Object>{'key'=>'TOP_LINE','weight'=>1},
            new Map<String,Object>{'key'=>'MIDDLE_LINE','weight'=>1},
            new Map<String,Object>{'key'=>'BOTTOM_LINE','weight'=>1},
            new Map<String,Object>{'key'=>'EARLY_FIVE','weight'=>1},
            new Map<String,Object>{'key'=>'FOUR_CORNERS','weight'=>2},
            new Map<String,Object>{'key'=>'FULL_HOUSE','weight'=>4}
        };
        return new Map<String,Object>{
            'minimumHumanParticipants'=>2,
            'maximumHumanTicketsPerAccount'=>2,
            'maximumBots'=>2,
            'ticketEntryFee'=>10,
            'numberCallingIntervalSeconds'=>5,
            'missedCallGraceSeconds'=>300,
            'startPauseResumeRequestExpirySeconds'=>60,
            'cancellationVotingWindowSeconds'=>60,
            'chatRetentionDays'=>3,
            'adminOfflineGraceSeconds'=>90,
            'prizeCategories'=>prizes
        };
    }

    private static HousieOperationService.WriteItem writeItem(String objectName, Map<String,Object> fields) {
        HousieOperationService.WriteItem item = new HousieOperationService.WriteItem();
        item.objectApiName = objectName;
        item.fields = fields;
        return item;
    }

    @AuraEnabled
    public static BoardActionResult createBoard(String accountId, String boardName, String visibility) {
        HousieOperationService.lockForWrite();
        Housie_Account__c owner = HousieSecurity.requireAccount(accountId);
        HousieErrors.require(String.isNotBlank(boardName), 'Board name is required.');
        HousieErrors.require(boardName.trim().length() <= 80, 'Board name cannot exceed 80 characters.');
        String safeVisibility = String.isBlank(visibility) ? 'PRIVATE' : visibility.trim().toUpperCase();
        HousieErrors.require(new Set<String>{'PUBLIC','PRIVATE'}.contains(safeVisibility),
            'Visibility must be PUBLIC or PRIVATE.');

        String boardId = HousieIds.newId();
        String gameId = HousieIds.newId();
        Datetime nowAt = System.now();
        String configJson = JSON.serialize(defaultConfig());
        List<HousieOperationService.WriteItem> writes = new List<HousieOperationService.WriteItem>();

        writes.add(writeItem('Board__b', new Map<String,Object>{
            'Record_Id__c'=>boardId,
            'Name__c'=>boardName.trim(),
            'Visibility__c'=>safeVisibility,
            'Owner_Account_Id__c'=>owner.Account_Key__c,
            'Config__c'=>configJson,
            'Current_Game_Id__c'=>gameId,
            'Status__c'=>'ACTIVE',
            'Created_At__c'=>nowAt,
            'Updated_At__c'=>nowAt
        }));
        writes.add(writeItem('Game__b', new Map<String,Object>{
            'Record_Id__c'=>gameId,
            'Board_Id__c'=>boardId,
            'Status__c'=>'WAITING',
            'Config_Snapshot__c'=>configJson,
            'Event_Sequence__c'=>0,
            'Wallet_Total__c'=>0,
            'Wallet_Obligations__c'=>0,
            'Wallet_Available__c'=>0,
            'Created_At__c'=>nowAt
        }));
        writes.add(writeItem('Board_Member__b', new Map<String,Object>{
            'Record_Id__c'=>HousieIds.newId(),
            'Board_Id__c'=>boardId,
            'Account_Id__c'=>owner.Account_Key__c,
            'Board_Role__c'=>'BOARD_ADMIN',
            'Joined_At__c'=>nowAt,
            'Status__c'=>'ACTIVE'
        }));

        HousieOperationService.OperationResult operation =
            HousieOperationService.executeOperation('CREATE_BOARD', writes);
        return actionResult(boardId, gameId, 'CREATED', operation.operationId,
            'Board created with its initial WAITING game.');
    }

    @AuraEnabled
    public static List<BoardView> listMyBoards(String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        List<Board_Member__b> membershipRows = [
            SELECT Record_Id__c, Operation_Id__c, Board_Id__c, Board_Role__c,
                   Joined_At__c, Left_At__c, Status__c
            FROM Board_Member__b
            WHERE Account_Id__c = :actor.Account_Key__c
            LIMIT 200
        ];

        Set<String> membershipOperationIds = new Set<String>();
        for (Board_Member__b row : membershipRows) {
            if (String.isNotBlank(row.Operation_Id__c)) membershipOperationIds.add(row.Operation_Id__c);
        }
        Set<String> committedMembershipOperations =
            HousieBigObjectStore.committedOperationIds(membershipOperationIds);

        Map<String,MembershipState> latestByBoard = new Map<String,MembershipState>();
        for (Board_Member__b row : membershipRows) {
            if (!committedMembershipOperations.contains(row.Operation_Id__c)) continue;
            Datetime eventAt = row.Status__c == 'LEFT' ? row.Left_At__c : row.Joined_At__c;
            if (eventAt == null) continue;
            MembershipState latest = latestByBoard.get(row.Board_Id__c);
            if (latest == null || eventAt > latest.eventAt) {
                latestByBoard.put(row.Board_Id__c, new MembershipState(
                    row.Status__c, row.Board_Role__c, row.Joined_At__c, eventAt
                ));
            }
        }

        Set<String> activeBoardIds = new Set<String>();
        for (String boardId : latestByBoard.keySet()) {
            if (latestByBoard.get(boardId).status == 'ACTIVE') activeBoardIds.add(boardId);
        }
        if (activeBoardIds.isEmpty()) return new List<BoardView>();

        List<Board__b> boardRows = [
            SELECT Record_Id__c, Operation_Id__c, Name__c, Visibility__c,
                   Owner_Account_Id__c, Current_Game_Id__c, Status__c
            FROM Board__b
            WHERE Visibility__c = 'PUBLIC' AND Record_Id__c IN :activeBoardIds
            LIMIT 200
        ];
        boardRows.addAll([
            SELECT Record_Id__c, Operation_Id__c, Name__c, Visibility__c,
                   Owner_Account_Id__c, Current_Game_Id__c, Status__c
            FROM Board__b
            WHERE Visibility__c = 'PRIVATE' AND Record_Id__c IN :activeBoardIds
            LIMIT 200
        ]);
        List<Game__b> gameRows = [
            SELECT Record_Id__c, Operation_Id__c, Board_Id__c, Status__c
            FROM Game__b
            WHERE Board_Id__c IN :activeBoardIds
            LIMIT 400
        ];

        Set<String> finalOperationIds = new Set<String>();
        for (Board__b board : boardRows) {
            if (String.isNotBlank(board.Operation_Id__c)) finalOperationIds.add(board.Operation_Id__c);
        }
        for (Game__b game : gameRows) {
            if (String.isNotBlank(game.Operation_Id__c)) finalOperationIds.add(game.Operation_Id__c);
        }
        Set<String> committedFinalOperations = HousieBigObjectStore.committedOperationIds(finalOperationIds);

        Map<String,Board__b> boardsById = new Map<String,Board__b>();
        for (Board__b board : boardRows) {
            if (committedFinalOperations.contains(board.Operation_Id__c)) {
                boardsById.put(board.Record_Id__c, board);
            }
        }
        Map<String,Game__b> gamesById = new Map<String,Game__b>();
        for (Game__b game : gameRows) {
            if (committedFinalOperations.contains(game.Operation_Id__c)) {
                gamesById.put(game.Record_Id__c, game);
            }
        }

        List<BoardView> result = new List<BoardView>();
        for (String boardId : activeBoardIds) {
            Board__b board = boardsById.get(boardId);
            if (board == null) continue;
            BoardView view = toView(board);
            view.membershipStatus = 'ACTIVE';
            Game__b game = gamesById.get(board.Current_Game_Id__c);
            if (game != null && game.Board_Id__c == board.Record_Id__c) {
                view.currentGameStatus = game.Status__c;
            }
            result.add(view);
        }
        return result;
    }

    @AuraEnabled
    public static List<BoardView> listPublicBoards() {
        List<Board__b> boardRows = [
            SELECT Record_Id__c, Operation_Id__c, Name__c, Visibility__c,
                   Current_Game_Id__c, Status__c
            FROM Board__b
            WHERE Visibility__c = 'PUBLIC'
            LIMIT 200
        ];

        Set<String> operationIds = new Set<String>();
        Set<String> publicBoardIds = new Set<String>();
        for (Board__b board : boardRows) {
            if (String.isNotBlank(board.Operation_Id__c)) operationIds.add(board.Operation_Id__c);
            if (board.Status__c == 'ACTIVE') publicBoardIds.add(board.Record_Id__c);
        }
        if (publicBoardIds.isEmpty()) return new List<BoardView>();

        List<Game__b> gameRows = [
            SELECT Record_Id__c, Operation_Id__c, Board_Id__c, Status__c
            FROM Game__b
            WHERE Board_Id__c IN :publicBoardIds
            LIMIT 400
        ];
        for (Game__b game : gameRows) {
            if (String.isNotBlank(game.Operation_Id__c)) operationIds.add(game.Operation_Id__c);
        }
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operationIds);

        Map<String,Game__b> gamesById = new Map<String,Game__b>();
        for (Game__b game : gameRows) {
            if (committed.contains(game.Operation_Id__c)) gamesById.put(game.Record_Id__c, game);
        }
        List<BoardView> result = new List<BoardView>();
        for (Board__b board : boardRows) {
            if (board.Status__c != 'ACTIVE' || !committed.contains(board.Operation_Id__c)) continue;
            BoardView view = toView(board);
            Game__b game = gamesById.get(board.Current_Game_Id__c);
            if (game != null && game.Board_Id__c == board.Record_Id__c) {
                view.currentGameStatus = game.Status__c;
            }
            result.add(view);
        }
        return result;
    }

    @AuraEnabled
    public static BoardActionResult joinBoard(String boardId, String accountId) {
        HousieOperationService.lockForWrite();
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        Board__b board = loadBoard(boardId);
        HousieErrors.require(board.Status__c == 'ACTIVE', 'This board is not accepting members.');
        MembershipState current = currentMembership(boardId, actor.Account_Key__c);
        if (current != null && current.status == 'ACTIVE') {
            return actionResult(boardId, board.Current_Game_Id__c, 'ALREADY_MEMBER', null,
                'You are already a member of this board.');
        }

        Datetime nowAt = System.now();
        HousieOperationService.WriteItem membership = writeItem('Board_Member__b', new Map<String,Object>{
            'Record_Id__c'=>HousieIds.newId(),
            'Board_Id__c'=>boardId,
            'Account_Id__c'=>actor.Account_Key__c,
            'Board_Role__c'=>'MEMBER',
            'Joined_At__c'=>nowAt,
            'Status__c'=>'ACTIVE'
        });
        HousieOperationService.OperationResult operation =
            HousieOperationService.executeOperation('JOIN_BOARD', new List<HousieOperationService.WriteItem>{membership});
        return actionResult(boardId, board.Current_Game_Id__c, 'JOINED', operation.operationId,
            'You joined the board.');
    }

    @AuraEnabled
    public static BoardActionResult leaveBoard(String boardId, String accountId) {
        HousieOperationService.lockForWrite();
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        Board__b board = loadBoard(boardId);
        MembershipState current = currentMembership(boardId, actor.Account_Key__c);
        HousieErrors.require(current != null && current.status == 'ACTIVE', 'You are not an active member of this board.');

        Game__b game = findGame(boardId, board.Current_Game_Id__c);
        if (game != null && new Set<String>{'WAITING','RUNNING','PAUSED'}.contains(game.Status__c)) {
            HousieErrors.require(!hasActiveParticipation(game.Record_Id__c, actor.Account_Key__c),
                game.Status__c == 'WAITING'
                    ? 'Withdraw from the waiting game before leaving the board.'
                    : 'You are participating in this game and cannot leave the board.');
        }

        Datetime nowAt = System.now();
        HousieOperationService.WriteItem membership = writeItem('Board_Member__b', new Map<String,Object>{
            'Record_Id__c'=>HousieIds.newId(),
            'Board_Id__c'=>boardId,
            'Account_Id__c'=>actor.Account_Key__c,
            'Board_Role__c'=>current.role,
            'Joined_At__c'=>current.joinedAt,
            'Left_At__c'=>nowAt,
            'Status__c'=>'LEFT'
        });
        HousieOperationService.OperationResult operation =
            HousieOperationService.executeOperation('LEAVE_BOARD', new List<HousieOperationService.WriteItem>{membership});
        return actionResult(boardId, board.Current_Game_Id__c, 'LEFT', operation.operationId,
            'You left the board.');
    }

    private class MembershipState {
        String status;
        String role;
        Datetime joinedAt;
        Datetime eventAt;
        MembershipState(String statusValue, String roleValue, Datetime joinedValue, Datetime eventValue) {
            status = statusValue;
            role = roleValue;
            joinedAt = joinedValue;
            eventAt = eventValue;
        }
    }

    private static MembershipState currentMembership(String boardId, String accountId) {
        List<Board_Member__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Board_Role__c, Joined_At__c, Left_At__c, Status__c
            FROM Board_Member__b
            WHERE Account_Id__c = :accountId AND Board_Id__c = :boardId
            LIMIT 200
        ];
        Set<String> operationIds = new Set<String>();
        for (Board_Member__b row : rows) {
            if (String.isNotBlank(row.Operation_Id__c)) operationIds.add(row.Operation_Id__c);
        }
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operationIds);

        MembershipState latest;
        for (Board_Member__b row : rows) {
            if (!committed.contains(row.Operation_Id__c)) continue;
            Datetime eventAt = row.Status__c == 'LEFT' ? row.Left_At__c : row.Joined_At__c;
            if (eventAt == null) continue;
            if (latest == null || eventAt > latest.eventAt) {
                latest = new MembershipState(row.Status__c, row.Board_Role__c, row.Joined_At__c, eventAt);
            }
        }
        return latest;
    }

    private static Board__b loadBoard(String boardId) {
        HousieErrors.require(String.isNotBlank(boardId), 'Board id is required.');
        List<Board__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Name__c, Visibility__c,
                   Owner_Account_Id__c, Current_Game_Id__c, Status__c
            FROM Board__b
            WHERE Visibility__c = 'PUBLIC' AND Record_Id__c = :boardId
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            rows = [
                SELECT Record_Id__c, Operation_Id__c, Name__c, Visibility__c,
                       Owner_Account_Id__c, Current_Game_Id__c, Status__c
                FROM Board__b
                WHERE Visibility__c = 'PRIVATE' AND Record_Id__c = :boardId
                LIMIT 1
            ];
        }
        HousieErrors.require(!rows.isEmpty(), 'Board not found.');
        HousieErrors.require(HousieBigObjectStore.isCommitted(rows[0].Operation_Id__c),
            'Board creation is not committed.');
        return rows[0];
    }

    private static Game__b findGame(String boardId, String gameId) {
        if (String.isBlank(boardId) || String.isBlank(gameId)) return null;
        List<Game__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Board_Id__c, Status__c
            FROM Game__b
            WHERE Board_Id__c = :boardId
            LIMIT 200
        ];
        Set<String> operationIds = new Set<String>();
        for (Game__b row : rows) {
            if (String.isNotBlank(row.Operation_Id__c)) operationIds.add(row.Operation_Id__c);
        }
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operationIds);
        for (Game__b row : rows) {
            if (row.Record_Id__c == gameId && committed.contains(row.Operation_Id__c)) return row;
        }
        return null;
    }

    private static Boolean hasActiveParticipation(String gameId, String accountId) {
        // The participant record is the authoritative human participation marker.
        List<Game_Participant__b> participants = [
            SELECT Record_Id__c, Operation_Id__c, Withdrawn_At__c, Status__c
            FROM Game_Participant__b
            WHERE Game_Id__c = :gameId AND Account_Id__c = :accountId
            LIMIT 10
        ];

        // Only two bot tickets are allowed by the confirmed initial config. Query them
        // through the Ticket composite index (Game, Ticket Kind, Record Id).
        List<Ticket__b> botTickets = [
            SELECT Record_Id__c, Operation_Id__c, Status__c
            FROM Ticket__b
            WHERE Game_Id__c = :gameId AND Ticket_Kind__c = 'BOT'
            LIMIT 200
        ];
        Set<String> botTicketIds = new Set<String>();
        Set<String> operationIds = new Set<String>();
        for (Game_Participant__b participant : participants) {
            if (String.isNotBlank(participant.Operation_Id__c)) operationIds.add(participant.Operation_Id__c);
        }
        for (Ticket__b ticket : botTickets) {
            if (String.isNotBlank(ticket.Operation_Id__c)) operationIds.add(ticket.Operation_Id__c);
            if (ticket.Status__c == 'ACTIVE') botTicketIds.add(ticket.Record_Id__c);
        }

        List<Bot_Contribution__b> contributions = new List<Bot_Contribution__b>();
        if (!botTicketIds.isEmpty()) {
            contributions = [
                SELECT Record_Id__c, Operation_Id__c, Contributor_Account_Id__c,
                       Current_Hold_Amount__c, Captured_Amount__c, Status__c
                FROM Bot_Contribution__b
                WHERE Ticket_Id__c IN :botTicketIds
                LIMIT 2000
            ];
            for (Bot_Contribution__b contribution : contributions) {
                if (String.isNotBlank(contribution.Operation_Id__c)) operationIds.add(contribution.Operation_Id__c);
            }
        }

        Set<String> committed = HousieBigObjectStore.committedOperationIds(operationIds);
        for (Game_Participant__b participant : participants) {
            if (committed.contains(participant.Operation_Id__c) &&
                participant.Status__c == 'ACTIVE' && participant.Withdrawn_At__c == null) return true;
        }
        for (Bot_Contribution__b contribution : contributions) {
            if (contribution.Contributor_Account_Id__c != accountId ||
                !committed.contains(contribution.Operation_Id__c) ||
                contribution.Status__c == 'RELEASED' || contribution.Status__c == 'CANCELLED') continue;
            Boolean hasActiveHold = contribution.Current_Hold_Amount__c != null &&
                contribution.Current_Hold_Amount__c > 0;
            Boolean hasCapturedFunds = contribution.Captured_Amount__c != null &&
                contribution.Captured_Amount__c > 0;
            if (hasActiveHold || hasCapturedFunds) return true;
        }
        return false;
    }

    private static BoardView toView(Board__b board) {
        BoardView view = new BoardView();
        view.boardId = board.Record_Id__c;
        view.name = board.Name__c;
        view.visibility = board.Visibility__c;
        view.status = board.Status__c;
        view.currentGameId = board.Current_Game_Id__c;
        return view;
    }

    private static BoardActionResult actionResult(String boardId, String gameId, String status,
                                                   String operationId, String message) {
        BoardActionResult result = new BoardActionResult();
        result.boardId = boardId;
        result.gameId = gameId;
        result.status = status;
        result.operationId = operationId;
        result.message = message;
        return result;
    }
}