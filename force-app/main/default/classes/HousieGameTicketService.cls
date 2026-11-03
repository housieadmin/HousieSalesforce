public without sharing class HousieGameTicketService {
    public class TicketView {
        @AuraEnabled public String ticketId { get; set; }
        @AuraEnabled public String mode { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public Decimal entryFee { get; set; }
        @AuraEnabled public String layoutText { get; set; }
    }
    public class TicketActionResult {
        @AuraEnabled public String ticketId { get; set; }
        @AuraEnabled public String mode { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public Decimal entryFee { get; set; }
        @AuraEnabled public String message { get; set; }
        @AuraEnabled public String layoutText { get; set; }
    }
    private class GameContext {
        Board__b boardRow;
        Game__b gameRow;
        Map<String,Object> config;
    }
    private class ParticipantState {
        String status;
        Decimal joinSequence;
        Datetime joinedAt;
        Datetime eventAt;
    }

    @AuraEnabled(cacheable=true)
    public static List<TicketView> listMyTickets(String boardId, String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        GameContext context = loadCurrentGame(boardId);
        requireMember(boardId, actor.Account_Key__c);
        Set<String> withdrawn = withdrawnTicketIds(context.gameRow.Record_Id__c);
        List<Ticket__b> rows = loadCommittedHumanTickets(context.gameRow.Record_Id__c);
        List<TicketView> result = new List<TicketView>();
        for (Ticket__b row : rows) {
            if (row.Owner_Account_Id__c != actor.Account_Key__c ||
                row.Status__c != 'ACTIVE' || withdrawn.contains(row.Record_Id__c)) continue;
            TicketView view = new TicketView();
            view.ticketId = row.Record_Id__c;
            view.mode = row.Mode__c;
            view.status = 'ACTIVE';
            view.entryFee = row.Entry_Fee__c;
            List<List<Integer>> layout = (List<List<Integer>>)JSON.deserialize(
                row.Layout__c, List<List<Integer>>.class
            );
            view.layoutText = HousieTicketGenerator.layoutText(layout);
            result.add(view);
        }
        return result;
    }

    @AuraEnabled
    public static TicketActionResult purchaseTicket(
        String boardId, String accountId, String mode, String requestId
    ) {
        HousieOperationService.lockForWrite();
        Housie_Account__c actor = lockAccount(accountId);
        GameContext context = loadCurrentGame(boardId);
        requireMember(boardId, actor.Account_Key__c);
        HousieErrors.require(context.gameRow.Status__c == 'WAITING',
            'Tickets can only be purchased while the game is waiting.');
        HousieErrors.require(String.isNotBlank(requestId) && requestId.length() <= 120,
            'A valid ticket purchase request id is required.');

        String safeMode = String.isBlank(mode) ? 'MANUAL' : mode.trim().toUpperCase();
        HousieErrors.require(new Set<String>{'MANUAL','AUTOMATIC'}.contains(safeMode),
            'Ticket mode must be MANUAL or AUTOMATIC.');

        String ticketId = HousieIds.stableId('HUMAN_TICKET',
            context.gameRow.Record_Id__c + ':' + actor.Account_Key__c + ':' + requestId);
        List<Ticket__b> priorRows = [
            SELECT Record_Id__c, Operation_Id__c, Owner_Account_Id__c, Mode__c, Layout__c,
                   Status__c, Entry_Fee__c
            FROM Ticket__b
            WHERE Game_Id__c = :context.gameRow.Record_Id__c
              AND Ticket_Kind__c = 'HUMAN'
              AND Record_Id__c = :ticketId
            LIMIT 1
        ];
        if (!priorRows.isEmpty() &&
            priorRows[0].Owner_Account_Id__c == actor.Account_Key__c &&
            HousieBigObjectStore.isCommitted(priorRows[0].Operation_Id__c)) {
            return actionResultFromTicket(priorRows[0], withdrawnTicketIds(context.gameRow.Record_Id__c));
        }

        Decimal fee = decimalConfig(context.config, 'ticketEntryFee', 10);
        Integer maximumTickets = integerConfig(context.config, 'maximumHumanTicketsPerAccount', 2);
        HousieErrors.require(fee > 0 && maximumTickets > 0,
            'The current game ticket configuration is invalid.');

        List<Ticket__b> existingTickets = loadCommittedHumanTickets(context.gameRow.Record_Id__c);
        Set<String> withdrawn = withdrawnTicketIds(context.gameRow.Record_Id__c);
        Integer activeCount = 0;
        Set<String> usedLayouts = new Set<String>();
        for (Ticket__b ticket : existingTickets) {
            if (String.isNotBlank(ticket.Layout__c)) usedLayouts.add(ticket.Layout__c);
            if (ticket.Status__c == 'ACTIVE' && !withdrawn.contains(ticket.Record_Id__c) &&
                ticket.Owner_Account_Id__c == actor.Account_Key__c) activeCount++;
        }
        HousieErrors.require(activeCount < maximumTickets,
            'You have reached the maximum number of tickets for this game.');
        HousieErrors.require(HousieDomainRules.availablePoints(actor) >= fee,
            'Not enough available points to reserve this ticket.');

        List<List<Integer>> layout;
        String layoutJson;
        for (Integer attempt = 0; attempt < 20; attempt++) {
            layout = HousieTicketGenerator.generateLayout();
            layoutJson = JSON.serialize(layout);
            if (!usedLayouts.contains(layoutJson)) break;
            layout = null;
        }
        HousieErrors.require(layout != null, 'Could not generate a unique ticket. Please retry.');

        if (safeMode == 'AUTOMATIC') {
            HousieErrors.require(actor.Auto_Mode_Tokens__c != null && actor.Auto_Mode_Tokens__c >= 1,
                'You do not have an auto-mode token available.');
            actor.Auto_Mode_Tokens__c -= 1;
        }

        String holdId = HousieIds.stableId('HUMAN_TICKET_HOLD', ticketId);
        Datetime nowAt = System.now();
        actor.Reserved_Points__c = (actor.Reserved_Points__c == null ? 0 : actor.Reserved_Points__c) + fee;
        HousieDomainRules.assertWalletInvariant(actor);
        update actor;

        List<HousieOperationService.WriteItem> writes = new List<HousieOperationService.WriteItem>();
        writes.add(writeItem('Ticket__b', new Map<String,Object>{
            'Record_Id__c' => ticketId,
            'Game_Id__c' => context.gameRow.Record_Id__c,
            'Ticket_Kind__c' => 'HUMAN',
            'Owner_Account_Id__c' => actor.Account_Key__c,
            'Mode__c' => safeMode,
            'Layout__c' => layoutJson,
            'Marked_Numbers__c' => '[]',
            'Status__c' => 'ACTIVE',
            'Entry_Fee__c' => fee,
            'Wallet_Hold_Id__c' => holdId,
            'Created_At__c' => nowAt,
            'Purchased_At__c' => nowAt
        }));
        writes.add(writeItem('Wallet_Hold__b', new Map<String,Object>{
            'Record_Id__c' => holdId,
            'Hold_Id__c' => holdId,
            'Account_Id__c' => actor.Account_Key__c,
            'Game_Id__c' => context.gameRow.Record_Id__c,
            'Source_Type__c' => 'HUMAN_TICKET',
            'Source_Id__c' => ticketId,
            'Amount__c' => fee,
            'Status__c' => 'ACTIVE',
            'Created_At__c' => nowAt,
            'Updated_At__c' => nowAt
        }));
        writes.add(resourceTransaction(actor.Account_Key__c, 'POINTS', 'HOLD_RESERVE', fee,
            'HUMAN_TICKET', ticketId, 'TICKET_HOLD:' + holdId));
        if (safeMode == 'AUTOMATIC') {
            writes.add(resourceTransaction(actor.Account_Key__c, 'AUTO_MODE_TOKEN', 'SPEND', -1,
                'HUMAN_TICKET', ticketId, 'TICKET_AUTO_TOKEN:' + ticketId));
        }

        ParticipantState participant = currentParticipant(context.gameRow.Record_Id__c, actor.Account_Key__c);
        if (participant == null || participant.status != 'ACTIVE') {
            Boolean isFirstActiveParticipant = !hasActiveHumanParticipants(context.gameRow.Record_Id__c);
            writes.add(writeItem('Game_Participant__b', new Map<String,Object>{
                'Record_Id__c' => HousieIds.newId(),
                'Game_Id__c' => context.gameRow.Record_Id__c,
                'Account_Id__c' => actor.Account_Key__c,
                'Join_Sequence__c' => nowAt.getTime(),
                'Joined_At__c' => nowAt,
                'Status__c' => 'ACTIVE'
            }));
            if (isFirstActiveParticipant) {
                writes.add(gameEvent(context.gameRow.Record_Id__c, actor.Account_Key__c, 'GAME_ADMIN_ASSIGNED',
                    new Map<String,Object>{
                        'adminAccountId' => actor.Account_Key__c,
                        'reason' => 'FIRST_ELIGIBLE_PARTICIPANT'
                    }, nowAt.addMilliseconds(1)));
            }
        }
        writes.add(gameEvent(context.gameRow.Record_Id__c, actor.Account_Key__c, 'TICKET_PURCHASED',
            new Map<String,Object>{'ticketId' => ticketId, 'mode' => safeMode, 'entryFee' => fee}, nowAt));
        HousieOperationService.executeOperation('PURCHASE_HUMAN_TICKET', writes);

        TicketActionResult result = new TicketActionResult();
        result.ticketId = ticketId;
        result.mode = safeMode;
        result.status = 'ACTIVE';
        result.entryFee = fee;
        result.layoutText = HousieTicketGenerator.layoutText(layout);
        result.message = 'Ticket purchased. ' + String.valueOf(fee) +
            ' points are reserved until the game starts or you withdraw.';
        return result;
    }

    @AuraEnabled
    public static TicketActionResult withdrawFromWaitingGame(String boardId, String accountId) {
        HousieOperationService.lockForWrite();
        Housie_Account__c actor = lockAccount(accountId);
        GameContext context = loadCurrentGame(boardId);
        requireMember(boardId, actor.Account_Key__c);
        HousieErrors.require(context.gameRow.Status__c == 'WAITING',
            'You can only withdraw before the game starts.');

        Set<String> withdrawn = withdrawnTicketIds(context.gameRow.Record_Id__c);
        List<Ticket__b> allTickets = loadCommittedHumanTickets(context.gameRow.Record_Id__c);
        List<Ticket__b> mine = new List<Ticket__b>();
        for (Ticket__b ticket : allTickets) {
            if (ticket.Owner_Account_Id__c == actor.Account_Key__c &&
                ticket.Status__c == 'ACTIVE' && !withdrawn.contains(ticket.Record_Id__c)) mine.add(ticket);
        }
        HousieErrors.require(!mine.isEmpty(), 'You do not have an active ticket in this game.');

        Map<String,Wallet_Hold__b> latestHolds = loadLatestHolds(
            context.gameRow.Record_Id__c, actor.Account_Key__c
        );
        Datetime nowAt = System.now();
        Decimal releaseTotal = 0;
        List<HousieOperationService.WriteItem> writes = new List<HousieOperationService.WriteItem>();
        for (Ticket__b ticket : mine) {
            Wallet_Hold__b hold = latestHolds.get(ticket.Wallet_Hold_Id__c);
            HousieErrors.require(hold != null && hold.Status__c == 'ACTIVE',
                'An active ticket wallet hold is missing or already released.');
            Decimal amount = hold.Amount__c == null ? 0 : hold.Amount__c;
            releaseTotal += amount;
            writes.add(writeItem('Wallet_Hold__b', new Map<String,Object>{
                'Record_Id__c' => HousieIds.newId(),
                'Hold_Id__c' => hold.Hold_Id__c,
                'Account_Id__c' => actor.Account_Key__c,
                'Game_Id__c' => context.gameRow.Record_Id__c,
                'Source_Type__c' => 'HUMAN_TICKET',
                'Source_Id__c' => ticket.Record_Id__c,
                'Amount__c' => amount,
                'Status__c' => 'RELEASED',
                'Created_At__c' => hold.Created_At__c,
                'Updated_At__c' => nowAt,
                'Released_At__c' => nowAt
            }));
            writes.add(resourceTransaction(actor.Account_Key__c, 'POINTS', 'HOLD_RELEASE', -amount,
                'HUMAN_TICKET', ticket.Record_Id__c, 'TICKET_HOLD_RELEASE:' + ticket.Wallet_Hold_Id__c));
            writes.add(gameEvent(context.gameRow.Record_Id__c, actor.Account_Key__c, 'TICKET_WITHDRAWN',
                new Map<String,Object>{'ticketId' => ticket.Record_Id__c}, nowAt));
        }
        actor.Reserved_Points__c = (actor.Reserved_Points__c == null ? 0 : actor.Reserved_Points__c) - releaseTotal;
        HousieDomainRules.assertWalletInvariant(actor);

        ParticipantState participant = currentParticipant(context.gameRow.Record_Id__c, actor.Account_Key__c);
        if (participant != null && participant.status == 'ACTIVE') {
            writes.add(writeItem('Game_Participant__b', new Map<String,Object>{
                'Record_Id__c' => HousieIds.newId(),
                'Game_Id__c' => context.gameRow.Record_Id__c,
                'Account_Id__c' => actor.Account_Key__c,
                'Join_Sequence__c' => participant.joinSequence,
                'Joined_At__c' => participant.joinedAt,
                'Withdrawn_At__c' => nowAt,
                'Status__c' => 'WITHDRAWN'
            }));
        }
        update actor;
        HousieOperationService.executeOperation('WITHDRAW_FROM_WAITING_GAME', writes);

        TicketActionResult result = new TicketActionResult();
        result.status = 'WITHDRAWN';
        result.entryFee = releaseTotal;
        result.message = 'Withdrawn from the waiting game. All ticket holds were released; points are available again.';
        return result;
    }

    private static TicketActionResult actionResultFromTicket(
        Ticket__b ticket, Set<String> withdrawnTicketIds
    ) {
        TicketActionResult result = new TicketActionResult();
        result.ticketId = ticket.Record_Id__c;
        result.mode = ticket.Mode__c;
        result.entryFee = ticket.Entry_Fee__c;
        result.status = withdrawnTicketIds.contains(ticket.Record_Id__c) ? 'WITHDRAWN' : ticket.Status__c;
        result.message = result.status == 'WITHDRAWN'
            ? 'This ticket purchase was already completed and subsequently withdrawn.'
            : 'This ticket purchase was already completed.';
        List<List<Integer>> layout = (List<List<Integer>>)JSON.deserialize(
            ticket.Layout__c, List<List<Integer>>.class
        );
        result.layoutText = HousieTicketGenerator.layoutText(layout);
        return result;
    }

    private static Housie_Account__c lockAccount(String accountId) {
        HousieErrors.require(String.isNotBlank(accountId), 'Account context is required.');
        List<Housie_Account__c> rows = [
            SELECT Id, Account_Key__c, Points_Balance__c, Reserved_Points__c,
                   Auto_Mode_Tokens__c, Status__c
            FROM Housie_Account__c
            WHERE Account_Key__c = :accountId
            LIMIT 1
            FOR UPDATE
        ];
        HousieErrors.require(!rows.isEmpty(), 'Account not found.');
        HousieErrors.require(rows[0].Status__c == 'ACTIVE', 'Account is not active.');
        return rows[0];
    }

    private static GameContext loadCurrentGame(String boardId) {
        HousieErrors.require(String.isNotBlank(boardId), 'Board id is required.');
        List<Board__b> boards = [
            SELECT Record_Id__c, Operation_Id__c, Current_Game_Id__c, Status__c, Visibility__c
            FROM Board__b
            WHERE Visibility__c = 'PUBLIC' AND Record_Id__c = :boardId
            LIMIT 1
        ];
        if (boards.isEmpty()) {
            boards = [
                SELECT Record_Id__c, Operation_Id__c, Current_Game_Id__c, Status__c, Visibility__c
                FROM Board__b
                WHERE Visibility__c = 'PRIVATE' AND Record_Id__c = :boardId
                LIMIT 1
            ];
        }
        HousieErrors.require(!boards.isEmpty() && boards[0].Status__c == 'ACTIVE', 'Active board not found.');
        HousieErrors.require(HousieBigObjectStore.isCommitted(boards[0].Operation_Id__c),
            'Board creation is not committed.');

        List<Game__b> games = [
            SELECT Record_Id__c, Operation_Id__c, Board_Id__c, Status__c, Config_Snapshot__c
            FROM Game__b
            WHERE Board_Id__c = :boardId
            LIMIT 200
        ];
        Set<String> gameOperationIds = new Set<String>();
        for (Game__b game : games) {
            if (String.isNotBlank(game.Operation_Id__c)) gameOperationIds.add(game.Operation_Id__c);
        }
        Set<String> committed = HousieBigObjectStore.committedOperationIds(gameOperationIds);
        Game__b currentGame;
        for (Game__b game : games) {
            if (game.Record_Id__c == boards[0].Current_Game_Id__c &&
                committed.contains(game.Operation_Id__c)) currentGame = game;
        }
        HousieErrors.require(currentGame != null, 'The current game could not be found.');
        GameContext context = new GameContext();
        context.boardRow = boards[0];
        context.gameRow = currentGame;
        context.config = String.isBlank(currentGame.Config_Snapshot__c)
            ? new Map<String,Object>() : (Map<String,Object>)JSON.deserializeUntyped(currentGame.Config_Snapshot__c);
        return context;
    }

    private static void requireMember(String boardId, String accountKey) {
        List<Board_Member__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Board_Role__c, Joined_At__c, Left_At__c, Status__c
            FROM Board_Member__b
            WHERE Account_Id__c = :accountKey AND Board_Id__c = :boardId
            LIMIT 200
        ];
        Set<String> operations = new Set<String>();
        for (Board_Member__b row : rows) operations.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operations);
        Datetime latestAt;
        String latestStatus;
        for (Board_Member__b row : rows) {
            if (!committed.contains(row.Operation_Id__c)) continue;
            Datetime eventAt = row.Status__c == 'LEFT' ? row.Left_At__c : row.Joined_At__c;
            if (eventAt != null && (latestAt == null || eventAt > latestAt)) {
                latestAt = eventAt;
                latestStatus = row.Status__c;
            }
        }
        HousieErrors.require(latestStatus == 'ACTIVE', 'Join this board before purchasing a ticket.');
    }

    private static ParticipantState currentParticipant(String gameId, String accountKey) {
        List<Game_Participant__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Join_Sequence__c, Joined_At__c, Withdrawn_At__c, Status__c
            FROM Game_Participant__b
            WHERE Game_Id__c = :gameId AND Account_Id__c = :accountKey
            LIMIT 200
        ];
        Set<String> operationIds = new Set<String>();
        for (Game_Participant__b row : rows) operationIds.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operationIds);
        ParticipantState latest;
        for (Game_Participant__b row : rows) {
            if (!committed.contains(row.Operation_Id__c)) continue;
            Datetime eventAt = row.Status__c == 'WITHDRAWN' ? row.Withdrawn_At__c : row.Joined_At__c;
            if (eventAt == null) continue;
            if (latest == null || eventAt > latest.eventAt) {
                latest = new ParticipantState();
                latest.status = row.Status__c;
                latest.joinSequence = row.Join_Sequence__c;
                latest.joinedAt = row.Joined_At__c;
                latest.eventAt = eventAt;
            }
        }
        return latest;
    }

    private static Boolean hasActiveHumanParticipants(String gameId) {
        List<Game_Participant__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Account_Id__c, Joined_At__c, Withdrawn_At__c, Status__c
            FROM Game_Participant__b
            WHERE Game_Id__c = :gameId
            LIMIT 2000
        ];
        Set<String> operationIds = new Set<String>();
        for (Game_Participant__b row : rows) operationIds.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operationIds);
        Map<String,ParticipantState> latestByAccount = new Map<String,ParticipantState>();
        for (Game_Participant__b row : rows) {
            if (!committed.contains(row.Operation_Id__c)) continue;
            Datetime eventAt = row.Status__c == 'WITHDRAWN' ? row.Withdrawn_At__c : row.Joined_At__c;
            if (eventAt == null) continue;
            ParticipantState prior = latestByAccount.get(row.Account_Id__c);
            if (prior == null || eventAt > prior.eventAt) {
                ParticipantState current = new ParticipantState();
                current.status = row.Status__c;
                current.joinedAt = row.Joined_At__c;
                current.eventAt = eventAt;
                latestByAccount.put(row.Account_Id__c, current);
            }
        }
        for (ParticipantState participant : latestByAccount.values()) {
            if (participant.status == 'ACTIVE') return true;
        }
        return false;
    }

    private static List<Ticket__b> loadCommittedHumanTickets(String gameId) {
        List<Ticket__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Owner_Account_Id__c, Mode__c, Layout__c,
                   Status__c, Entry_Fee__c, Wallet_Hold_Id__c
            FROM Ticket__b
            WHERE Game_Id__c = :gameId AND Ticket_Kind__c = 'HUMAN'
            LIMIT 2000
        ];
        Set<String> ids = new Set<String>();
        for (Ticket__b row : rows) ids.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(ids);
        List<Ticket__b> result = new List<Ticket__b>();
        for (Ticket__b row : rows) if (committed.contains(row.Operation_Id__c)) result.add(row);
        return result;
    }

    private static Set<String> withdrawnTicketIds(String gameId) {
        List<Game_Event__b> events = [
            SELECT Record_Id__c, Operation_Id__c, Event_Type__c, Payload__c
            FROM Game_Event__b
            WHERE Game_Id__c = :gameId
            LIMIT 2000
        ];
        Set<String> operationIds = new Set<String>();
        for (Game_Event__b eventRow : events) operationIds.add(eventRow.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operationIds);
        Set<String> withdrawn = new Set<String>();
        for (Game_Event__b eventRow : events) {
            if (eventRow.Event_Type__c != 'TICKET_WITHDRAWN' ||
                !committed.contains(eventRow.Operation_Id__c) || String.isBlank(eventRow.Payload__c)) continue;
            Map<String,Object> payload = (Map<String,Object>)JSON.deserializeUntyped(eventRow.Payload__c);
            if (payload != null && payload.containsKey('ticketId')) {
                withdrawn.add(String.valueOf(payload.get('ticketId')));
            }
        }
        return withdrawn;
    }

    private static Map<String,Wallet_Hold__b> loadLatestHolds(String gameId, String accountKey) {
        List<Wallet_Hold__b> rows = [
            SELECT Record_Id__c, Operation_Id__c, Hold_Id__c, Source_Id__c, Amount__c,
                   Status__c, Created_At__c, Updated_At__c
            FROM Wallet_Hold__b
            WHERE Account_Id__c = :accountKey AND Game_Id__c = :gameId
            LIMIT 2000
        ];
        Set<String> operationIds = new Set<String>();
        for (Wallet_Hold__b row : rows) operationIds.add(row.Operation_Id__c);
        Set<String> committed = HousieBigObjectStore.committedOperationIds(operationIds);
        Map<String,Wallet_Hold__b> latest = new Map<String,Wallet_Hold__b>();
        for (Wallet_Hold__b row : rows) {
            if (!committed.contains(row.Operation_Id__c)) continue;
            Wallet_Hold__b prior = latest.get(row.Hold_Id__c);
            if (prior == null || (row.Updated_At__c != null &&
                (prior.Updated_At__c == null || row.Updated_At__c > prior.Updated_At__c))) {
                latest.put(row.Hold_Id__c, row);
            }
        }
        return latest;
    }

    private static Decimal decimalConfig(Map<String,Object> config, String key, Decimal fallback) {
        if (config == null || !config.containsKey(key) || config.get(key) == null) return fallback;
        return Decimal.valueOf(String.valueOf(config.get(key)));
    }
    private static Integer integerConfig(Map<String,Object> config, String key, Integer fallback) {
        if (config == null || !config.containsKey(key) || config.get(key) == null) return fallback;
        return Integer.valueOf(String.valueOf(config.get(key)));
    }

    private static HousieOperationService.WriteItem resourceTransaction(
        String accountKey, String resource, String type, Decimal quantity,
        String sourceType, String sourceId, String idempotencyKey
    ) {
        return writeItem('Account_Resource_Transaction__b', new Map<String,Object>{
            'Record_Id__c' => HousieIds.newId(),
            'Account_Id__c' => accountKey,
            'Resource_Type__c' => resource,
            'Transaction_Type__c' => type,
            'Quantity__c' => quantity,
            'Source_Type__c' => sourceType,
            'Source_Id__c' => sourceId,
            'Idempotency_Key__c' => HousieIds.stableId('RESOURCE_TX', idempotencyKey),
            'Created_At__c' => System.now(),
            'Metadata__c' => '{}'
        });
    }

    private static HousieOperationService.WriteItem gameEvent(
        String gameId, String actorId, String type, Map<String,Object> payload, Datetime eventAt
    ) {
        return writeItem('Game_Event__b', new Map<String,Object>{
            'Record_Id__c' => HousieIds.newId(),
            'Game_Id__c' => gameId,
            'Sequence__c' => eventAt.getTime(),
            'Event_Type__c' => type,
            'Actor_Account_Id__c' => actorId,
            'Payload__c' => JSON.serialize(payload),
            'Created_At__c' => eventAt
        });
    }

    private static HousieOperationService.WriteItem writeItem(String objectName, Map<String,Object> fields) {
        HousieOperationService.WriteItem item = new HousieOperationService.WriteItem();
        item.objectApiName = objectName;
        item.fields = fields;
        return item;
    }
}