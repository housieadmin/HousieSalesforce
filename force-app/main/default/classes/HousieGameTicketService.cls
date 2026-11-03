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
        @AuraEnabled public String requestId { get; set; }
        @AuraEnabled public String boardId { get; set; }
        @AuraEnabled public String actionType { get; set; }
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

    @AuraEnabled
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
    public static TicketActionResult prepareTicketPurchase(
        String boardId, String accountId, String mode, String requestId
    ) {
        HousieOperationService.lockForWrite();
        Housie_Account__c actor = lockAccount(accountId);
        GameContext context = loadCurrentGame(boardId);
        requireMember(boardId, actor.Account_Key__c);
        HousieErrors.require(String.isNotBlank(requestId) && requestId.length() <= 120,
            'A valid ticket purchase request id is required.');

        String safeMode = String.isBlank(mode) ? 'MANUAL' : mode.trim().toUpperCase();
        HousieErrors.require(new Set<String>{'MANUAL','AUTOMATIC'}.contains(safeMode),
            'Ticket mode must be MANUAL or AUTOMATIC.');
        String ticketId = HousieIds.stableId('HUMAN_TICKET',
            context.gameRow.Record_Id__c + ':' + actor.Account_Key__c + ':' + requestId);

        List<Housie_Ticket_Command__c> priorCommands = [
            SELECT Request_Key__c, Account_Key__c, Board_Id__c, Game_Id__c,
                   Action_Type__c, Ticket_Id__c, Hold_Id__c, Mode__c,
                   Entry_Fee__c, Layout__c, Status__c
            FROM Housie_Ticket_Command__c
            WHERE Request_Key__c = :ticketId
            LIMIT 1
        ];
        if (!priorCommands.isEmpty()) {
            Housie_Ticket_Command__c prior = priorCommands[0];
            HousieErrors.require(prior.Account_Key__c == actor.Account_Key__c &&
                prior.Board_Id__c == boardId && prior.Mode__c == safeMode,
                'This purchase request id was already used for a different request.');
            return actionResultFromCommand(prior);
        }
        HousieErrors.require(context.gameRow.Status__c == 'WAITING',
            'Tickets can only be purchased while the game is waiting.');

        List<Ticket__b> existingById = [
            SELECT Record_Id__c, Operation_Id__c, Owner_Account_Id__c, Mode__c, Layout__c,
                   Status__c, Entry_Fee__c, Wallet_Hold_Id__c
            FROM Ticket__b
            WHERE Game_Id__c = :context.gameRow.Record_Id__c
              AND Ticket_Kind__c = 'HUMAN'
              AND Record_Id__c = :ticketId
            LIMIT 1
        ];
        if (!existingById.isEmpty() &&
            existingById[0].Owner_Account_Id__c == actor.Account_Key__c &&
            HousieBigObjectStore.isCommitted(existingById[0].Operation_Id__c)) {
            return actionResultFromTicket(existingById[0], withdrawnTicketIds(context.gameRow.Record_Id__c));
        }

        acquireGameCommandLock(context.gameRow.Record_Id__c, ticketId);

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

        List<Housie_Ticket_Command__c> pendingForAccount = [
            SELECT Layout__c
            FROM Housie_Ticket_Command__c
            WHERE Game_Id__c = :context.gameRow.Record_Id__c
              AND Account_Key__c = :actor.Account_Key__c
              AND Action_Type__c = 'PURCHASE'
              AND Status__c = 'PREPARED'
            LIMIT 200
        ];
        activeCount += pendingForAccount.size();
        for (Housie_Ticket_Command__c pending : pendingForAccount) {
            if (String.isNotBlank(pending.Layout__c)) usedLayouts.add(pending.Layout__c);
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

        // This request deliberately performs DML only. The client invokes
        // commitTicketCommand in a new Apex transaction for all insertImmediate calls.
        Housie_Ticket_Command__c command = new Housie_Ticket_Command__c(
            Request_Key__c = ticketId,
            Account_Key__c = actor.Account_Key__c,
            Board_Id__c = boardId,
            Game_Id__c = context.gameRow.Record_Id__c,
            Action_Type__c = 'PURCHASE',
            Ticket_Id__c = ticketId,
            Hold_Id__c = holdId,
            Mode__c = safeMode,
            Entry_Fee__c = fee,
            Layout__c = layoutJson,
            Status__c = 'PREPARED',
            Created_At__c = nowAt,
            Updated_At__c = nowAt
        );
        insert command;

        TicketActionResult result = new TicketActionResult();
        result.requestId = ticketId;
        result.ticketId = ticketId;
        result.boardId = boardId;
        result.actionType = 'PURCHASE';
        result.mode = safeMode;
        result.status = 'PREPARED';
        result.entryFee = fee;
        result.layoutText = HousieTicketGenerator.layoutText(layout);
        result.message = 'Ticket fee reserved. Finalizing ticket record.';
        return result;
    }

    @AuraEnabled
    public static TicketActionResult prepareWaitingGameWithdrawal(
        String boardId, String accountId, String requestId
    ) {
        HousieOperationService.lockForWrite();
        Housie_Account__c actor = lockAccount(accountId);
        GameContext context = loadCurrentGame(boardId);
        requireMember(boardId, actor.Account_Key__c);
        HousieErrors.require(context.gameRow.Status__c == 'WAITING',
            'You can only withdraw before the game starts.');
        HousieErrors.require(String.isNotBlank(requestId) && requestId.length() <= 120,
            'A valid withdrawal request id is required.');

        String commandId = HousieIds.stableId('GAME_WITHDRAWAL',
            context.gameRow.Record_Id__c + ':' + actor.Account_Key__c + ':' + requestId);
        List<Housie_Ticket_Command__c> priorCommands = [
            SELECT Request_Key__c, Account_Key__c, Board_Id__c, Game_Id__c,
                   Action_Type__c, Entry_Fee__c, Payload__c, Status__c
            FROM Housie_Ticket_Command__c
            WHERE Request_Key__c = :commandId
            LIMIT 1
        ];
        if (!priorCommands.isEmpty()) {
            Housie_Ticket_Command__c prior = priorCommands[0];
            HousieErrors.require(prior.Account_Key__c == actor.Account_Key__c &&
                prior.Board_Id__c == boardId && prior.Action_Type__c == 'WITHDRAW',
                'This request id was already used for a different command.');
            return actionResultFromCommand(prior);
        }

        acquireGameCommandLock(context.gameRow.Record_Id__c, commandId);

        Set<String> withdrawn = withdrawnTicketIds(context.gameRow.Record_Id__c);
        List<Ticket__b> allTickets = loadCommittedHumanTickets(context.gameRow.Record_Id__c);
        List<String> ticketIds = new List<String>();
        for (Ticket__b ticket : allTickets) {
            if (ticket.Owner_Account_Id__c == actor.Account_Key__c &&
                ticket.Status__c == 'ACTIVE' && !withdrawn.contains(ticket.Record_Id__c)) {
                ticketIds.add(ticket.Record_Id__c);
            }
        }
        HousieErrors.require(!ticketIds.isEmpty(), 'You do not have an active ticket in this game.');

        Map<String,Wallet_Hold__b> latestHolds = loadLatestHolds(
            context.gameRow.Record_Id__c, actor.Account_Key__c
        );
        Decimal releaseTotal = 0;
        for (Ticket__b ticket : allTickets) {
            if (!ticketIds.contains(ticket.Record_Id__c)) continue;
            Wallet_Hold__b hold = latestHolds.get(ticket.Wallet_Hold_Id__c);
            HousieErrors.require(hold != null && hold.Status__c == 'ACTIVE',
                'An active ticket wallet hold is missing or already released.');
            releaseTotal += hold.Amount__c == null ? 0 : hold.Amount__c;
        }

        Datetime nowAt = System.now();

        Housie_Ticket_Command__c command = new Housie_Ticket_Command__c(
            Request_Key__c = commandId,
            Account_Key__c = actor.Account_Key__c,
            Board_Id__c = boardId,
            Game_Id__c = context.gameRow.Record_Id__c,
            Action_Type__c = 'WITHDRAW',
            Entry_Fee__c = releaseTotal,
            Payload__c = JSON.serialize(new Map<String,Object>{'ticketIds' => ticketIds}),
            Status__c = 'PREPARED',
            Created_At__c = nowAt,
            Updated_At__c = nowAt
        );
        insert command;

        TicketActionResult result = new TicketActionResult();
        result.requestId = commandId;
        result.boardId = boardId;
        result.actionType = 'WITHDRAW';
        result.status = 'PREPARED';
        result.entryFee = releaseTotal;
        result.message = 'Withdrawal prepared. Releasing ticket holds.';
        return result;
    }

    @AuraEnabled
    public static List<TicketActionResult> listMyPendingActions(String accountId) {
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        List<Housie_Ticket_Command__c> commands = [
            SELECT Request_Key__c, Board_Id__c, Action_Type__c, Ticket_Id__c,
                   Mode__c, Entry_Fee__c, Layout__c, Status__c
            FROM Housie_Ticket_Command__c
            WHERE Account_Key__c = :actor.Account_Key__c AND Status__c = 'PREPARED'
            ORDER BY Created_At__c ASC
            LIMIT 200
        ];
        List<TicketActionResult> results = new List<TicketActionResult>();
        for (Housie_Ticket_Command__c command : commands) {
            results.add(actionResultFromCommand(command));
        }
        return results;
    }

    @AuraEnabled
    public static TicketActionResult commitTicketCommand(String requestId, String accountId) {
        HousieOperationService.lockForWrite();
        HousieErrors.require(String.isNotBlank(requestId), 'A command request id is required.');
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        List<Housie_Ticket_Command__c> commands = [
            SELECT Id, Request_Key__c, Account_Key__c, Board_Id__c, Game_Id__c,
                   Action_Type__c, Ticket_Id__c, Hold_Id__c, Mode__c,
                   Entry_Fee__c, Layout__c, Payload__c, Status__c, Created_At__c, Updated_At__c
            FROM Housie_Ticket_Command__c
            WHERE Request_Key__c = :requestId AND Account_Key__c = :actor.Account_Key__c
            LIMIT 1
        ];
        HousieErrors.require(!commands.isEmpty(), 'Prepared ticket command not found.');
        Housie_Ticket_Command__c command = commands[0];
        if (command.Status__c == 'COMMITTED') return commandResult(command);
        requireGameCommandLock(command.Game_Id__c, command.Request_Key__c);

        TicketActionResult result;
        if (command.Action_Type__c == 'PURCHASE') {
            result = commitPreparedPurchase(command, actor.Account_Key__c);
        } else if (command.Action_Type__c == 'WITHDRAW') {
            result = commitPreparedWithdrawal(command, actor.Account_Key__c);
        } else {
            throw new HousieErrors.HousieException('Unsupported prepared ticket command type.');
        }
        result.requestId = command.Request_Key__c;
        result.boardId = command.Board_Id__c;
        result.actionType = command.Action_Type__c;
        result.status = 'PERSISTED';
        return result;
    }

    @AuraEnabled
    public static TicketActionResult completeTicketCommand(String requestId, String accountId) {
        HousieOperationService.lockForWrite();
        HousieErrors.require(String.isNotBlank(requestId), 'A command request id is required.');
        Housie_Account__c actor = HousieSecurity.requireAccount(accountId);
        List<Housie_Ticket_Command__c> commands = [
            SELECT Id, Request_Key__c, Account_Key__c, Board_Id__c, Game_Id__c,
                   Action_Type__c, Ticket_Id__c, Payload__c, Status__c, Updated_At__c
            FROM Housie_Ticket_Command__c
            WHERE Request_Key__c = :requestId AND Account_Key__c = :actor.Account_Key__c
            LIMIT 1
            FOR UPDATE
        ];
        HousieErrors.require(!commands.isEmpty(), 'Prepared ticket command not found.');
        Housie_Ticket_Command__c command = commands[0];
        if (command.Status__c == 'COMMITTED') return commandResult(command);

        List<Housie_Game_Command_Lock__c> gameLocks = [
            SELECT Id, Game_Id__c, Status__c, Active_Command_Key__c
            FROM Housie_Game_Command_Lock__c
            WHERE Game_Id__c = :command.Game_Id__c
            LIMIT 1
            FOR UPDATE
        ];
        HousieErrors.require(!gameLocks.isEmpty() &&
            gameLocks[0].Status__c == 'PROCESSING' &&
            gameLocks[0].Active_Command_Key__c == command.Request_Key__c,
            'This command no longer owns the game command gate.');

        if (command.Action_Type__c == 'PURCHASE') {
            List<Ticket__b> rows = [
                SELECT Record_Id__c, Operation_Id__c
                FROM Ticket__b
                WHERE Game_Id__c = :command.Game_Id__c
                  AND Ticket_Kind__c = 'HUMAN'
                  AND Record_Id__c = :command.Ticket_Id__c
                LIMIT 1
            ];
            HousieErrors.require(!rows.isEmpty() &&
                HousieBigObjectStore.isCommitted(rows[0].Operation_Id__c),
                'The ticket Big Object operation has not committed yet. Retry finalization.');
        } else if (command.Action_Type__c == 'WITHDRAW') {
            Map<String,Object> payload = (Map<String,Object>)JSON.deserializeUntyped(command.Payload__c);
            List<Object> rawIds = (List<Object>)payload.get('ticketIds');
            Set<String> requestedTicketIds = new Set<String>();
            for (Object rawId : rawIds) requestedTicketIds.add(String.valueOf(rawId));
            Set<String> withdrawn = withdrawnTicketIds(command.Game_Id__c);
            for (String ticketId : requestedTicketIds) {
                HousieErrors.require(withdrawn.contains(ticketId),
                    'The withdrawal Big Object operation has not committed yet. Retry finalization.');
            }
            ParticipantState participant = currentParticipant(command.Game_Id__c, actor.Account_Key__c);
            HousieErrors.require(participant != null && participant.status == 'WITHDRAWN',
                'The participant withdrawal state has not committed yet. Retry finalization.');
        } else {
            throw new HousieErrors.HousieException('Unsupported prepared ticket command type.');
        }

        // This request performs DML only. The Big Object insertImmediate writes
        // completed in commitTicketCommand in the preceding request.
        if (command.Action_Type__c == 'WITHDRAW') {
            List<Housie_Account__c> accountRows = [
                SELECT Id, Points_Balance__c, Reserved_Points__c
                FROM Housie_Account__c
                WHERE Account_Key__c = :actor.Account_Key__c
                LIMIT 1
                FOR UPDATE
            ];
            HousieErrors.require(!accountRows.isEmpty(), 'Account not found while finalizing withdrawal.');
            Housie_Account__c account = accountRows[0];
            account.Reserved_Points__c =
                (account.Reserved_Points__c == null ? 0 : account.Reserved_Points__c) -
                (command.Entry_Fee__c == null ? 0 : command.Entry_Fee__c);
            HousieDomainRules.assertWalletInvariant(account);
            update account;
        }

        gameLocks[0].Status__c = 'IDLE';
        gameLocks[0].Active_Command_Key__c = null;
        gameLocks[0].Updated_At__c = System.now();
        update gameLocks[0];

        command.Status__c = 'COMMITTED';
        command.Updated_At__c = System.now();
        command.Committed_At__c = command.Updated_At__c;
        update command;
        return commandResult(command);
    }

    private static TicketActionResult commitPreparedPurchase(
        Housie_Ticket_Command__c command, String accountKey
    ) {
        GameContext context = loadCurrentGame(command.Board_Id__c);
        HousieErrors.require(context.gameRow.Record_Id__c == command.Game_Id__c,
            'The prepared ticket belongs to a game that is no longer current.');
        HousieErrors.require(context.gameRow.Status__c == 'WAITING',
            'Tickets can only be finalized while the game is waiting.');
        requireMember(command.Board_Id__c, accountKey);

        List<Ticket__b> priorRows = [
            SELECT Record_Id__c, Operation_Id__c, Owner_Account_Id__c, Mode__c, Layout__c,
                   Status__c, Entry_Fee__c, Wallet_Hold_Id__c
            FROM Ticket__b
            WHERE Game_Id__c = :command.Game_Id__c
              AND Ticket_Kind__c = 'HUMAN'
              AND Record_Id__c = :command.Ticket_Id__c
            LIMIT 1
        ];
        if (!priorRows.isEmpty() && HousieBigObjectStore.isCommitted(priorRows[0].Operation_Id__c)) {
            return actionResultFromTicket(priorRows[0], withdrawnTicketIds(command.Game_Id__c));
        }

        List<List<Integer>> layout = (List<List<Integer>>)JSON.deserialize(
            command.Layout__c, List<List<Integer>>.class
        );
        Datetime purchaseAt = command.Created_At__c;
        List<HousieOperationService.WriteItem> writes = new List<HousieOperationService.WriteItem>();
        writes.add(writeItem('Ticket__b', new Map<String,Object>{
            'Record_Id__c' => command.Ticket_Id__c,
            'Game_Id__c' => command.Game_Id__c,
            'Ticket_Kind__c' => 'HUMAN',
            'Owner_Account_Id__c' => accountKey,
            'Mode__c' => command.Mode__c,
            'Layout__c' => command.Layout__c,
            'Marked_Numbers__c' => '[]',
            'Status__c' => 'ACTIVE',
            'Entry_Fee__c' => command.Entry_Fee__c,
            'Wallet_Hold_Id__c' => command.Hold_Id__c,
            'Created_At__c' => command.Created_At__c,
            'Purchased_At__c' => purchaseAt
        }));
        writes.add(writeItem('Wallet_Hold__b', new Map<String,Object>{
            'Record_Id__c' => command.Hold_Id__c,
            'Hold_Id__c' => command.Hold_Id__c,
            'Account_Id__c' => accountKey,
            'Game_Id__c' => command.Game_Id__c,
            'Source_Type__c' => 'HUMAN_TICKET',
            'Source_Id__c' => command.Ticket_Id__c,
            'Amount__c' => command.Entry_Fee__c,
            'Status__c' => 'ACTIVE',
            'Created_At__c' => command.Created_At__c,
            'Updated_At__c' => purchaseAt
        }));
        writes.add(resourceTransaction(accountKey, 'POINTS', 'HOLD_RESERVE',
            command.Entry_Fee__c, 'HUMAN_TICKET', command.Ticket_Id__c,
            'TICKET_HOLD:' + command.Hold_Id__c, purchaseAt));
        if (command.Mode__c == 'AUTOMATIC') {
            writes.add(resourceTransaction(accountKey, 'AUTO_MODE_TOKEN', 'SPEND', -1,
                'HUMAN_TICKET', command.Ticket_Id__c, 'TICKET_AUTO_TOKEN:' + command.Ticket_Id__c,
                purchaseAt));
        }

        ParticipantState participant = currentParticipant(command.Game_Id__c, accountKey);
        if (participant == null || participant.status != 'ACTIVE') {
            Boolean isFirstActiveParticipant = !hasActiveHumanParticipants(command.Game_Id__c);
            writes.add(writeItem('Game_Participant__b', new Map<String,Object>{
                'Record_Id__c' => HousieIds.stableId('GAME_PARTICIPANT', command.Ticket_Id__c),
                'Game_Id__c' => command.Game_Id__c,
                'Account_Id__c' => accountKey,
                'Join_Sequence__c' => command.Created_At__c.getTime(),
                'Joined_At__c' => command.Created_At__c,
                'Status__c' => 'ACTIVE'
            }));
            if (isFirstActiveParticipant) {
                writes.add(gameEvent(command.Game_Id__c, accountKey, 'GAME_ADMIN_ASSIGNED',
                    new Map<String,Object>{
                        'adminAccountId' => accountKey,
                        'reason' => 'FIRST_ELIGIBLE_PARTICIPANT'
                    }, purchaseAt,
                    HousieIds.stableId('GAME_EVENT', command.Game_Id__c + ':GAME_ADMIN_ASSIGNED')));
            }
        }
        writes.add(gameEvent(command.Game_Id__c, accountKey, 'TICKET_PURCHASED',
            new Map<String,Object>{
                'ticketId' => command.Ticket_Id__c,
                'mode' => command.Mode__c,
                'entryFee' => command.Entry_Fee__c
            }, purchaseAt, HousieIds.stableId('GAME_EVENT', command.Ticket_Id__c + ':TICKET_PURCHASED')));
        HousieOperationService.executeOperation('PURCHASE_HUMAN_TICKET', writes);

        TicketActionResult result = new TicketActionResult();
        result.ticketId = command.Ticket_Id__c;
        result.mode = command.Mode__c;
        result.entryFee = command.Entry_Fee__c;
        result.layoutText = HousieTicketGenerator.layoutText(layout);
        result.message = 'Ticket purchased. ' + String.valueOf(command.Entry_Fee__c) +
            ' points are reserved until the game starts or you withdraw.';
        return result;
    }

    private static TicketActionResult commitPreparedWithdrawal(
        Housie_Ticket_Command__c command, String accountKey
    ) {
        GameContext context = loadCurrentGame(command.Board_Id__c);
        HousieErrors.require(context.gameRow.Record_Id__c == command.Game_Id__c,
            'The prepared withdrawal belongs to a game that is no longer current.');
        HousieErrors.require(context.gameRow.Status__c == 'WAITING',
            'You can only withdraw before the game starts.');
        requireMember(command.Board_Id__c, accountKey);

        Map<String,Object> payload = (Map<String,Object>)JSON.deserializeUntyped(command.Payload__c);
        List<Object> rawIds = (List<Object>)payload.get('ticketIds');
        Set<String> requestedTicketIds = new Set<String>();
        for (Object rawId : rawIds) requestedTicketIds.add(String.valueOf(rawId));
        Set<String> withdrawn = withdrawnTicketIds(command.Game_Id__c);
        List<Ticket__b> tickets = loadCommittedHumanTickets(command.Game_Id__c);
        Map<String,Wallet_Hold__b> latestHolds = loadLatestHolds(command.Game_Id__c, accountKey);
        Datetime nowAt = command.Created_At__c;
        Decimal releaseTotal = 0;
        List<HousieOperationService.WriteItem> writes = new List<HousieOperationService.WriteItem>();

        for (Ticket__b ticket : tickets) {
            if (!requestedTicketIds.contains(ticket.Record_Id__c) || withdrawn.contains(ticket.Record_Id__c)) continue;
            HousieErrors.require(ticket.Owner_Account_Id__c == accountKey,
                'A withdrawal command contains a ticket owned by another account.');
            Wallet_Hold__b hold = latestHolds.get(ticket.Wallet_Hold_Id__c);
            HousieErrors.require(hold != null && hold.Status__c == 'ACTIVE',
                'An active ticket wallet hold is missing or already released.');
            Decimal amount = hold.Amount__c == null ? 0 : hold.Amount__c;
            releaseTotal += amount;
            String releaseRecordId = HousieIds.stableId('HOLD_RELEASE', hold.Hold_Id__c);
            writes.add(writeItem('Wallet_Hold__b', new Map<String,Object>{
                'Record_Id__c' => releaseRecordId,
                'Hold_Id__c' => hold.Hold_Id__c,
                'Account_Id__c' => accountKey,
                'Game_Id__c' => command.Game_Id__c,
                'Source_Type__c' => 'HUMAN_TICKET',
                'Source_Id__c' => ticket.Record_Id__c,
                'Amount__c' => amount,
                'Status__c' => 'RELEASED',
                'Created_At__c' => hold.Created_At__c,
                'Updated_At__c' => nowAt,
                'Released_At__c' => nowAt
            }));
            writes.add(resourceTransaction(accountKey, 'POINTS', 'HOLD_RELEASE', -amount,
                'HUMAN_TICKET', ticket.Record_Id__c,
                'TICKET_HOLD_RELEASE:' + ticket.Wallet_Hold_Id__c, nowAt));
            writes.add(gameEvent(command.Game_Id__c, accountKey, 'TICKET_WITHDRAWN',
                new Map<String,Object>{'ticketId' => ticket.Record_Id__c}, nowAt,
                HousieIds.stableId('GAME_EVENT', ticket.Record_Id__c + ':TICKET_WITHDRAWN')));
        }

        ParticipantState participant = currentParticipant(command.Game_Id__c, accountKey);
        if (participant != null && participant.status == 'ACTIVE') {
            writes.add(writeItem('Game_Participant__b', new Map<String,Object>{
                'Record_Id__c' => HousieIds.stableId('GAME_PARTICIPANT_WITHDRAWAL', command.Request_Key__c),
                'Game_Id__c' => command.Game_Id__c,
                'Account_Id__c' => accountKey,
                'Join_Sequence__c' => participant.joinSequence,
                'Joined_At__c' => participant.joinedAt,
                'Withdrawn_At__c' => nowAt,
                'Status__c' => 'WITHDRAWN'
            }));
        }

        if (!writes.isEmpty()) {
            HousieOperationService.executeOperation('WITHDRAW_FROM_WAITING_GAME', writes);
        }
        TicketActionResult result = new TicketActionResult();
        result.status = 'WITHDRAWN';
        result.entryFee = command.Entry_Fee__c;
        result.message = 'Withdrawn from the waiting game. All ticket holds were released; points are available again.';
        return result;
    }

    @AuraEnabled
    public static TicketActionResult withdrawFromWaitingGame(
        String boardId, String accountId, String requestId
    ) {
        return prepareWaitingGameWithdrawal(boardId, accountId, requestId);
    }

    private static void acquireGameCommandLock(String gameId, String commandKey) {
        List<Housie_Game_Command_Lock__c> rows = [
            SELECT Id, Game_Id__c, Status__c, Active_Command_Key__c
            FROM Housie_Game_Command_Lock__c
            WHERE Game_Id__c = :gameId
            LIMIT 1
            FOR UPDATE
        ];
        Datetime nowAt = System.now();
        if (rows.isEmpty()) {
            insert new Housie_Game_Command_Lock__c(
                Game_Id__c = gameId,
                Status__c = 'PROCESSING',
                Active_Command_Key__c = commandKey,
                Created_At__c = nowAt,
                Updated_At__c = nowAt
            );
            return;
        }

        Housie_Game_Command_Lock__c gameLock = rows[0];
        HousieErrors.require(gameLock.Status__c != 'PROCESSING',
            'Another game command is still being finalized. Retry after that command completes.');
        gameLock.Status__c = 'PROCESSING';
        gameLock.Active_Command_Key__c = commandKey;
        gameLock.Updated_At__c = nowAt;
        update gameLock;
    }

    private static void requireGameCommandLock(String gameId, String commandKey) {
        List<Housie_Game_Command_Lock__c> rows = [
            SELECT Status__c, Active_Command_Key__c
            FROM Housie_Game_Command_Lock__c
            WHERE Game_Id__c = :gameId
            LIMIT 1
        ];
        HousieErrors.require(!rows.isEmpty() &&
            rows[0].Status__c == 'PROCESSING' &&
            rows[0].Active_Command_Key__c == commandKey,
            'This command does not own the current game command gate.');
    }

    private static TicketActionResult actionResultFromCommand(Housie_Ticket_Command__c command) {
        TicketActionResult result = new TicketActionResult();
        result.requestId = command.Request_Key__c;
        result.ticketId = command.Ticket_Id__c;
        result.boardId = command.Board_Id__c;
        result.actionType = command.Action_Type__c;
        result.mode = command.Mode__c;
        result.entryFee = command.Entry_Fee__c;
        result.status = command.Status__c;
        result.message = command.Status__c == 'COMMITTED'
            ? 'Command already completed.' : 'Command is prepared and ready to retry.';
        if (String.isNotBlank(command.Layout__c)) {
            List<List<Integer>> layout = (List<List<Integer>>)JSON.deserialize(
                command.Layout__c, List<List<Integer>>.class
            );
            result.layoutText = HousieTicketGenerator.layoutText(layout);
        }
        return result;
    }

    private static TicketActionResult commandResult(Housie_Ticket_Command__c command) {
        if (command.Action_Type__c == 'PURCHASE') {
            List<Ticket__b> rows = [
                SELECT Record_Id__c, Operation_Id__c, Owner_Account_Id__c, Mode__c, Layout__c,
                       Status__c, Entry_Fee__c, Wallet_Hold_Id__c
                FROM Ticket__b
                WHERE Game_Id__c = :command.Game_Id__c
                  AND Ticket_Kind__c = 'HUMAN'
                  AND Record_Id__c = :command.Ticket_Id__c
                LIMIT 1
            ];
            if (!rows.isEmpty() && HousieBigObjectStore.isCommitted(rows[0].Operation_Id__c)) {
                TicketActionResult completed = actionResultFromTicket(
                    rows[0], withdrawnTicketIds(command.Game_Id__c)
                );
                completed.requestId = command.Request_Key__c;
                completed.boardId = command.Board_Id__c;
                completed.actionType = command.Action_Type__c;
                completed.status = 'COMMITTED';
                return completed;
            }
        }
        return actionResultFromCommand(command);
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
        String sourceType, String sourceId, String idempotencyKey, Datetime createdAt
    ) {
        return writeItem('Account_Resource_Transaction__b', new Map<String,Object>{
            'Record_Id__c' => HousieIds.stableId('RESOURCE_TX', idempotencyKey),
            'Account_Id__c' => accountKey,
            'Resource_Type__c' => resource,
            'Transaction_Type__c' => type,
            'Quantity__c' => quantity,
            'Source_Type__c' => sourceType,
            'Source_Id__c' => sourceId,
            'Idempotency_Key__c' => HousieIds.stableId('RESOURCE_TX', idempotencyKey),
            'Created_At__c' => createdAt,
            'Metadata__c' => '{}'
        });
    }

    private static HousieOperationService.WriteItem gameEvent(
        String gameId, String actorId, String type, Map<String,Object> payload,
        Datetime eventAt, String eventRecordId
    ) {
        return writeItem('Game_Event__b', new Map<String,Object>{
            'Record_Id__c' => eventRecordId,
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